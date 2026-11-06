"""Claude 연동: (1) 근거 기반 구조화 추출, (2) Agentic RAG 질의응답.

ANTHROPIC_API_KEY 가 있을 때만 켜진다. 없으면 서비스는 규칙 기반 엔진으로 동작한다.
"""
from __future__ import annotations

import json
import os

from .checklist import ITEMS, ITEM_BY_KEY
from .parser import ParsedDocument
from .retrieval import BM25Index, expand_query

MODEL = os.getenv("ITB_MODEL", "claude-opus-5-5")
EFFORT = os.getenv("ITB_EFFORT", "medium")
# 안전 분류기가 요청을 거절하면 서버가 대체 모델로 다시 실행 (Claude API 전용 베타)
USE_FALLBACKS = os.getenv("ITB_FALLBACKS", "1") == "1"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_AGENT_TURNS = 8


def available() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _client():
    import anthropic

    return anthropic.Anthropic()


def _create(client, **kwargs):
    if USE_FALLBACKS:
        return client.beta.messages.create(betas=[FALLBACK_BETA], fallbacks="default", **kwargs)
    return client.beta.messages.create(**kwargs)


def _text_of(resp) -> str:
    return "".join(b.text for b in resp.content if b.type == "text")


# ─────────────────────────────────────────────────────────────
# 1) 구조화 추출: 항목별로 BM25 근거를 모아 한 번에 JSON으로 추출
# ─────────────────────────────────────────────────────────────
EXTRACT_SYSTEM = """당신은 해외 건설·EPC 입찰을 20년 검토한 입찰안내서(ITB) 검토 전문가입니다.
주어진 근거 발췌(<chunk>)만 사용해 각 검토 항목의 값을 추출하고 계약자 입장의 리스크를 판정하세요.

규칙:
- 근거에 없는 내용은 추측하지 말고 found=false, value="" 로 두세요.
- value 는 원문 수치·날짜·명칭을 그대로 살린 짧은 값입니다 (예: "5% of Contract Price", "2026-03-15 14:00").
- summary 는 한국어 1~2문장 요약입니다.
- pages 는 근거가 나온 chunk 의 page 번호입니다.
- evidence 는 근거 원문 문장을 그대로 인용합니다 (300자 이내).
- risk: high(입찰 전 반드시 협의·가격 반영), medium(주의), low(통상 수준), none(리스크 판단 대상 아님), unknown(판단 근거 부족).
- 항목이 '상한/한도/선급금' 처럼 '없음'이 리스크인 경우, 근거에서 찾지 못했다면 risk=high 또는 medium 으로 표시하고 이유를 적으세요.
- risk_reason 은 한국어로, 업계 통상 수준과 비교해 설명합니다."""


def _extraction_schema() -> dict:
    keys = [i.key for i in ITEMS]
    item = {
        "type": "object",
        "properties": {
            "key": {"type": "string", "enum": keys},
            "found": {"type": "boolean"},
            "value": {"type": "string"},
            "summary": {"type": "string"},
            "evidence": {"type": "string"},
            "pages": {"type": "array", "items": {"type": "integer"}},
            "risk": {"type": "string", "enum": ["high", "medium", "low", "none", "unknown"]},
            "risk_reason": {"type": "string"},
        },
        "required": ["key", "found", "value", "summary", "evidence", "pages", "risk", "risk_reason"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "overall_summary": {"type": "string"},
            "top_risks": {"type": "array", "items": {"type": "string"}},
            "items": {"type": "array", "items": item},
        },
        "required": ["overall_summary", "top_risks", "items"],
        "additionalProperties": False,
    }


def _evidence_block(doc: ParsedDocument, index: BM25Index, per_item: int = 4) -> str:
    parts = []
    for item in ITEMS:
        hits = index.search(item.query, top_k=per_item)
        chunks = "\n".join(
            f'<chunk page="{c.page}" section="{c.section[:80]}">\n{c.text}\n</chunk>' for c, _ in hits
        ) or "(검색 결과 없음)"
        parts.append(f'<item key="{item.key}" label="{item.label}" guide="{item.guide}">\n{chunks}\n</item>')
    return "\n\n".join(parts)


