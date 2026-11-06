"""파이프라인 테스트: 규칙 추출, API, Claude 경로(가짜 클라이언트).

  cd itb_reviewer && python samples/make_samples.py && python -m pytest -q
"""
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from itb import llm  # noqa: E402
from itb.parser import parse_document  # noqa: E402
from itb.retrieval import BM25Index, expand_query  # noqa: E402
from itb.rules import extract_rules  # noqa: E402

EN = ROOT / "samples" / "sample_itb_en.pdf"
KO = ROOT / "samples" / "sample_itb_ko.docx"


@pytest.fixture(scope="session", autouse=True)
def samples():
    if not EN.exists() or not KO.exists():
        import runpy

        runpy.run_path(str(ROOT / "samples" / "make_samples.py"), run_name="__main__")


def _rules(path):
    doc = parse_document(path)
    return {r["key"]: r for r in extract_rules(doc, BM25Index(doc.chunks))}


def test_rules_english_pdf():
    r = _rules(EN)
    assert r["bid_due_date"]["value"].startswith("2026-03-16")
    assert r["clarification_deadline"]["value"] == "2026-02-10"
    assert r["site_visit"]["value"].startswith("2026-01-20")
    assert r["bid_validity"]["value"] == "180 days"
    assert r["bid_bond"]["value"] == "2%" and r["bid_bond"]["pages"] == [3]
    assert r["performance_bond"]["value"] == "10%"
    assert r["advance_payment"]["value"] == "10%"
    assert r["completion_period"]["value"] == "36 months"
    assert r["liquidated_damages"]["value"] == "0.15%/일" and r["liquidated_damages"]["risk"] == "high"
    assert r["ld_cap"]["value"] == "20%" and r["ld_cap"]["risk"] == "high"
    assert r["warranty"]["value"] == "24 months" and r["warranty"]["risk"] == "medium"
    assert r["price_adjustment"]["risk"] == "high"
    assert r["governing_law"]["risk"] == "low"
    assert "lump sum" in r["contract_type"]["value"].lower()
    assert "Northbay Energy Authority" in r["employer"]["value"]


def test_rules_korean_docx():
    r = _rules(KO)
    assert "한빛시 하수처리장" in r["project_name"]["value"]
    assert "상하수도사업소" in r["employer"]["value"]
    assert r["bid_due_date"]["value"].startswith("2026년 3월 10일")
    assert r["bid_validity"]["value"] == "90일"
    assert r["bid_bond"]["value"] == "5%"
    assert r["performance_bond"]["value"] == "15%"
    assert r["liquidated_damages"]["value"] == "0.05%/일"  # 1000분의 0.5
    assert r["ld_cap"]["value"] == "30%" and r["ld_cap"]["risk"] == "high"
    assert r["warranty"]["value"] == "3년" and r["warranty"]["risk"] == "high"
    assert r["governing_law"]["risk"] == "medium"  # 중재 없이 관할 법원
    assert r["price_adjustment"]["risk"] == "low"
    assert not r["retention"]["found"]  # 문서에 없음 → 지어내지 않음


def test_query_expansion_bilingual():
    assert "liquidated damages" in expand_query("지체상금 상한은?")
    assert "defects notification" in expand_query("하자담보기간 알려줘")


