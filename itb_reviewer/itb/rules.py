"""규칙 기반 추출기 + 리스크 판정.

LLM 키가 없어도 서비스가 동작하도록 하는 기본 엔진이자,
LLM 추출 결과를 교차 검증하는 기준선 역할을 한다.
"""
from __future__ import annotations

import re

from .checklist import ITEMS, Item
from .parser import ParsedDocument
from .retrieval import BM25Index, tokenize

_MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
DATE_RES = [
    re.compile(r"\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b"),
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(" + _MONTHS + r")\.?,?\s+(20\d{2})\b", re.I),
    re.compile(r"\b(" + _MONTHS + r")\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b", re.I),
    re.compile(r"(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일"),
]
TIME_RE = re.compile(r"\b(\d{1,2}[:.]\d{2})\s*(?:hrs|hours|h|am|pm|a\.m\.|p\.m\.)?|(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?", re.I)
PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:%|percent|per\s?cent|퍼센트)", re.I)
PERMIL_RE = re.compile(r"(\d+)\s*분의\s*(\d+(?:\.\d+)?)")
# 연도(2026년)를 기간으로 오인하지 않도록 숫자는 3자리까지. 한글 단위 뒤에는 조사(로/이다…)가 붙을 수 있다.
DUR_RE = re.compile(
    r"(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*\)?\s*(?:consecutive\s+|calendar\s+|working\s+)?"
    r"((?:days?|months?|years?|weeks?)\b|개월|일(?!자|시)|년|주(?!식|요))",
    re.I,
)
AMOUNT_RE = re.compile(
    r"(?:(USD|US\$|EUR|KRW|SAR|AED|QAR|\$|€|₩)\s?([\d,]+(?:\.\d+)?)(?:\s*(million|billion|백만|억))?"
    r"|([\d,]+(?:\.\d+)?)\s*(?:(million|billion)\s*)?(USD|EUR|KRW|SAR|AED|QAR|원|달러))",
    re.I,
)
# 문장 경계: 글자 뒤의 마침표/세미콜론 (번호 "1." "2.1" 에서는 자르지 않음)
_SENT_SPLIT = re.compile(r"(?<=[A-Za-z가-힣)\]][.;])\s+(?=[A-Z(가-힣\d])|\n+")
_NEW_ITEM = re.compile(r"^\s*(?:\d{1,2}(?:\.\d+)+\.?\s|\d{1,2}\.\s|제\s*\d+\s*[조장절]|\[표\]|[A-Z][A-Z \-]{6,}$|(?:Clause|Article|Section|SECTION|ARTICLE)\b)")


def _merge_lines(text: str) -> str:
    """PDF 줄바꿈으로 끊긴 문장을 다시 잇는다. 새 조항·표·문장 끝에서는 줄을 유지."""
    out: list[str] = []
    for line in text.split("\n"):
        if out and out[-1] and not re.search(r"[.;:!?다]\s*$", out[-1]) and line.strip() \
                and not _NEW_ITEM.match(line) and " | " not in line and " | " not in out[-1]:
            out[-1] = out[-1].rstrip() + " " + line.strip()
        else:
            out.append(line)
    return "\n".join(out)


def _sentences(text: str) -> list[str]:
    out = []
    for s in _SENT_SPLIT.split(_merge_lines(text)):
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) >= 8:
            out.append(s)
    return out


def _percents(s: str) -> list[float]:
    vals = [float(m.group(1)) for m in PCT_RE.finditer(s)]
    for m in PERMIL_RE.finditer(s):  # "1000분의 5" → 0.5%
        denom, num = float(m.group(1)), float(m.group(2))
        if denom:
            vals.append(round(num / denom * 100, 4))
    return vals


def _duration_months(s: str) -> float | None:
    m = DUR_RE.search(s)
    if not m:
        return None
    n, unit = float(m.group(1)), m.group(2).lower()
    if unit.startswith("year") or unit == "년":
        return n * 12
    if unit.startswith("month") or unit == "개월":
        return n
    if unit.startswith("week") or unit == "주":
        return n * 7 / 30.4
    return n / 30.4


def _duration_days(s: str) -> float | None:
    mo = _duration_months(s)
    return None if mo is None else mo * 30.4