def extract_with_claude(doc: ParsedDocument, index: BM25Index, rule_results: list[dict]) -> dict:
    client = _client()
    first_pages = "\n".join(f"[p.{p.number}]\n{p.text}" for p in doc.pages[:2])[:6000]
    rule_hint = json.dumps(
        [{"key": r["key"], "value": r["value"], "pages": r["pages"]} for r in rule_results if r["found"]],
        ensure_ascii=False,
    )
    user = (
        f"문서: {doc.filename} ({doc.page_count}페이지)\n\n"
        f"<document_head>\n{first_pages}\n</document_head>\n\n"
        f"<evidence>\n{_evidence_block(doc, index)}\n</evidence>\n\n"
        f"<rule_engine_hints>\n{rule_hint}\n</rule_engine_hints>\n"
        "규칙 엔진 힌트는 참고용이며 틀릴 수 있습니다. 근거 원문을 우선하세요.\n"
        f"모든 검토 항목({len(ITEMS)}개)에 대해 items 를 하나씩 채우고, "
        "overall_summary(한국어 3~5문장)와 top_risks(입찰 전 꼭 확인할 리스크 3~6개)를 작성하세요."
    )
    resp = _create(
        client,
        model=MODEL,
        max_tokens=16000,
        system=EXTRACT_SYSTEM,
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": _extraction_schema()}},
        messages=[{"role": "user", "content": user}],
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("모델이 요청을 거절했습니다.")
    if resp.stop_reason == "max_tokens":
        raise RuntimeError("응답이 max_tokens에서 잘렸습니다.")
    data = json.loads(_text_of(resp))

    by_key = {it["key"]: it for it in data.get("items", [])}
    merged = []
    for r in rule_results:
        it = by_key.get(r["key"])
        if not it:
            merged.append(r)
            continue
        merged.append({
            **r,
            "found": it["found"],
            "value": it["value"],
            "summary": it["summary"],
            "evidence": it["evidence"] or r["evidence"],
            "pages": sorted(set(it["pages"])) or r["pages"],
            "risk": it["risk"],
            "risk_reason": it["risk_reason"],
            "source": "claude",
            "rule_value": r["value"],
        })
    return {
        "items": merged,
        "overall_summary": data.get("overall_summary", ""),
        "top_risks": data.get("top_risks", []),
        "model": resp.model,
    }


# ─────────────────────────────────────────────────────────────
# 2) Agentic RAG 대화: Claude 가 검색·페이지 열람 도구를 스스로 반복 호출
# ─────────────────────────────────────────────────────────────
CHAT_SYSTEM = """당신은 입찰안내서(ITB) 검토 어시스턴트입니다. 사용자는 건설사 입찰 담당자입니다.
도구로 문서를 직접 검색·열람해서 답하세요. 기억이나 일반 지식으로 문서 내용을 지어내지 마세요.

작업 방식:
1. search_document 로 관련 조항을 찾습니다. 동의어(영문/한글, 예: liquidated damages/지체상금)로 여러 번 검색해도 됩니다.
2. 조항이 여러 페이지에 걸치거나 다른 조항을 참조하면 read_pages 로 앞뒤 페이지를 읽습니다.
3. 필요하면 get_extracted_items 로 이미 추출된 주요 항목 표를 참고합니다.
4. 충분한 근거가 모이면 답합니다.

답변 형식:
- 한국어로, 결론을 먼저 쓰고 근거를 붙입니다.
- 모든 사실에는 [p.12] 처럼 페이지를 표시합니다.
- 문서에서 찾지 못한 내용은 "문서에서 확인되지 않음"이라고 분명히 씁니다.
- 계약자에게 불리한 조항이면 리스크와 대응(질의서·가격 반영·예외 조건 제시)을 짧게 제안합니다."""

CHAT_TOOLS = [
    {
        "name": "search_document",
        "description": "입찰안내서 전체에서 BM25 키워드 검색을 수행하고 관련 발췌를 페이지 번호와 함께 돌려줍니다. 한글·영문 키워드를 모두 쓸 수 있습니다.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "검색어. 예: 'liquidated damages cap 지체상금 한도'"},
                "top_k": {"type": "integer", "description": "돌려받을 발췌 수 (1~8)"},
            },
            "required": ["query", "top_k"],
            "additionalProperties": False,
        },
    },
    {
        "name": "read_pages",
        "description": "지정한 페이지 범위의 전문을 읽습니다. 한 번에 최대 5페이지.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "start_page": {"type": "integer"},
                "end_page": {"type": "integer"},
            },
            "required": ["start_page", "end_page"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_extracted_items",
        "description": "이 문서에서 이미 추출된 주요 검토 항목(입찰마감일, 보증, 지체상금, 하자담보 등)과 리스크 판정 표를 돌려줍니다.",
        "strict": True,
        "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    },
]