# ── API ─────────────────────────────────────────────
@pytest.fixture()
def client(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from fastapi.testclient import TestClient

    from itb.main import app

    return TestClient(app)


def _wait(client, rid):
    for _ in range(100):
        d = client.get(f"/api/documents/{rid}").json()
        if d["status"] in ("done", "error"):
            return d
        time.sleep(0.1)
    raise TimeoutError


def test_api_flow(client):
    assert client.get("/api/status").json() == {"llm": False, "model": None}
    with EN.open("rb") as f:
        rid = client.post("/api/documents", files={"file": ("itb.pdf", f, "application/pdf")}).json()["id"]
    d = _wait(client, rid)
    assert d["status"] == "done" and d["found"] == d["total"] == 26
    assert d["risk_counts"]["high"] >= 3
    assert d["extraction"]["top_risks"]

    page = client.get(f"/api/documents/{rid}/pages/6").json()
    assert "Delay Damages" in page["text"]

    chat = client.post(f"/api/documents/{rid}/chat", json={"question": "지체상금 상한은?"}).json()
    assert chat["mode"] == "offline" and chat["passages"][0]["page"] == 6

    csv = client.get(f"/api/documents/{rid}/export.csv")
    assert csv.status_code == 200 and "지체상금 상한" in csv.content.decode("utf-8-sig")

    bad = client.post("/api/documents", files={"file": ("x.exe", b"abc", "application/octet-stream")})
    assert bad.status_code == 400


# ── Claude 경로 (가짜 클라이언트로 요청 형태와 루프 검증) ─────────
class FakeMessages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kw):
        self.calls.append(json.loads(json.dumps(kw, default=lambda o: getattr(o, "__dict__", str(o)))))
        return self.responses.pop(0)


def _fake_client(responses):
    msgs = FakeMessages(responses)
    return SimpleNamespace(beta=SimpleNamespace(messages=msgs)), msgs


def _text(t, stop="end_turn"):
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=t)], stop_reason=stop, model="claude-opus-5-5")


def test_claude_extraction_merges(monkeypatch):
    doc = parse_document(EN)
    idx = BM25Index(doc.chunks)
    rules = extract_rules(doc, idx)
    payload = {
        "overall_summary": "요약",
        "top_risks": ["지체상금 상한 20%"],
        "items": [{"key": "ld_cap", "found": True, "value": "20% of the Contract Price", "summary": "상한 20%",
                   "evidence": "shall not exceed a maximum of 20%", "pages": [6], "risk": "high",
                   "risk_reason": "통상보다 높음"}],
    }
    fake, msgs = _fake_client([_text(json.dumps(payload, ensure_ascii=False))])
    monkeypatch.setattr(llm, "_client", lambda: fake)
    out = llm.extract_with_claude(doc, idx, rules)
    call = msgs.calls[0]
    assert call["model"] == llm.MODEL and call["betas"] == [llm.FALLBACK_BETA] and call["fallbacks"] == "default"
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "Delay Damages" in call["messages"][0]["content"]  # 근거 발췌가 프롬프트에 들어감
    by = {i["key"]: i for i in out["items"]}
    assert by["ld_cap"]["source"] == "claude" and by["ld_cap"]["rule_value"] == "20%"
    assert by["bid_bond"]["source"] == "rule"  # Claude가 빠뜨린 항목은 규칙 결과 유지
    assert out["top_risks"] == ["지체상금 상한 20%"]


def test_claude_agent_loop(monkeypatch):
    doc = parse_document(EN)
    idx = BM25Index(doc.chunks)
    tool_turn = SimpleNamespace(
        content=[SimpleNamespace(type="tool_use", id="tu1", name="search_document",
                                 input={"query": "liquidated damages cap", "top_k": 3}),
                 SimpleNamespace(type="tool_use", id="tu2", name="read_pages",
                                 input={"start_page": 6, "end_page": 6})],
        stop_reason="tool_use", model="claude-opus-5-5")
    fake, msgs = _fake_client([tool_turn, _text("상한은 계약금액의 20%입니다 [p.6].")])
    monkeypatch.setattr(llm, "_client", lambda: fake)
    out = llm.chat_with_claude(doc, idx, None, "지체상금 상한은?", [])
    assert out["answer"].endswith("[p.6].")
    assert [t["tool"] for t in out["trace"]] == ["search_document", "read_pages"]
    second = msgs.calls[1]["messages"]
    results = second[-1]["content"]
    assert [r["tool_use_id"] for r in results] == ["tu1", "tu2"]  # 병렬 호출 결과를 한 메시지로
    assert "Delay Damages" in results[0]["content"] and 'page number="6"' in results[1]["content"]