def _value_for(item: Item, s: str) -> str | None:
    vt = item.value_type
    if vt == "date":
        for r in DATE_RES:
            m = r.search(s)
            if m:
                val = m.group(0)
                t = TIME_RE.search(s[m.end(): m.end() + 40])
                return f"{val} {t.group(0).strip()}" if t else val
        return None
    if vt == "percent":
        p = _percents(s)
        if not p:
            return None
        if item.key == "ld_cap":
            return f"{p[-1]:g}%"
        if item.key == "liquidated_damages":
            unit = "/일" if re.search(r"per (?:calendar )?day|each day|daily|매일|1일|지체일수", s, re.I) else (
                "/주" if re.search(r"per week|each week|weekly|1주|매주", s, re.I) else "")
            return f"{p[0]:g}%{unit}"
        return f"{p[0]:g}%"
    if vt == "duration":
        m = DUR_RE.search(s)
        return m.group(0).strip(" )") if m else None
    if vt == "amount":
        m = AMOUNT_RE.search(s)
        return m.group(0) if m else None
    if item.key == "contract_type":
        hits = re.findall(r"lump[- ]sum|unit[- ]price|turnkey|EPC|FIDIC[^,.;]{0,40}|cost[- ]reimbursable|총액|단가|턴키|일괄입찰", s, re.I)
        if hits:
            return ", ".join(dict.fromkeys(h.strip() for h in hits))
    return None


def assess_risk(key: str, value: str | None, evidence: str, context: str | None = None) -> tuple[str, str]:
    """(risk, reason). risk ∈ high | medium | low | none | unknown

    수치는 근거 문장(evidence)에서만 읽고, '무제한/고정가격/간접손해' 같은 문구는
    다음 문장까지 포함한 문맥(context)에서 찾는다.
    """
    ev = evidence or ""
    low_ev = (context if context is not None else ev).lower()
    pcts = _percents(ev)

    if key == "ld_cap":
        if re.search(r"unlimited|no (?:cap|limit|maximum)|without limit|무제한|한도 없", low_ev):
            return "high", "지체상금 상한이 없습니다."
        if not value:
            return "high", "지체상금 상한 조항을 찾지 못했습니다. 무제한 노출 가능성을 확인해야 합니다."
        v = pcts[-1] if pcts else 0
        if v > 15:
            return "high", f"상한 {v:g}%는 통상 수준(10% 내외)보다 높습니다."
        if v > 10:
            return "medium", f"상한 {v:g}%로 통상 수준(10%)을 넘습니다."
        return "low", f"상한 {v:g}%는 통상 범위입니다."

    if key == "liquidated_damages":
        if not value or not pcts:
            return "unknown", "지체상금률을 확인하지 못했습니다."
        v = pcts[0]
        per_day = bool(re.search(r"per (?:calendar )?day|each day|daily|매일|1일|지체일수", low_ev))
        if per_day:
            if v > 0.1:
                return "high", f"일 {v:g}%는 높은 편입니다(통상 0.05~0.1%/일)."
            if v >= 0.1:
                return "medium", f"일 {v:g}%로 통상 범위 상단입니다."
            return "low", f"일 {v:g}%는 통상 범위입니다."
        if v > 1:
            return "high", f"주 {v:g}%는 높은 편입니다(통상 0.5~1%/주)."
        return "low", f"{v:g}%는 통상 범위입니다."

    if key == "bid_bond":
        if not pcts:
            return ("unknown", "보증 비율이 아닌 정액이거나 확인되지 않았습니다.") if value is None else ("low", "")
        v = pcts[0]
        if v > 5:
            return "high", f"입찰보증 {v:g}%는 통상(2~5%)보다 높습니다."
        if v > 3:
            return "medium", f"입찰보증 {v:g}%로 통상 범위 상단입니다."
        return "low", f"입찰보증 {v:g}%는 통상 범위입니다."

    if key == "performance_bond":
        if not pcts:
            return "unknown", "이행보증 비율을 확인하지 못했습니다."
        v = pcts[0]
        if v > 15:
            return "high", f"이행보증 {v:g}%는 통상(10%)보다 높습니다."
        if v > 10:
            return "medium", f"이행보증 {v:g}%로 통상(10%)을 넘습니다."
        return "low", f"이행보증 {v:g}%는 통상 범위입니다."

    if key == "advance_payment":
        if re.search(r"no advance|not be (?:entitled|paid)|shall not|선급금(?:은|을)? 지급하지|없음", low_ev):
            return "high", "선급금이 없어 초기 자금 부담이 큽니다."
        if not value:
            return "medium", "선급금 조항을 찾지 못했습니다. 초기 현금흐름을 확인해야 합니다."
        return "low", f"선급금 {value}이 지급됩니다."

    if key == "retention":
        if not pcts:
            return "unknown", "유보금 비율을 확인하지 못했습니다."
        v = pcts[0]
        if v > 10:
            return "high", f"유보금 {v:g}%는 높은 편입니다(통상 5~10%)."
        if v > 5:
            return "medium", f"유보금 {v:g}%로 통상 범위 상단입니다."
        return "low", f"유보금 {v:g}%는 통상 범위입니다."

    if key == "warranty":
        mo = _duration_months(ev) if value else None
        if mo is None:
            return "unknown", "하자담보기간을 확인하지 못했습니다."
        if mo > 24:
            return "high", f"하자담보 {mo:g}개월은 통상(12~24개월)보다 깁니다."
        if mo > 12:
            return "medium", f"하자담보 {mo:g}개월로 통상(12개월)보다 깁니다."
        return "low", f"하자담보 {mo:g}개월은 통상 범위입니다."

    if key == "limitation_of_liability":
        if re.search(r"unlimited|no limit|shall not be limited|without limit|무제한|제한(?:하지| 없)", low_ev):
            return "high", "계약자 책임이 무제한이거나 제한되지 않습니다."
        if not low_ev:
            return "high", "책임 한도 조항을 찾지 못했습니다. 무제한 책임 가능성을 확인해야 합니다."
        if pcts and pcts[0] > 100:
            return "high", f"책임 한도가 계약금액의 {pcts[0]:g}%로 높습니다."
        if not re.search(r"consequential|indirect|간접", low_ev):
            return "medium", "간접·결과적 손해 면책 문구를 함께 확인해야 합니다."
        return "low", "책임 한도와 간접손해 면책이 있습니다."

    if key == "price_adjustment":
        if not low_ev:
            return "unknown", "물가변동 조항을 찾지 못했습니다."
        if re.search(r"not (?:be )?subject to (?:any )?(?:price )?adjust|no (?:price )?(?:adjustment|escalation)|fixed and firm|firm price|shall remain fixed|조정하지 (?:않|아니)|고정", low_ev):
            return "high", "물가변동 조정이 없는 고정가격입니다. 자재·인건비 상승 위험을 계약자가 모두 집니다."
        return "low", "물가변동 조정 조항이 있습니다."

    if key == "bid_validity":
        d = _duration_days(ev) if value else None
        if d is None:
            return "unknown", ""
        if d > 180:
            return "medium", f"입찰 유효기간 {d:.0f}일은 깁니다. 가격 유지 부담이 있습니다."
        return "low", ""

    if key == "payment_terms":
        d = _duration_days(ev) if value else None
        if d is None:
            return "unknown", "기성 지급 기한을 확인하지 못했습니다."
        if d > 60:
            return "high", f"지급 기한 {d:.0f}일은 깁니다(통상 28~56일)."
        if d > 45:
            return "medium", f"지급 기한 {d:.0f}일로 통상보다 깁니다."
        return "low", ""

    if key == "governing_law":
        if not ev:
            return "unknown", ""
        if re.search(r"arbitrat|icc|siac|lcia|uncitral|중재", low_ev):
            return "low", "국제중재 조항이 있습니다."
        if re.search(r"court|법원", low_ev):
            return "medium", "중재 없이 현지 법원 관할입니다."
        return "none", ""

    if key == "local_content":
        if not pcts:
            return ("none", "") if not ev else ("low", "")
        v = pcts[0]
        if v >= 50:
            return "high", f"현지화 의무 {v:g}%는 높습니다."
        if v >= 30:
            return "medium", f"현지화 의무 {v:g}%입니다."
        return "low", ""

    return "none", ""