def run_tool(name: str, args: dict, doc: ParsedDocument, index: BM25Index, extraction: dict | None) -> str:
    if name == "search_document":
        k = max(1, min(int(args.get("top_k") or 5), 8))
        hits = index.search(expand_query(str(args.get("query", ""))), top_k=k)
        if not hits:
            return "검색 결과가 없습니다. 다른 키워드(영문/한글 동의어)로 다시 검색하세요."
        return "\n\n".join(
            f'<result page="{c.page}" section="{c.section[:80]}" score="{s:.2f}">\n{c.text}\n</result>' for c, s in hits
        )
    if name == "read_pages":
        a = max(1, int(args.get("start_page", 1)))
        b = min(int(args.get("end_page", a)), a + 4, doc.page_count)
        if a > doc.page_count:
            return f"문서는 {doc.page_count}페이지까지 있습니다."
        return "\n\n".join(f"<page number=\"{n}\">\n{doc.page_text(n)}\n</page>" for n in range(a, b + 1))
    if name == "get_extracted_items":
        if not extraction:
            return "아직 추출 결과가 없습니다."
        rows = [
            {k: it.get(k) for k in ("label", "value", "pages", "risk", "risk_reason")}
            for it in extraction.get("items", [])
        ]
        return json.dumps(rows, ensure_ascii=False)
    raise ValueError(f"알 수 없는 도구: {name}")


def chat_with_claude(doc: ParsedDocument, index: BM25Index, extraction: dict | None,
                     question: str, history: list[dict]) -> dict:
    """history: [{"role": "user"|"assistant", "content": str}, ...] (이전 턴의 최종 답변만)"""
    client = _client()
    messages: list = [{"role": m["role"], "content": m["content"]} for m in history[-10:]]
    messages.append({
        "role": "user",
        "content": f"[문서: {doc.filename}, 총 {doc.page_count}페이지]\n{question}",
    })
    trace = []
    for _ in range(MAX_AGENT_TURNS):
        resp = _create(
            client,
            model=MODEL,
            max_tokens=16000,
            system=CHAT_SYSTEM,
            tools=CHAT_TOOLS,
            output_config={"effort": EFFORT},
            messages=messages,
        )
        if resp.stop_reason == "refusal":
            return {"answer": "모델이 이 요청을 거절했습니다.", "trace": trace, "mode": "claude"}
        messages.append({"role": "assistant", "content": resp.content})
        if resp.stop_reason == "pause_turn":
            continue
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            return {"answer": _text_of(resp) or "(빈 응답)", "trace": trace, "mode": "claude", "model": resp.model}
        results = []
        for tu in tool_uses:
            try:
                out = run_tool(tu.name, tu.input, doc, index, extraction)
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": out})
            except Exception as e:  # 도구 오류는 모델에게 돌려줘서 스스로 고치게 함
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": f"오류: {e}", "is_error": True})
            trace.append({"tool": tu.name, "input": tu.input})
        messages.append({"role": "user", "content": results})
    return {"answer": "검색 단계가 너무 길어져 중단했습니다. 질문을 더 구체적으로 해 주세요.", "trace": trace, "mode": "claude"}


def chat_offline(index: BM25Index, question: str) -> dict:
    """LLM 없이: 관련 조항에서 질문과 가장 맞는 문장들을 골라 보여 준다."""
    from .retrieval import tokenize
    from .rules import _sentences

    expanded = expand_query(question)
    hits = index.search(expanded, top_k=6)
    if not hits:
        return {"answer": "관련 조항을 찾지 못했습니다. 다른 키워드로 질문해 보세요.", "passages": [], "mode": "offline"}
    qtok = set(tokenize(expanded))
    top = hits[0][1]
    passages = []
    for c, s in hits:
        if s < top * 0.3:
            break
        sents = _sentences(c.text)
        scored = sorted(range(len(sents)), key=lambda k: -len(qtok & set(tokenize(sents[k]))))[:3]
        best = [sents[k] for k in sorted(scored) if qtok & set(tokenize(sents[k]))]
        if best:
            passages.append({"page": c.page, "section": c.section, "text": " … ".join(best), "score": round(s, 2)})
    return {
        "answer": "LLM이 설정되지 않아 관련 조항의 핵심 문장만 보여 드립니다. "
                  "(ANTHROPIC_API_KEY를 설정하면 Claude가 문서를 직접 검색·열람해 답변합니다.)",
        "passages": passages,
        "mode": "offline",
    }


def item_label(key: str) -> str:
    it = ITEM_BY_KEY.get(key)
    return it.label if it else key
