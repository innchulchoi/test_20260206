/* ITB Reviewer engine (browser + node). Python itb/ 패키지의 parser·retrieval·checklist·rules 이식본. */
(function (root) {
  "use strict";

  // ── checklist ──────────────────────────────────────────
  const CATEGORIES = ["일반 정보", "입찰 절차", "보증·지급", "공기·지체", "계약 리스크"];
  const I = (key, label, category, query, anchors, valueType, guide, exclude = "") =>
    ({ key, label, category, query, anchors, valueType, guide, exclude });
  const ITEMS = [
    I("project_name", "프로젝트명", "일반 정보", "project name title works 프로젝트 공사명 사업명 건명", "project|works|공사명|사업명|건명", "text", "공식 프로젝트(공사)명", "분쟁|dispute"),
    I("employer", "발주처", "일반 정보", "employer owner client purchaser authority 발주처 발주기관 수요기관 계약상대자", "employer|owner|client|purchaser|authority|발주", "text", "발주처(Employer/Owner) 명칭", "분쟁|dispute|shall pay|지급|소재지"),
    I("location", "현장 위치", "일반 정보", "site location located country region 현장 위치 소재지 공사장소", "site|locat|위치|소재지|장소", "text", "공사 현장 위치·국가", "분쟁|dispute|arbitration|관할"),
    I("scope", "공사 범위", "일반 정보", "scope of work works comprise engineering procurement construction 공사범위 과업범위 공사개요", "scope|comprise|consist|범위|개요|포함", "text", "설계·조달·시공 등 계약자 업무 범위"),
    I("contract_type", "계약 방식", "일반 정보", "contract type lump sum unit price EPC turnkey FIDIC conditions of contract 계약방식 총액 단가 턴키 일괄입찰", "lump|unit price|turnkey|epc|fidic|reimburs|총액|단가|턴키|일괄", "text", "총액(Lump Sum)/단가/턴키 여부와 적용 계약조건(FIDIC 등)"),
    I("bid_due_date", "입찰 마감일", "입찰 절차", "bid submission deadline closing date due date tenders must be received schedule 입찰마감 제출마감 입찰서 제출 마감일시 일정 마감일", "deadline|closing|due|received|submi|마감", "date", "입찰서 제출 마감 일시와 장소"),
    I("clarification_deadline", "질의 마감일", "입찰 절차", "clarification queries questions requests deadline 질의 질의응답 질의서 회신", "clarif|quer|question|질의", "date", "입찰 질의서 제출 기한"),
    I("site_visit", "현장설명회", "입찰 절차", "pre-bid meeting site visit conference schedule 현장설명회 현장답사 입찰설명회 일정", "pre-bid|site visit|conference|meeting|현장설명|현장답사|설명회", "date", "현장설명회/Pre-bid meeting 일정과 참석 의무"),
    I("bid_validity", "입찰 유효기간", "입찰 절차", "bid validity period remain valid days 입찰유효기간 유효기간", "valid|유효", "duration", "입찰서 유효기간(일)", "security|guarantee|bond|보증"),
    I("bid_currency", "입찰 통화", "입찰 절차", "currency of bid currencies payment exchange rate 입찰통화 통화 환율", "currenc|exchange|통화|환율", "text", "입찰·지급 통화와 환율 적용 기준"),
    I("evaluation", "평가 기준", "입찰 절차", "evaluation criteria technical commercial weighting lowest evaluated award 평가기준 낙찰자 결정 기술평가 가격평가 배점", "evaluat|award|weight|lowest|평가|낙찰|배점", "text", "기술·가격 평가 방식, 배점, 낙찰자 결정 방법"),
    I("submission_documents", "제출 서류", "입찰 절차", "bid shall comprise documents submitted envelope technical proposal price schedule 제출서류 입찰서류 구비서류", "comprise|envelope|document|proposal|제출서류|구비서류|입찰서류", "text", "기술·가격 제안서 등 제출 서류 구성과 봉투 방식"),
    I("bid_bond", "입찰보증금", "보증·지급", "bid security bid bond tender guarantee 입찰보증금 입찰보증서 보증", "bid security|bid bond|tender (?:security|guarantee)|입찰보증", "percent", "입찰보증 금액(비율)과 유효기간", "performance|이행|계약보증"),
    I("performance_bond", "계약이행보증", "보증·지급", "performance security performance bond guarantee 계약이행보증 이행보증금 계약보증금 보증", "performance (?:security|bond|guarantee)|이행보증|계약보증", "percent", "이행보증 비율·형식·유효기간", "bid security|입찰보증"),
    I("advance_payment", "선급금", "보증·지급", "advance payment down payment advance payment guarantee 선급금 선금", "advance|down payment|선급|선금", "percent", "선급금 비율과 선급금 보증 조건"),
    I("payment_terms", "기성 지급조건", "보증·지급", "interim payment monthly progress payment certificate days invoice 기성 대가지급 지급기한", "interim|progress payment|payment certificate|invoice|기성|대가", "duration", "기성 청구 주기와 지급 기한"),
    I("retention", "유보금", "보증·지급", "retention money retained percent 유보금 하자보수보증금", "retention|retain|유보", "percent", "유보금 비율과 반환 조건"),
    I("completion_period", "공사 기간", "공기·지체", "time for completion completion period months commencement date 공사기간 준공기한 착공", "time for completion|completion|commencement|공사기간|준공|공기", "duration", "착공일 기준 준공 기한"),
    I("liquidated_damages", "지체상금률", "공기·지체", "liquidated damages delay damages per day per week rate 지체상금 지체상금률", "liquidated|delay damages|지체상금", "percent", "지체상금률(일/주당 비율)", "exceed|maximum|\\bcap\\b|aggregate|초과|한도|상한"),
    I("ld_cap", "지체상금 상한", "공기·지체", "maximum amount liquidated damages cap aggregate limit not exceed 지체상금 한도 상한", "(?:maximum|cap|aggregate|not exceed|limit).{0,60}(?:liquidated|delay)|(?:liquidated|delay).{0,80}(?:maximum|cap|exceed|limit)|지체상금.{0,30}(?:한도|상한|초과)", "percent", "지체상금 총액 상한(계약금액 대비 %)"),
    I("warranty", "하자담보기간", "계약 리스크", "defects notification period warranty period defects liability 하자담보 하자보수기간 하자담보책임기간", "defect|warrant|하자", "duration", "하자담보(DNP/Warranty) 기간"),
    I("limitation_of_liability", "책임 한도", "계약 리스크", "limitation of liability total liability aggregate liability consequential loss 책임한도 손해배상 한도 간접손해", "liabilit|consequential|책임|손해배상", "percent", "계약자 총 책임 한도와 간접손해 면책"),
    I("price_adjustment", "물가변동", "계약 리스크", "price adjustment escalation fluctuation changes in cost fixed price not subject to adjustment 물가변동 계약금액 조정", "adjust|escalat|fluctuat|물가|조정", "text", "물가변동 조정 가능 여부(고정가격 리스크)"),
    I("governing_law", "준거법·분쟁해결", "계약 리스크", "governing law dispute resolution arbitration court ICC jurisdiction 준거법 분쟁 중재 관할법원", "governing law|dispute|arbitrat|court|jurisdiction|준거법|분쟁|중재|관할", "text", "준거법, 중재기관/관할 법원"),
    I("insurance", "보험", "계약 리스크", "insurance contractor all risks CAR third party liability 보험 공사보험 배상책임", "insurance|all risks|보험", "text", "계약자 부보 의무 보험 종류와 금액"),
    I("local_content", "현지화 요건", "계약 리스크", "local content local subcontractors nationals localization in-country value 현지화 현지 업체 현지인 고용", "local content|in-country|national|locali|현지", "percent", "현지 조달·고용 의무 비율"),
  ];

  // ── parser (text → pages → chunks) ─────────────────────
  const PSEUDO_PAGE_CHARS = 3000, CHUNK_CHARS = 1200, CHUNK_OVERLAP = 200;
  const HEADING_RE = new RegExp(
    "^\\s*(?:" +
      "(?:\\d+(?:\\.\\d+){0,3})\\.?\\s+[A-Z가-힣][^\\n]{2,80}" +
      "|(?:ARTICLE|Article|SECTION|Section|CLAUSE|Clause|PART|Part)\\s+[\\dIVXLC]+[^\\n]{0,80}" +
      "|제\\s*\\d+\\s*(?:조|장|절)[^\\n]{0,80}" +
    ")\\s*$");

  function pseudoPages(blocks) {
    const pages = []; let buf = "", n = 1;
    for (const b of blocks) {
      if (buf && buf.length + b.length > PSEUDO_PAGE_CHARS) { pages.push({ number: n++, text: buf.trim() }); buf = ""; }
      buf += b + "\n";
    }
    if (buf.trim()) pages.push({ number: n, text: buf.trim() });
    return pages;
  }

  function chunkPages(pages) {
    const chunks = []; let section = "", id = 0;
    for (const p of pages) {
      let buf = "", startSection = section, firstHeading = "";
      for (const line of p.text.split("\n")) {
        if (buf.length + line.length > CHUNK_CHARS && buf) {
          chunks.push({ id: id++, page: p.number, section: firstHeading || startSection, text: buf.trim() });
          buf = buf.slice(-CHUNK_OVERLAP) + "\n"; startSection = section; firstHeading = "";
        }
        if (HEADING_RE.test(line) && line.trim().length < 100) { section = line.trim(); firstHeading = firstHeading || section; }
        buf += line + "\n";
      }
      if (buf.trim()) chunks.push({ id: id++, page: p.number, section: firstHeading || startSection, text: buf.trim() });
    }
    return chunks;
  }

  function buildDocument(filename, kind, pages) {
    if (!pages.some(p => p.text.trim())) throw new Error("텍스트를 추출하지 못했습니다. 스캔 이미지 PDF라면 OCR이 먼저 필요합니다.");
    return { filename, kind, pages, chunks: chunkPages(pages) };
  }

  // ── retrieval ─────────────────────────────────────────
  const EN = /[a-z0-9]+(?:\.[0-9]+)?/g, KO = /[가-힣]+/g;
  const STOP = new Set(["the","of","and","to","in","a","for","be","by","or","shall","is","on","with","as","any","this","that","an","at","are","from"]);
  function tokenize(text) {
    text = text.toLowerCase();
    const toks = (text.match(EN) || []).filter(t => !STOP.has(t));
    for (const w of text.match(KO) || []) { toks.push(w); for (let i = 0; i < w.length - 1; i++) toks.push(w.slice(i, i + 2)); }
    return toks;
  }
  const words = text => { const t = text.toLowerCase(); return [...(t.match(EN) || []).filter(w => !STOP.has(w)), ...(t.match(KO) || [])]; };
  const GENERIC = new Set(["입찰","계약","공사","기간","금액","조건","내용","관련","bid","contract","works","period","date"]);

  function expandQuery(query) {
    const q = words(query);
    const hit = w => w.length >= 2 && q.some(x => x.startsWith(w));
    const extra = [];
    for (const it of ITEMS) {
      const label = words(it.label);
      if ((label.length && label.every(hit)) || words(it.query).some(w => !GENERIC.has(w) && hit(w))) extra.push(it.query);
    }
    return extra.length ? query + " " + extra.join(" ") : query;
  }

  class BM25 {
    constructor(chunks, k1 = 1.5, b = 0.75) {
      this.chunks = chunks; this.k1 = k1; this.b = b; this.tfs = [];
      const df = new Map();
      for (const c of chunks) {
        const tf = new Map();
        for (const t of tokenize(c.section + "\n" + c.text)) tf.set(t, (tf.get(t) || 0) + 1);
        this.tfs.push(tf);
        for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
      }
      this.lens = this.tfs.map(tf => [...tf.values()].reduce((a, v) => a + v, 0));
      this.avgdl = this.lens.length ? this.lens.reduce((a, v) => a + v, 0) / this.lens.length : 1;
      const n = chunks.length; this.idf = new Map();
      for (const [t, f] of df) this.idf.set(t, Math.log(1 + (n - f + 0.5) / (f + 0.5)));
    }
    search(query, topK = 5) {
      const q = tokenize(query); if (!q.length) return [];
      const scores = [];
      this.tfs.forEach((tf, i) => {
        let s = 0; const dl = this.lens[i] || 1;
        for (const t of q) { const f = tf.get(t); if (!f) continue; s += (this.idf.get(t) || 0) * f * (this.k1 + 1) / (f + this.k1 * (1 - this.b + this.b * dl / this.avgdl)); }
        if (s > 0) scores.push([s, i]);
      });
      scores.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
      return scores.slice(0, topK).map(([s, i]) => ({ chunk: this.chunks[i], score: s }));
    }
  }

  // ── rules ─────────────────────────────────────────────
  const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
  const DATE_RES = [
    /\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/,
    new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + MONTHS + ")\\.?,?\\s+(20\\d{2})\\b", "i"),
    new RegExp("\\b(" + MONTHS + ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b", "i"),
    /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
  ];
  const TIME_RE = /\b(\d{1,2}[:.]\d{2})\s*(?:hrs|hours|h|am|pm|a\.m\.|p\.m\.)?|(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/i;
  const PCT_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent|per\s?cent|퍼센트)/gi;
  const PERMIL_RE = /(\d+)\s*분의\s*(\d+(?:\.\d+)?)/g;
  const DUR_RE = /(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*\)?\s*(?:consecutive\s+|calendar\s+|working\s+)?((?:days?|months?|years?|weeks?)\b|개월|일(?!자|시)|년|주(?!식|요))/i;
  const SENT_SPLIT = /(?<=[A-Za-z가-힣)\]][.;])\s+(?=[A-Z(가-힣\d])|\n+/;
  const NEW_ITEM = /^\s*(?:\d{1,2}(?:\.\d+)+\.?\s|\d{1,2}\.\s|제\s*\d+\s*[조장절]|\[표\]|[A-Z][A-Z \-]{6,}$|(?:Clause|Article|Section|SECTION|ARTICLE)\b)/;

  function mergeLines(text) {
    const out = [];
    for (const line of text.split("\n")) {
      const last = out[out.length - 1];
      if (out.length && last && !/[.;:!?다]\s*$/.test(last) && line.trim() && !NEW_ITEM.test(line) && !line.includes(" | ") && !last.includes(" | "))
        out[out.length - 1] = last.trimEnd() + " " + line.trim();
      else out.push(line);
    }
    return out.join("\n");
  }
  const sentences = text => mergeLines(text).split(SENT_SPLIT).map(s => (s || "").replace(/\s+/g, " ").trim()).filter(s => s.length >= 8);
  const round4 = x => Math.round(x * 1e4) / 1e4;
  const g = n => String(+n.toPrecision(12));

  function percents(s) {
    const vals = [...s.matchAll(PCT_RE)].map(m => parseFloat(m[1]));
    for (const m of s.matchAll(PERMIL_RE)) { const d = parseFloat(m[1]); if (d) vals.push(round4(parseFloat(m[2]) / d * 100)); }
    return vals;
  }
  function durationMonths(s) {
    const m = s.match(DUR_RE); if (!m) return null;
    const n = parseFloat(m[1]), u = m[2].toLowerCase();
    if (u.startsWith("year") || u === "년") return n * 12;
    if (u.startsWith("month") || u === "개월") return n;
    if (u.startsWith("week") || u === "주") return n * 7 / 30.4;
    return n / 30.4;
  }
  const durationDays = s => { const m = durationMonths(s); return m == null ? null : m * 30.4; };
  const PER_DAY = /per (?:calendar )?day|each day|daily|매일|1일|지체일수/i;

  function valueFor(item, s) {
    const vt = item.valueType;
    if (vt === "date") {
      for (const r of DATE_RES) {
        const m = s.match(r);
        if (m) { const t = s.slice(m.index + m[0].length, m.index + m[0].length + 40).match(TIME_RE); return t ? `${m[0]} ${t[0].trim()}` : m[0]; }
      }
      return null;
    }
    if (vt === "percent") {
      const p = percents(s); if (!p.length) return null;
      if (item.key === "ld_cap") return g(p[p.length - 1]) + "%";
      if (item.key === "liquidated_damages") {
        const unit = PER_DAY.test(s) ? "/일" : /per week|each week|weekly|1주|매주/i.test(s) ? "/주" : "";
        return g(p[0]) + "%" + unit;
      }
      return g(p[0]) + "%";
    }
    if (vt === "duration") { const m = s.match(DUR_RE); return m ? m[0].trim().replace(/^[ )]+|[ )]+$/g, "") : null; }
    if (item.key === "contract_type") {
      const hits = s.match(/lump[- ]sum|unit[- ]price|turnkey|EPC|FIDIC[^,.;]{0,40}|cost[- ]reimbursable|총액|단가|턴키|일괄입찰/gi);
      if (hits) return [...new Set(hits.map(h => h.trim()))].join(", ");
    }
    return null;
  }

  function assessRisk(key, value, evidence, context) {
    const ev = evidence || "";
    const low = (context != null ? context : ev).toLowerCase();
    const p = percents(ev);
    const R = (r, why = "") => [r, why];
    switch (key) {
      case "ld_cap": {
        if (/unlimited|no (?:cap|limit|maximum)|without limit|무제한|한도 없/.test(low)) return R("high", "지체상금 상한이 없습니다.");
        if (!value) return R("high", "지체상금 상한 조항을 찾지 못했습니다. 무제한 노출 가능성을 확인해야 합니다.");
        const v = p.length ? p[p.length - 1] : 0;
        if (v > 15) return R("high", `상한 ${g(v)}%는 통상 수준(10% 내외)보다 높습니다.`);
        if (v > 10) return R("medium", `상한 ${g(v)}%로 통상 수준(10%)을 넘습니다.`);
        return R("low", `상한 ${g(v)}%는 통상 범위입니다.`);
      }
      case "liquidated_damages": {
        if (!value || !p.length) return R("unknown", "지체상금률을 확인하지 못했습니다.");
        const v = p[0];
        if (PER_DAY.test(low)) {
          if (v > 0.1) return R("high", `일 ${g(v)}%는 높은 편입니다(통상 0.05~0.1%/일).`);
          if (v >= 0.1) return R("medium", `일 ${g(v)}%로 통상 범위 상단입니다.`);
          return R("low", `일 ${g(v)}%는 통상 범위입니다.`);
        }
        if (v > 1) return R("high", `주 ${g(v)}%는 높은 편입니다(통상 0.5~1%/주).`);
        return R("low", `${g(v)}%는 통상 범위입니다.`);
      }
      case "bid_bond": {
        if (!p.length) return value == null ? R("unknown", "보증 비율이 아닌 정액이거나 확인되지 않았습니다.") : R("low");
        const v = p[0];
        if (v > 5) return R("high", `입찰보증 ${g(v)}%는 통상(2~5%)보다 높습니다.`);
        if (v > 3) return R("medium", `입찰보증 ${g(v)}%로 통상 범위 상단입니다.`);
        return R("low", `입찰보증 ${g(v)}%는 통상 범위입니다.`);
      }
      case "performance_bond": {
        if (!p.length) return R("unknown", "이행보증 비율을 확인하지 못했습니다.");
        const v = p[0];
        if (v > 15) return R("high", `이행보증 ${g(v)}%는 통상(10%)보다 높습니다.`);
        if (v > 10) return R("medium", `이행보증 ${g(v)}%로 통상(10%)을 넘습니다.`);
        return R("low", `이행보증 ${g(v)}%는 통상 범위입니다.`);
      }
      case "advance_payment": {
        if (/no advance|not be (?:entitled|paid)|shall not|선급금(?:은|을)? 지급하지|없음/.test(low)) return R("high", "선급금이 없어 초기 자금 부담이 큽니다.");
        if (!value) return R("medium", "선급금 조항을 찾지 못했습니다. 초기 현금흐름을 확인해야 합니다.");
        return R("low", `선급금 ${value}이 지급됩니다.`);
      }
      case "retention": {
        if (!p.length) return R("unknown", "유보금 비율을 확인하지 못했습니다.");
        const v = p[0];
        if (v > 10) return R("high", `유보금 ${g(v)}%는 높은 편입니다(통상 5~10%).`);
        if (v > 5) return R("medium", `유보금 ${g(v)}%로 통상 범위 상단입니다.`);
        return R("low", `유보금 ${g(v)}%는 통상 범위입니다.`);
      }
      case "warranty": {
        const mo = value ? durationMonths(ev) : null;
        if (mo == null) return R("unknown", "하자담보기간을 확인하지 못했습니다.");
        if (mo > 24) return R("high", `하자담보 ${g(mo)}개월은 통상(12~24개월)보다 깁니다.`);
        if (mo > 12) return R("medium", `하자담보 ${g(mo)}개월로 통상(12개월)보다 깁니다.`);
        return R("low", `하자담보 ${g(mo)}개월은 통상 범위입니다.`);
      }
      case "limitation_of_liability": {
        if (/unlimited|no limit|shall not be limited|without limit|무제한|제한(?:하지| 없)/.test(low)) return R("high", "계약자 책임이 무제한이거나 제한되지 않습니다.");
        if (!low) return R("high", "책임 한도 조항을 찾지 못했습니다. 무제한 책임 가능성을 확인해야 합니다.");
        if (p.length && p[0] > 100) return R("high", `책임 한도가 계약금액의 ${g(p[0])}%로 높습니다.`);
        if (!/consequential|indirect|간접/.test(low)) return R("medium", "간접·결과적 손해 면책 문구를 함께 확인해야 합니다.");
        return R("low", "책임 한도와 간접손해 면책이 있습니다.");
      }
      case "price_adjustment": {
        if (!low) return R("unknown", "물가변동 조항을 찾지 못했습니다.");
        if (/not (?:be )?subject to (?:any )?(?:price )?adjust|no (?:price )?(?:adjustment|escalation)|fixed and firm|firm price|shall remain fixed|조정하지 (?:않|아니)|고정/.test(low))
          return R("high", "물가변동 조정이 없는 고정가격입니다. 자재·인건비 상승 위험을 계약자가 모두 집니다.");
        return R("low", "물가변동 조정 조항이 있습니다.");
      }
      case "bid_validity": {
        const d = value ? durationDays(ev) : null;
        if (d == null) return R("unknown");
        if (d > 180) return R("medium", `입찰 유효기간 ${Math.round(d)}일은 깁니다. 가격 유지 부담이 있습니다.`);
        return R("low");
      }
      case "payment_terms": {
        const d = value ? durationDays(ev) : null;
        if (d == null) return R("unknown", "기성 지급 기한을 확인하지 못했습니다.");
        if (d > 60) return R("high", `지급 기한 ${Math.round(d)}일은 깁니다(통상 28~56일).`);
        if (d > 45) return R("medium", `지급 기한 ${Math.round(d)}일로 통상보다 깁니다.`);
        return R("low");
      }
      case "governing_law": {
        if (!ev) return R("unknown");
        if (/arbitrat|icc|siac|lcia|uncitral|중재/.test(low)) return R("low", "국제중재 조항이 있습니다.");
        if (/court|법원/.test(low)) return R("medium", "중재 없이 현지 법원 관할입니다.");
        return R("none");
      }
      case "local_content": {
        if (!p.length) return ev ? R("low") : R("none");
        const v = p[0];
        if (v >= 50) return R("high", `현지화 의무 ${g(v)}%는 높습니다.`);
        if (v >= 30) return R("medium", `현지화 의무 ${g(v)}%입니다.`);
        return R("low");
      }
    }
    return R("none");
  }

  function bestSentence(item, index) {
    const anchor = new RegExp(item.anchors, "i");
    const exclude = item.exclude ? new RegExp(item.exclude, "i") : null;
    const qtok = new Set(tokenize(item.query));
    let best = null;
    index.search(item.query, 6).forEach(({ chunk, score }, rank) => {
      const sents = sentences(chunk.text);
      sents.forEach((s, k) => {
        if (!anchor.test(s) || (exclude && exclude.test(s))) return;
        const val = valueFor(item, s);
        const overlap = new Set(tokenize(s).filter(t => qtok.has(t))).size;
        const sc = score * (1 - 0.08 * rank) + overlap * 0.6 + (val ? 4 : 0) - s.length / 600 - (/^[a-z]/.test(s) ? 2 : 0);
        if (!best || sc > best.sc) best = { sc, s, val, chunk, ctx: sents.slice(k, k + 2).join(" ") };
      });
    });
    return best;
  }

  function extractRules(doc, index) {
    return ITEMS.map(item => {
      const best = bestSentence(item, index);
      let value = null, evidence = "", page = null, section = "", ctx = "";
      if (best) {
        ({ s: evidence, val: value, ctx } = best); page = best.chunk.page; section = best.chunk.section;
        if (value == null && (item.valueType === "text" || item.key === "limitation_of_liability"))
          value = evidence.length <= 220 ? evidence : evidence.slice(0, 217) + "…";
      }
      const [risk, reason] = assessRisk(item.key, value, evidence, ctx);
      return { key: item.key, label: item.label, category: item.category, found: value != null, value: value || "",
        summary: "", evidence: evidence.slice(0, 600), pages: page ? [page] : [], section, risk, risk_reason: reason, source: "rule" };
    });
  }

  function offlineAnswer(index, question) {
    const expanded = expandQuery(question);
    const hits = index.search(expanded, 6);
    if (!hits.length) return [];
    const qtok = new Set(tokenize(expanded)), top = hits[0].score, out = [];
    for (const { chunk, score } of hits) {
      if (score < top * 0.3) break;
      const sents = sentences(chunk.text);
      const ov = s => new Set(tokenize(s).filter(t => qtok.has(t))).size;
      const pick = sents.map((s, k) => [k, ov(s)]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(x => x[1] > 0).map(x => x[0]).sort((a, b) => a - b);
      if (pick.length) out.push({ page: chunk.page, section: chunk.section, text: pick.map(k => sents[k]).join(" … ") });
    }
    return out;
  }

  const api = { CATEGORIES, ITEMS, pseudoPages, chunkPages, buildDocument, tokenize, expandQuery, BM25, sentences, extractRules, assessRisk, offlineAnswer };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ITBEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