def _best_sentence(item: Item, index: BM25Index):
    anchor = re.compile(item.anchors, re.I)
    exclude = re.compile(item.exclude, re.I) if item.exclude else None
    qtok = set(tokenize(item.query))
    best = None
    for rank, (chunk, score) in enumerate(index.search(item.query, top_k=6)):
        sents = _sentences(chunk.text)
        for k, s in enumerate(sents):
            if not anchor.search(s) or (exclude and exclude.search(s)):
                continue
            val = _value_for(item, s)
            overlap = len(qtok & set(tokenize(s)))
            starts_mid = bool(re.match(r"^[a-z]", s))  # 청크 겹침으로 잘린 문장
            sc = (score * (1.0 - 0.08 * rank) + overlap * 0.6 + (4.0 if val else 0.0)
                  - len(s) / 600 - (2.0 if starts_mid else 0.0))
            if best is None or sc > best[0]:
                # 리스크 판단용 문맥: 같은 조항의 다음 문장까지
                ctx = " ".join(sents[k: k + 2])
                best = (sc, s, val, chunk, ctx)
    return best


def extract_rules(doc: ParsedDocument, index: BM25Index) -> list[dict]:
    results = []
    for item in ITEMS:
        best = _best_sentence(item, index)
        if best is None:
            value, evidence, page, section, ctx = None, "", None, "", ""
        else:
            _, evidence, value, chunk, ctx = best
            page, section = chunk.page, chunk.section
            if value is None and (item.value_type == "text" or item.key == "limitation_of_liability"):
                value = evidence if len(evidence) <= 220 else evidence[:217] + "…"
        found = value is not None
        risk, reason = assess_risk(item.key, value, evidence, ctx)
        results.append({
            "key": item.key,
            "label": item.label,
            "category": item.category,
            "found": found,
            "value": value or "",
            "summary": "",
            "evidence": evidence[:600],
            "pages": [page] if page else [],
            "section": section,
            "risk": risk,
            "risk_reason": reason,
            "source": "rule",
        })
    return results
