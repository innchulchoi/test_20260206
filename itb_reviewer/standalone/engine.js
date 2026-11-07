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
    I("bid_currency", "입찰 통화", "입찰 절차", "currency of bid currencies payment exchange rate 입찰통화 통화 환율", "currency of|currencies|priced in|통화", "text", "입찰·지급 통화와 환율 적용 기준"),
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
    I("site_data_reliance", "현장 자료 신뢰 범위", "계약 리스크", "site data geotechnical information accuracy warrant reliance for information only verify 현장 자료 지반 조사 참고용 정확성 보증", "for information only|warrant|relian|rely|verify the site data|참고용|정확성|책임지지", "text", "발주처가 준 조사 자료를 계약자가 믿고 쓸 수 있는지(RUI)"),
    I("interfaces", "인터페이스·타 계약자 범위", "계약 리스크", "interface by others other contractors coordinate tie-in boundary 인터페이스 타 계약자 경계 연계", "by others|interface|tie-in|other contractor|인터페이스|타 계약자|경계", "text", "타 계약자·발주처가 맡는 범위와 경계 조건"),
  ];
  // 입찰 요약표 묶음, 담당 부서, 영문 명칭(질의서용), 쓰임새
  const META = {
    project_name: ["일반", "영업", "Project name", "견적서·표지·질의서 머리에 쓰는 공식 명칭"],
    employer: ["일반", "영업", "Employer", "보증서 수익자, 질의서 수신처"],
    location: ["일반", "시공", "Site location", "물류·현지 단가·허가 검토의 기준"],
    scope: ["기술 조건", "설계", "Scope of work", "견적 범위표(WBS)의 기준"],
    contract_type: ["상업 조건", "계약법무", "Contract type", "가격 구조와 적용 계약조건(FIDIC 판)"],
    bid_due_date: ["일정", "영업", "Bid submission deadline", "거꾸로 세어 부서별 회신 마감을 잡음"],
    clarification_deadline: ["일정", "계약법무", "Clarification deadline", "모순은 이 날까지 질의해야 추가 공고로 고칠 수 있음"],
    site_visit: ["일정", "시공", "Pre-bid meeting / site visit", "참석자 지정, 현장 확인 항목 준비"],
    bid_validity: ["입찰 절차", "재무", "Bid validity", "보증 만기·환율·금속 헤지 기간"],
    bid_currency: ["입찰 절차", "재무", "Currency of bid", "환위험·현지 통화 비중"],
    evaluation: ["입찰 절차", "영업", "Evaluation criteria", "가격·기술 배점에 맞춘 제안 전략"],
    submission_documents: ["입찰 절차", "영업", "Bid documents", "제출 서류 체크리스트"],
    bid_bond: ["입찰 절차", "재무", "Bid security", "은행 보증 한도 신청"],
    performance_bond: ["상업 조건", "재무", "Performance security", "은행 한도 점유, 보증 수수료 원가"],
    advance_payment: ["상업 조건", "재무", "Advance payment", "초기 현금흐름, 선급금 보증"],
    payment_terms: ["상업 조건", "재무", "Interim payment terms", "현금흐름·금융비용"],
    retention: ["상업 조건", "재무", "Retention money", "현금흐름, 유보금 반환 시점"],
    completion_period: ["일정", "시공", "Time for completion", "공정표·자원 계획의 기준"],
    liquidated_damages: ["상업 조건", "계약법무", "Delay damages rate", "공기 지연 1일당 손실, 예비비 산정"],
    ld_cap: ["상업 조건", "계약법무", "Maximum delay damages", "최대 지연 손실 노출"],
    warranty: ["상업 조건", "시공", "Defects notification period", "하자 대응 인력·보증 기간"],
    limitation_of_liability: ["상업 조건", "계약법무", "Limitation of liability", "최대 손실 노출, 보험·이사회 승인 기준"],
    price_adjustment: ["상업 조건", "원가", "Price adjustment", "자재·인건비 상승분 예비비"],
    governing_law: ["상업 조건", "계약법무", "Governing law and disputes", "분쟁 비용·집행 가능성"],
    insurance: ["상업 조건", "재무", "Insurance", "보험료 원가, 부보 범위"],
    local_content: ["기술 조건", "원가", "Local content", "현지 조달 단가·하도급 계획"],
    site_data_reliance: ["기술 조건", "설계", "Reliance on site data", "조사 자료 오류의 비용 주인, 추가 조사 예산"],
    interfaces: ["기술 조건", "시공", "Interfaces with others", "타 계약자 지연 시 대기·범위 다툼"],
  };
  for (const it of ITEMS) { const m = META[it.key]; it.group = m[0]; it.dept = m[1]; it.en = m[2]; it.use = m[3]; }
  const GROUPS = ["일정", "입찰 절차", "상업 조건", "기술 조건", "일반"];
  // 입찰 절차 항목은 입찰지침(ITB·BDS)이, 계약 항목은 계약 문서 우선순위가 정한다
  const PROCEDURAL = new Set(["bid_due_date", "clarification_deadline", "site_visit", "bid_validity", "bid_currency", "evaluation", "submission_documents", "bid_bond"]);
  // 찾지 못하면 질의로 확인해야 하는 핵심 항목
  const MUST = ["bid_due_date", "clarification_deadline", "bid_validity", "bid_bond", "performance_bond", "advance_payment", "payment_terms", "retention", "completion_period", "liquidated_damages", "ld_cap", "warranty", "limitation_of_liability", "price_adjustment", "governing_law", "insurance", "site_data_reliance"];
  // 판정 기준(화면 설명과 판정이 같은 표를 쓴다)
  const THRESHOLDS = [
    ["지체상금률", "일 0.1% 초과 높음, 0.1% 주의 · 주 1% 초과 높음 · 단위(일/주)를 모르면 확인 필요"],
    ["지체상금 상한", "15% 초과 높음, 10% 초과 주의, 조항 없음 높음"],
    ["책임 한도", "무제한·조항 없음·100% 초과 높음, 간접손해 면책 없음 주의"],
    ["하자담보기간", "24개월 초과 높음, 12개월 초과 주의"],
    ["기성 지급 기한", "84일 초과 높음, 56일 초과 주의(FIDIC 표준 56일)"],
    ["입찰보증", "5% 초과 높음, 3% 초과 주의"],
    ["이행보증", "15% 초과 높음, 10% 초과 주의"],
    ["유보금", "10% 초과 높음, 5% 초과 주의"],
    ["선급금", "지급 안 함 높음, 조항 없음 주의"],
    ["물가변동", "조정 없는 고정가격 높음"],
    ["현장 자료", "발주처가 정확성을 보증하지 않음 높음"],
    ["입찰 유효기간", "180일 초과 주의"],
    ["분쟁 해결", "중재 없이 법원 관할 주의"],
    ["현지화", "50% 이상 높음, 30% 이상 주의"],
  ];
  const DEPTS = ["영업", "원가", "설계", "시공", "계약법무", "재무"];

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
          chunks.push({ id: id++, page: p.number, section: firstHeading || startSection, start: startSection, text: buf.trim() });
          buf = buf.slice(-CHUNK_OVERLAP) + "\n"; startSection = section; firstHeading = "";
        }
        if (HEADING_RE.test(line) && line.trim().length < 100) { section = line.trim(); firstHeading = firstHeading || section; }
        buf += line + "\n";
      }
      if (buf.trim()) chunks.push({ id: id++, page: p.number, section: firstHeading || startSection, start: startSection, text: buf.trim() });
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
  const TIME_RE = /\b(\d{1,2}[:.]\d{2})\s*(?:hrs|hours|h|am|pm|a\.m\.|p\.m\.)?(?:\s*\((?:GMT|UTC)[^)]{0,8}\)|\s*(?:GMT|UTC)\s*[+-]\s*\d{1,2}|\s*\([A-Za-z ]{2,20}time\))?|(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/i;
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
  const PER_DAY = /per (?:calendar |working )?day|(?:each|every|for each|for every) (?:calendar |working )?day|a day of delay|daily|매일|1일|일당|지체일수/i;
  const PER_WEEK = /per week|(?:each|every|for each|for every) week|weekly|1주|매주/i;

  // 값과 함께 원문에서 그 값이 나온 글자(raw)를 돌려준다(원문 형광펜용).
  function valueMatch(item, s) {
    const vt = item.valueType;
    if (vt === "date") {
      for (const r of DATE_RES) {
        const m = s.match(r);
        if (m) { const t = s.slice(m.index + m[0].length, m.index + m[0].length + 48).match(TIME_RE); const d = m[0].replace(/\s+/g, " "); return { v: t ? `${d} ${t[0].trim().replace(/\s+/g, " ")}` : d, raw: m[0] }; }
      }
      return null;
    }
    if (vt === "percent") {
      const ms = [...s.matchAll(PCT_RE)].map(m => m[0]).concat([...s.matchAll(PERMIL_RE)].map(m => m[0]));
      const p = percents(s);
      if (!p.length) {
        if (item.key === "bid_bond" || item.key === "performance_bond") { const a = s.match(AMT_RE); if (a) return { v: a[0].replace(/\s+/g, " "), raw: a[0], amount: true }; }
        if (item.key === "limitation_of_liability" && LOL_FULL.test(s)) { const m = s.match(LOL_FULL); return { v: "100%", raw: m[0], num: 100 }; }
        return null;
      }
      if (item.key === "ld_cap") return { v: g(p[p.length - 1]) + "%", raw: ms[ms.length - 1] };
      if (item.key === "liquidated_damages") {
        const unit = PER_DAY.test(s) ? "/일" : PER_WEEK.test(s) ? "/주" : "";
        return { v: g(p[0]) + "%" + unit, raw: ms[0] };
      }
      return { v: g(p[0]) + "%", raw: ms[0] };
    }
    if (vt === "date") return null;
    if (vt === "duration") { const m = s.match(DUR_RE); return m ? { v: m[0].trim().replace(/^[ )]+|[ )]+$/g, ""), raw: m[0].trim() } : null; }
    if (item.key === "contract_type") {
      const hits = s.match(/lump[- ]sum|unit[- ]price|turnkey|EPC|FIDIC[^,.;]{0,40}|cost[- ]reimbursable|총액|단가|턴키|일괄입찰/gi);
      if (hits) return { v: [...new Set(hits.map(h => h.trim()))].join(", "), raw: hits[0] };
    }
    return null;
  }
  const AMT_RE = /(?:USD|US\$|EUR|KRW|SAR|AED|QAR|GBP|JPY|\$|€|₩)\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|bn))?|[\d,]{4,}(?:\.\d+)?\s*(?:원|달러|USD|EUR|KRW)/;
  const LOL_FULL = /계약금액을\s*한도|계약금액\s*범위|(?:shall not exceed|limited to|capped at)\s+(?:the\s+)?(?:Accepted\s+)?Contract\s+(?:Price|Amount|Sum)(?!\s*(?:multiplied|times|x))/i;
  const valueFor = (item, s) => { const m = valueMatch(item, s); return m ? m.v : null; };

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
        if (!PER_DAY.test(ev) && !PER_WEEK.test(ev)) return R("unknown", `${g(v)}%가 하루 기준인지 주 기준인지 문장에서 확인되지 않습니다. 원문을 확인해야 합니다.`);
        if (PER_DAY.test(ev)) {
          if (v > 0.1) return R("high", `일 ${g(v)}%는 높은 편입니다(통상 0.05~0.1%/일).`);
          if (v >= 0.1) return R("medium", `일 ${g(v)}%로 통상 범위 상단입니다.`);
          return R("low", `일 ${g(v)}%는 통상 범위입니다.`);
        }
        if (v > 1) return R("high", `주 ${g(v)}%는 높은 편입니다(통상 0.5~1%/주).`);
        return R("low", `주 ${g(v)}%는 통상 범위입니다.`);
      }
      case "bid_bond": {
        if (!p.length) return value == null ? R("unknown", "입찰보증 조건을 확인하지 못했습니다.") : R("low", `정액 보증(${value})입니다. 입찰가 대비 비율로 바꿔 보려면 입찰가가 필요합니다.`);
        const v = p[0];
        if (v > 5) return R("high", `입찰보증 ${g(v)}%는 통상(2~5%)보다 높습니다.`);
        if (v > 3) return R("medium", `입찰보증 ${g(v)}%로 통상 범위 상단입니다.`);
        return R("low", `입찰보증 ${g(v)}%는 통상 범위입니다.`);
      }
      case "performance_bond": {
        if (!p.length) return value ? R("low", `정액 보증(${value})입니다.`) : R("unknown", "이행보증 조건을 확인하지 못했습니다.");
        const v = p[0];
        if (v > 15) return R("high", `이행보증 ${g(v)}%는 통상(10%)보다 높습니다.`);
        if (v > 10) return R("medium", `이행보증 ${g(v)}%로 통상(10%)을 넘습니다.`);
        return R("low", `이행보증 ${g(v)}%는 통상 범위입니다.`);
      }
      case "advance_payment": {
        if (/no advance payment|advance payment (?:shall|will) not be (?:made|paid|provided)|not be entitled to (?:an |any )?advance|선급금(?:은|을)? 지급하지|선급금 없음/.test(low)) return R("high", "선급금이 없어 초기 자금 부담이 큽니다.");
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
        const mm = Math.round(mo * 10) / 10;
        if (mo > 24.5) return R("high", `하자담보 ${g(mm)}개월은 24개월을 넘습니다(기준: 12개월, 24개월 초과 높음).`);
        if (mo > 12.5) return R("medium", `하자담보 ${g(mm)}개월은 기준 12개월보다 깁니다(24개월까지는 흔함).`);
        return R("low", `하자담보 ${g(mm)}개월은 기준(12개월) 이내입니다.`);
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
        if (d > 84.5) return R("high", `지급 기한 ${Math.round(d)}일은 깁니다(FIDIC 표준 56일).`);
        if (d > 56.5) return R("medium", `지급 기한 ${Math.round(d)}일은 FIDIC 표준 56일보다 깁니다.`);
        return R("low", `지급 기한 ${Math.round(d)}일은 FIDIC 표준(56일) 이내입니다.`);
      }
      case "governing_law": {
        if (!ev) return R("unknown");
        if (/arbitrat|icc|siac|lcia|uncitral|중재/.test(low)) return R("low", "국제중재 조항이 있습니다.");
        if (/court|법원/.test(low)) return R("medium", "중재 없이 현지 법원 관할입니다.");
        return R("none");
      }
      case "site_data_reliance": {
        if (!ev) return R("unknown", "조사 자료를 어디까지 믿을 수 있는지 정한 조항을 찾지 못했습니다.");
        if (/for information only|does not warrant|not warrant|no responsibility|shall verify|참고용|책임지지|보증하지/.test(low))
          return R("high", "발주처가 조사 자료의 정확성을 보증하지 않습니다. 자료 오류(지반·수심 등)의 비용을 계약자가 집니다.");
        return R("low", "조사 자료를 믿고 쓸 수 있는 조항이 있습니다.");
      }
      case "interfaces": {
        if (!ev) return R("none");
        return R("medium", "다른 계약자·발주처가 맡는 범위가 있습니다. 경계 조건과 지연 시 보상을 확인해야 합니다.");
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
        const vm = valueMatch(item, s), val = vm ? vm.v : null;
        const overlap = new Set(tokenize(s).filter(t => qtok.has(t))).size;
        const sc = score * (1 - 0.08 * rank) + overlap * 0.6 + (val ? 4 : 0) - s.length / 600 - (/^[a-z]/.test(s) ? 2 : 0);
        if (!best || sc > best.sc) best = { sc, s, val, raw: vm ? vm.raw : null, vm, chunk, ctx: sents.slice(k, k + 2).join(" ") };
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

  // ── 입찰 문서 묶음(패키지) ─────────────────────────────
  // 우선순위는 FIDIC 계열 PCC 1.5의 흔한 순서를 기본으로 한다. 추가 공고는 앞선 판을 바꾼다.
  const DOC_TYPES = [
    { code: "ADD", label: "추가 공고", en: "Addendum", rank: 0, re: /addendum|corrigendum|amendment no|추가\s*공고|정정\s*공고|변경\s*공고/i },
    { code: "CA", label: "계약서", en: "Contract Agreement", rank: 1, re: /contract agreement|form of agreement|계약서/i },
    { code: "CD", label: "계약 데이터(CD)", en: "Contract Data", rank: 2, re: /contract data|appendix to tender|계약\s*데이터/i },
    { code: "PCC", label: "특수조건(PCC)", en: "Particular Conditions", rank: 3, re: /particular conditions|special conditions|특수\s*조건|특약/i },
    { code: "GCC", label: "일반조건(GCC)", en: "General Conditions", rank: 4, re: /general conditions|일반\s*조건/i },
    { code: "BDS", label: "입찰 데이터 시트(BDS)", en: "Bid Data Sheet", rank: 5, re: /bid data sheet|tender data sheet|입찰\s*데이터/i },
    { code: "ITB", label: "입찰지침(ITB)", en: "Instructions to Bidders", rank: 5, re: /instructions to (?:bidders|tenderers)|invitation to (?:bid|tender)|request for (?:proposal|tender)|입찰\s*(?:안내|지침|공고)|입찰안내서/i },
    { code: "ER", label: "발주처 요구사항(ER)", en: "Employer's Requirements", rank: 6, re: /employer'?s requirements|과업\s*(?:지시|내용)/i },
    { code: "TS", label: "기술 시방(TS)", en: "Technical Specifications", rank: 7, re: /technical specification|시방서/i },
    { code: "APP", label: "부록·참고 자료", en: "Appendix", rank: 8, re: /appendix|annex|부록|별첨/i },
    { code: "ETC", label: "기타", en: "Document", rank: 9, re: /$^/ },
  ];
  const TYPE = Object.fromEntries(DOC_TYPES.map(t => [t.code, t]));
  function detectDocType(name, firstText) {
    const nm = String(name || "").replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ");
    for (const t of DOC_TYPES) if (t.re.test(nm)) return t.code;
    const head = String(firstText || "").slice(0, 500);
    for (const t of DOC_TYPES) if (t.re.test(head)) return t.code;
    return "ETC";
  }
  const addNo = (name, text) => { const m = (name + " " + String(text || "").slice(0, 300)).match(/(?:no\.?\s*|addendum\s*|#\s*)(\d+)|(\d+)\s*차/i); return m ? +(m[1] || m[2]) : 0; };

  const MONTH_N = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = n => String(n).padStart(2, "0");
  function isoDate(v) {
    let m;
    if ((m = v.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = v.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = v.match(new RegExp("(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + MONTHS + ")\\.?,?\\s+(20\\d{2})", "i")))) return `${m[3]}-${pad(MONTH_N[m[2].toLowerCase().slice(0, 3)] || MONTH_N[m[2].toLowerCase()])}-${pad(m[1])}`;
    if ((m = v.match(new RegExp("(" + MONTHS + ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})", "i")))) return `${m[3]}-${pad(MONTH_N[m[1].toLowerCase().slice(0, 3)])}-${pad(m[2])}`;
    return null;
  }
  function norm(item, value, sentence) {
    if (!value) return null;
    if (item.valueType === "percent") {
      const n = parseFloat(value); if (isNaN(n) || !/%/.test(value)) return value.length < 40 ? value.replace(/\s+/g, " ").toLowerCase() : null;
      if (item.key === "liquidated_damages") { const u = /\/일/.test(value) ? "d" : /\/주/.test(value) ? "w" : "?"; return u === "w" ? `${Math.round(n / 7 * 1e4) / 1e4}d` : `${n}${u}`; }
      return String(n);
    }
    if (item.valueType === "date") { const d = isoDate(value); if (!d) return null; const t = value.match(/(\d{1,2})[:.](\d{2})|(\d{1,2})\s*시/); return t ? `${d}T${pad(t[1] || t[3])}:${t[2] || "00"}` : d; }
    if (item.valueType === "duration") { const d = durationDays(value); if (d == null) return null; return d <= 120 ? String(Math.round(d)) : String(Math.round(d / 30.4)) + "mo"; }
    return null;
  }

  function buildPackage(docs) {
    docs.forEach((d, i) => {
      d.idx = i + 1;
      d.type = d.type || detectDocType(d.name, d.pages[0] && d.pages[0].text);
      d.addNo = d.type === "ADD" ? (addNo(d.name, d.pages[0] && d.pages[0].text) || i + 1) : 0;
      if (!d.chunks) d.chunks = chunkPages(d.pages);
      d.index = new BM25(d.chunks);
    });
    return { docs };
  }

  // 근거 문장을 실제로 관장하는 조항 제목(청크 안에서 문장 앞의 마지막 제목)
  // 반환: { sec: 조항 제목, sub: 문장 앞 가장 가까운 번호(예 1.2) }
  function sectionFor(chunk, sentence) {
    const key = sentence.slice(0, 24), lines = chunk.text.split("\n");
    let sec = chunk.start || "", sub = "", pos = 0;
    const flat = chunk.text.replace(/\s+/g, " "), at = flat.indexOf(key.replace(/\s+/g, " "));
    if (at < 0) return { sec: chunk.section, sub: "" };
    for (const l of lines) {
      if (pos > at) break;
      if (HEADING_RE.test(l) && l.trim().length < 100) sec = l.trim();
      const m = l.match(/^\s*(\d{1,2}(?:\.\d+)+)\.?\s/); if (m) sub = m[1];
      else if (HEADING_RE.test(l)) sub = "";
      pos += l.replace(/\s+/g, " ").length + 1;
    }
    return { sec, sub };
  }
  // 질의서에 쓰는 조항 인용(예: "Clause 14.3", "ITB 2.3")
  function clauseOf(c) {
    let m = c.evidence.match(/^(?:Sub-)?(?:Clause|Article|ITB|GCC|PCC)?\s*(\d+(?:\.\d+)+)\s/i) || c.evidence.match(/^(\d+(?:\.\d+)+)\s/);
    if (m) return `Clause ${m[1]}`;
    if (c.sub) return `Clause ${c.sub}`;
    m = (c.section || "").match(/((?:Sub-)?Clause|Article|Section)\s+([\dA-Z][\d.]*)/i); if (m) return `${m[1]} ${m[2].replace(/\.$/, "")}`;
    m = (c.section || "").match(/^(\d+(?:\.\d+)*)\.?\s/); if (m) return `Clause ${m[1]}`;
    m = (c.section || "").match(/제\s*\d+\s*[조장절]/); if (m) return m[0];
    return "";
  }
  const CHANGE_RE = /amend|shall (?:now )?read|is (?:hereby )?(?:replaced|changed|revised|modified|deleted)|replace[sd]? by|substitut|(?:is|are|has been) extended|postponed|변경|정정|개정|연장|수정한다|으로 한다/i;
  const NOCHANGE_RE = /not accepted|no change|remain(?:s)? unchanged|unchanged|is rejected|not agreed|불수용|변경\s*없|그대로/i;

  function candidateFor(item, d) {
    const b = bestSentence(item, d.index);
    if (!b) return null;
    let value = b.val;
    if (value == null && (item.valueType === "text" || item.key === "limitation_of_liability"))
      value = b.s.length <= 220 ? b.s : b.s.slice(0, 217) + "…";
    const sf = sectionFor(b.chunk, b.s);
    const c = { docId: d.id, docName: d.name, type: d.type, rank: rankOf(item, d.type), addNo: d.addNo, page: b.chunk.page, section: sf.sec, sub: sf.sub,
      value, raw: b.raw, evidence: b.s.slice(0, 600), ctx: b.ctx, sc: b.sc, norm: norm(item, value, b.s), amount: !!(b.vm && b.vm.amount) };
    c.clause = clauseOf(c);
    return c;
  }
  // 입찰 절차 항목은 입찰지침이 계약 문서보다 앞선다(추가 공고는 늘 맨 앞)
  const rankOf = (item, type) => (PROCEDURAL.has(item.key) && (type === "ITB" || type === "BDS")) ? (type === "BDS" ? 0.4 : 0.5) : TYPE[type].rank;
  const SEV = { high: 4, medium: 3, unknown: 2, low: 1, none: 0 };

  const LEGAL = new Set(["liquidated_damages", "ld_cap", "bid_bond", "performance_bond", "warranty", "retention", "advance_payment", "payment_terms"]);
  function analyzePackage(pkg, policy) {
    policy = policy || {};
    const items = ITEMS.map(item => {
      let cands = pkg.docs.map(d => candidateFor(item, d)).filter(c => c && c.value != null);
      // 추가 공고는 '바꾼다'는 문장일 때만 값 변경으로 본다(질의 회신·불수용 문장은 제외)
      cands = cands.filter(c => c.type !== "ADD" || (CHANGE_RE.test(c.evidence + " " + c.ctx) && !NOCHANGE_RE.test(c.evidence)));
      if (item.valueType === "text") cands = cands.length ? [cands.slice().sort((a, b) => b.sc - a.sc)[0]] : [];
      let applied = null, conflict = null;
      if (cands.length) {
        const distinct = [...new Set(cands.map(c => c.norm).filter(v => v != null))];
        const byRank = cands.slice().sort((a, b) => a.rank - b.rank || b.addNo - a.addNo || b.sc - a.sc);
        if (item.valueType === "text" || distinct.length <= 1) applied = byRank[0];
        else {
          const adds = cands.filter(c => c.type === "ADD").sort((a, b) => b.addNo - a.addNo);
          const values = byRank.map(c => ({ value: c.value, docName: c.docName, type: c.type, page: c.page, docId: c.docId, clause: c.clause }));
          if (adds.length) {
            applied = adds[0];
            conflict = { status: "addendum", values, rule: `추가 공고(${applied.docName})가 앞선 값을 바꿨습니다. 최신 판 값을 적용합니다.` };
          } else {
            applied = byRank[0];
            conflict = { status: "open", values, rule: `문서마다 값이 달라 적용 값을 정하지 않았습니다(값 미정). 우선순위로는 ${TYPE[applied.type].label} 값이 앞서지만, 질의 마감 전에 질의로 확인해야 합니다. 판정과 금액은 가장 불리한 값 기준입니다.` };
          }
        }
      }
      const base = { key: item.key, label: item.label, category: item.category, group: item.group, dept: item.dept, en: item.en, use: item.use, summary: "", source: "rule",
        candidates: cands.map(c => ({ docId: c.docId, docName: c.docName, type: c.type, page: c.page, value: c.value, raw: c.raw, evidence: c.evidence, section: c.section, clause: c.clause, amount: c.amount })) };
      if (!applied) {
        const [risk, reason] = assessRisk(item.key, null, "", "");
        const r = SEV[risk] >= SEV.medium ? risk : "unknown";
        return { ...base, found: false, value: "", raw: null, evidence: "", pages: [], docId: null, docName: "", docType: null, section: "", clause: "", conflict: null,
          risk: r, risk_reason: r === risk && reason ? reason : "문서에서 이 항목을 찾지 못했습니다." + (MUST.includes(item.key) ? " 질의로 확인해야 합니다." : "") };
      }
      let [risk, reason] = assessRisk(item.key, applied.value, applied.evidence, applied.ctx);
      let value = applied.value;
      if (policy.domestic && LEGAL.has(item.key)) { risk = "none"; reason = "국내 공공계약: 법령·계약예규가 정하는 값일 수 있어 해외 통상치로 판정하지 않습니다. 법정 기준과 같은지 계약법무가 확인하세요."; }
      if (conflict && conflict.status === "open") {
        // 가장 불리한 값 기준 판정
        let worst = null;
        for (const c of cands) { const [r2, why] = assessRisk(item.key, c.value, c.evidence, c.ctx); if (!worst || SEV[r2] > SEV[worst[0]]) worst = [r2, why, c]; }
        risk = SEV[worst[0]] >= SEV.medium ? worst[0] : "medium";
        reason = `값 미정(모순). ${worst[1] || ""}`.trim();
        value = "";
      }
      return { ...base, found: true, undetermined: !!(conflict && conflict.status === "open"), value, raw: applied.raw, evidence: applied.evidence,
        pages: [applied.page], docId: applied.docId, docName: applied.docName, docType: applied.type, section: applied.section, clause: applied.clause,
        conflict, risk, risk_reason: reason };
    });
    return items;
  }

  // 이탈 허용 여부·국내 공공계약 여부
  function policyOf(pkg) {
    const all = pkg.docs.map(d => d.pages.map(p => p.text).join("\n")).join("\n");
    const hangul = (all.match(/[가-힣]/g) || []).length, latin = (all.match(/[A-Za-z]/g) || []).length;
    const korean = hangul > latin;
    const domestic = korean && /국가를\s*당사자로|지방자치단체를\s*당사자로|조달청|공공기관|발주기관|입찰참가자격/.test(all);
    const m = all.match(/[^.\n]*(?:deviation|qualified bid|conditional (?:bid|tender))[^.\n]*(?:non-responsive|rejected|shall not be (?:permitted|considered|accepted)|not be permitted)[^.\n]*|[^.\n]*(?:조건부\s*입찰|이탈)[^.\n]*(?:무효|허용하지|불허)[^.\n]*/i);
    const listed = m && /not listed|unlisted|unless (?:stated|listed|included)|other than those (?:listed|stated)|not (?:included|stated) in the schedule/i.test(m[0]);
    const forbidden = !!m && !listed;
    let ev = ""; if (m) { const i = all.indexOf(m[0]); const ls = all.lastIndexOf("\n", i) + 1, le = all.indexOf("\n", i + m[0].length); ev = all.slice(ls, le < 0 ? undefined : le).trim().slice(0, 220); }
    return { korean, domestic, forbidden, evidence: forbidden ? ev : "",
      note: forbidden ? "입찰지침이 이탈을 허용하지 않아 이탈 요청 대신 질의로 바꿨습니다." : domestic ? "국내 공공계약은 계약 조건 이탈을 입찰서에 붙일 수 없어 질의(또는 이의 제기)로 바꿨습니다." : "" };
  }
  // 서로 다른 사업의 문서가 섞였는지: 입찰 번호가 다르거나 국문·영문 문서가 섞였을 때
  function mixWarning(pkg) {
    const nos = new Map(), langs = new Set();
    for (const d of pkg.docs) {
      const t = d.pages.map(p => p.text).join("\n");
      const m = t.match(/(?:Tender|Bid|Contract|RFP|ITB)\s*(?:No\.?|Number|Ref\.?)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})|공고\s*번호\s*[:：]?\s*([0-9A-Z\-]{4,})/i);
      if (m) nos.set(d.name, (m[1] || m[2]).toUpperCase());
      const h = (t.match(/[가-힣]/g) || []).length, l = (t.match(/[A-Za-z]/g) || []).length; if (h + l > 200) langs.add(h > l ? "ko" : "en");
    }
    if (new Set(nos.values()).size > 1) return `문서마다 입찰 번호가 다릅니다(${[...new Set(nos.values())].join(", ")}). 다른 입찰 건의 문서가 섞였다면 따로 올리세요. 섞인 채로 대조하면 모순이 잘못 잡힙니다.`;
    if (langs.size > 1) return "국문 문서와 영문 문서가 섞여 있습니다. 같은 입찰 건의 번역본이 아니라면 따로 올리세요. 섞인 채로 대조하면 모순이 잘못 잡힙니다.";
    return "";
  }

  // 다른 문서를 가리키는 참조 중 묶음에 없는 것
  const REF_RE = /\b(Appendix|Annex|Schedule|Volume|Vol\.)\s+([A-Z]|\d{1,2}|[IVX]{1,4})\b|(부록|별첨)\s*([A-Z0-9]{1,2})/g;
  function crossRefs(pkg) {
    const found = new Map();
    // 문서의 표제부: 파일명 + 첫 쪽에서 첫 번호 조항 앞까지의 줄(최대 6줄)
    const headOf = d => { const out = []; for (const l of (d.pages[0] ? d.pages[0].text.split("\n") : []).slice(0, 6)) { if (/^\s*(?:\d+(?:\.\d+)*\.?\s|Clause\b|제\s*\d)/.test(l)) break; out.push(l); }
      return (d.name.replace(/[_\-.]+/g, " ") + " " + out.join(" ")).toLowerCase(); };
    const heads = pkg.docs.map(headOf);
    pkg.docs.forEach((d, di) => { for (const p of d.pages) {
      for (const line of p.text.split("\n")) {
        for (const m of line.matchAll(REF_RE)) {
          const kind = m[1] ? m[1].replace("Vol.", "Volume") : m[3];
          const id = m[2] || m[4], target = `${kind} ${id}`;
          if (heads[di].includes(target.toLowerCase())) continue; // 문서 자신의 표제
          if (!found.has(target)) found.set(target, { target, refs: [] });
          const r = found.get(target);
          if (r.refs.length < 4) r.refs.push({ docId: d.id, docName: d.name, page: p.number, text: line.trim().slice(0, 220) });
        }
      }
    } });
    return [...found.values()].map(r => {
      const t = r.target.toLowerCase(), m = t.match(/^volume (\d+)$/);
      const present = heads.some(h => h.includes(t) || (m && new RegExp(`(^|\\s)v${m[1]}\\s`).test(h)));
      return { ...r, present };
    }).sort((a, b) => a.present - b.present || a.target.localeCompare(b.target));
  }

  // 받침에 맞춘 조사: josa("유보금","이","가") → "유보금이"
  function josa(w, a, b) { const t = String(w).trim(), c = t.charCodeAt(t.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return t + (((c - 0xac00) % 28) ? a : b);
    return t + (/[0-9LMNR]$/i.test(t) ? a : b); }
  const enVal = v => String(v).replace(/%\/일/, "% of the Contract Price per day").replace(/%\/주/, "% of the Contract Price per week");
  const cite = v => `${TYPE[v.type].en}${v.clause ? ", " + v.clause : ""}`;
  const citeKo = v => `${TYPE[v.type].label}${v.clause ? " " + v.clause : ""}`;
  function drafts(items, refs, policy) {
    policy = policy || {};
    const by = Object.fromEntries(items.map(i => [i.key, i]));
    const Q = [], D = [], ko = !!policy.korean;
    const q = (o) => Q.push({ docId: null, page: null, refs: [], ...o });
    for (const it of items) {
      if (!it.conflict || it.conflict.status !== "open") continue;
      const vs = it.conflict.values;
      q({ item: it.key, label: it.label, basis: "모순", owner: it.dept, refs: vs.map(v => ({ docId: v.docId, page: v.page, hl: (it.candidates.find(c => c.docId === v.docId) || {}).evidence || "" })),
        where: vs.map(v => `${citeKo(v)} (${v.docName} p.${v.page})`).join(" · "),
        en: ko ? `${josa(it.label, "이", "가")} ${vs.map(v => `${citeKo(v)}에는 ${v.value}`).join(", ")}(으)로 서로 다르게 기재되어 있습니다. 적용되는 값을 확인하여 주시고, 정정 공고로 일치시켜 주시기 바랍니다.`
          : `${vs.map(v => `${cite(v)} states ${enVal(v.value)}`).join(", whereas ")}. Please confirm the applicable ${it.en.toLowerCase()} and amend the Tender Documents by Addendum.`,
        ko: `${josa(it.label, "이", "가")} 문서마다 다릅니다: ${vs.map(v => `${citeKo(v)} ${v.value}`).join(" vs ")}. 적용 값을 확인하고 추가 공고로 정정해 달라고 요청합니다.` });
    }
    for (const k of MUST) {
      const it = by[k]; if (!it || it.found) continue;
      if (policy.domestic && (k === "retention" || k === "bid_currency")) continue; // 국내 공공계약에는 없는 제도·항목
      q({ item: k, label: it.label, basis: "조항 못 찾음", owner: it.dept, where: "입찰 문서 전체",
        en: ko ? `입찰 문서에서 ${it.label}에 관한 조항을 찾지 못하였습니다. 해당 조건과 근거 조항을 알려 주시기 바랍니다.` : `We could not find the ${it.en.toLowerCase()} in the Tender Documents. Please confirm the applicable requirement and the governing clause.`,
        ko: `${it.label} 조항을 찾지 못했습니다. 조건과 근거 조항을 확인 요청합니다.` });
    }
    for (const r of refs.filter(r => !r.present)) {
      const f = r.refs[0];
      q({ item: null, label: `빠진 참조 문서: ${r.target}`, basis: "빠진 참조 문서", owner: "영업", refs: [{ docId: f.docId, page: f.page, hl: f.text, line: true }], where: `${f.docName} p.${f.page}`,
        en: ko ? `입찰 문서가 ${r.target} 문서를 참조하나 배포된 입찰 문서에 포함되어 있지 않습니다. 해당 문서를 배포하여 주시기 바랍니다.` : `The Tender Documents refer to ${r.target}, which was not included in the documents issued to Bidders. Please issue ${r.target}.`,
        ko: `본문이 ${r.target} 문서를 참조하지만 받은 입찰 문서에 없습니다. 배포를 요청합니다.` });
    }
    const sd = by.site_data_reliance;
    if (sd && sd.found && sd.risk === "high") q({ item: sd.key, label: sd.label, basis: "리스크 높음", owner: sd.dept, refs: [{ docId: sd.docId, page: sd.pages[0], hl: sd.evidence }], where: `${citeKo(sd.candidates[0])} (${sd.docName} p.${sd.pages[0]})`,
      en: ko ? "입찰 시 제공된 현장·지반 자료를 설계와 가격 산정의 근거로 사용할 수 있는지, 자료가 실제와 다를 경우 비용은 누가 부담하는지 확인하여 주시기 바랍니다."
        : `Please confirm whether Bidders may rely on the site and geotechnical data issued with the Tender Documents (${cite(sd.candidates[0])}) for design and pricing, and which party bears the cost of any inaccuracy.`,
      ko: "제공된 현장·지반 자료를 설계·가격에 믿고 써도 되는지, 틀리면 비용은 누가 지는지 확인 요청합니다." });

    const pct = it => parseFloat(it.value);
    const DEV = {
      liquidated_damages: it => ["지체상금률을 일 0.1% 이하로 낮춤", "the rate of delay damages be reduced to 0.1% of the Contract Price per day of delay"],
      ld_cap: it => [it.found ? `지체상금 상한(현재 ${it.value || "값 미정"})을 10%로 낮춤` : "지체상금 상한을 계약금액의 10%로 정함", "the total amount of delay damages be limited to 10% of the Contract Price"],
      limitation_of_liability: it => [!it.found ? "총 책임 한도를 계약금액의 100%로 정함" : /unlimit|무제한|제한(?:하지| 없)/i.test(it.evidence) ? "무제한 책임을 계약금액의 100%로 제한" : `총 책임 한도(현재 ${isNaN(pct(it)) ? "문장 참조" : pct(it) + "%"})를 계약금액의 100%로 낮춤`, "the Contractor's total liability be limited to 100% of the Accepted Contract Amount, with indirect and consequential loss excluded"],
      price_adjustment: () => ["주요 자재(강재·동·연료)와 인건비에 물가변동 조정 공식을 넣음", "a price adjustment formula for steel, copper, fuel and labour indices be included"],
      payment_terms: it => [`기성 지급 기한(현재 ${it.value})을 56일 이하로 줄임`, "the period for payment of Interim Payment Certificates be reduced to 56 days"],
      warranty: it => [`하자담보기간(현재 ${it.value})을 24개월 이하로 줄임`, "the Defects Notification Period be limited to 24 months from Taking Over"],
      bid_bond: it => [`입찰보증(현재 ${it.value})을 2%로 낮춤`, "the Bid Security be reduced to 2% of the Bid Price"],
      performance_bond: it => [`이행보증(현재 ${it.value})을 10%로 낮춤`, "the Performance Security be reduced to 10% of the Contract Price"],
      retention: it => [`유보금(현재 ${it.value || "값 미정"})을 5%로 낮추고 인수 때 절반 반환`, "Retention Money be limited to 5% of the Contract Price, with half released at Taking Over"],
      advance_payment: () => ["선급금 10%를 선급금 보증과 교환으로 지급", "an advance payment of 10% of the Contract Price be made against an Advance Payment Guarantee"],
      site_data_reliance: () => ["발주처 조사 자료를 믿고 써도 되는 자료(RUI)로 지정", "the geotechnical and site data be designated as Rely Upon Information for which the Employer is responsible"],
      local_content: it => [`현지화 의무(현재 ${it.value})를 낮추거나 미달 시 제재를 협의로 바꿈`, "the local content requirement be reduced, or the sanction for shortfall be replaced with a negotiated remedy"],
    };
    const noDev = policy.forbidden || policy.domestic;
    for (const it of items) {
      if (it.risk !== "high" || !DEV[it.key] || it.undetermined || !it.found) continue; // 못 찾은 항목은 질의로 묻는다
      const [k, e] = DEV[it.key](it);
      const c = !it.found ? null : (it.candidates.find(x => x.docId === it.docId && x.page === it.pages[0]) ||
        { docId: it.docId, docName: it.docName, page: it.pages[0], type: it.docType || "ETC", clause: it.clause || "", evidence: it.evidence });
      const ref = c ? { docId: c.docId, page: c.page, hl: c.evidence } : null;
      const at = c ? `${citeKo(c)} (${c.docName} p.${c.page})` : "조항 없음";
      if (noDev) {
        if (Q.some(x => x.item === it.key)) continue; // 같은 항목 질의는 하나만
        q({ item: it.key, label: it.label, basis: "조건 완화 질의", owner: it.dept, refs: ref ? [ref] : [], where: at,
          en: ko ? `${it.label} 조건(${it.value || "조항 없음"})이 계약자에게 불리합니다. 다음과 같이 조정이 가능한지 검토하여 주시기 바랍니다: ${k}.` : `${c ? cite(c) : "The Tender Documents"}: we kindly request the Employer to consider that ${e}. Please confirm by Addendum.`,
          ko: `${k} (이탈 불가라 질의로 요청)` });
      } else {
        D.push({ item: it.key, label: it.label, basis: "리스크 높음", why: it.risk_reason, owner: it.dept, refs: ref ? [ref] : [], where: at, ko: k,
          en: `${c ? cite(c) : "Conditions of Contract"}: the Bidder requests that ${e}.` });
      }
    }
    Q.forEach((x, i) => x.id = "Q-" + pad(i + 1));
    D.forEach((x, i) => x.id = "D-" + pad(i + 1));
    return { Q, D, policy };
  }

  // 계약금액이 주어지면 비율 항목을 금액으로 바꾼다. 모순이면 범위로.
  function exposure(items, price) {
    if (!(price > 0)) return null;
    const by = Object.fromEntries(items.map(i => [i.key, i]));
    const pcts = it => { if (!it || !it.found) return []; const vals = (it.undetermined ? it.candidates.map(c => c.value) : [it.value]).filter(v => /^\s*[\d.]+\s*%/.test(v)).map(v => parseFloat(v)); return vals; };
    const row = (k, label, note) => { const it = by[k], v = pcts(it); if (!v.length) return { key: k, label, note, pct: null, lo: null, hi: null, item: it, fixed: it && it.found && it.candidates.some(c => c.amount) ? it.value : null };
      const lo = Math.min(...v), hi = Math.max(...v); return { key: k, label, note, pct: lo === hi ? `${g(lo)}%` : `${g(lo)}~${g(hi)}%`, lo: Math.round(price * lo / 100), hi: Math.round(price * hi / 100), item: it, range: lo !== hi }; };
    const ld = by.liquidated_damages, ldv = pcts(ld)[0], perDay = ld && ld.found && /\/일/.test(ld.value) ? ldv : (ld && /\/주/.test(ld.value) ? ldv / 7 : null);
    const cap = row("ld_cap", "지체상금 최대", "상한까지 늦을 때 내는 돈");
    const daily = perDay != null && !isNaN(perDay) ? { label: "지체상금 하루치", pct: `${g(Math.round(perDay * 1e4) / 1e4)}%/일`, lo: Math.round(price * perDay / 100), hi: Math.round(price * perDay / 100),
      note: cap.hi ? `약 ${Math.ceil(cap.lo / (price * perDay / 100))}일 늦으면 상한 도달` : "상한이 없으면 늦는 만큼 계속 늘어남", item: ld } : null;
    const adv = row("advance_payment", "선급금 보증", "받는 선급금과 같은 금액");
    const loss = [daily, cap, row("limitation_of_liability", "총 책임 한도", "계약 전체 최대 손실")].filter(Boolean);
    const bank = [row("bid_bond", "입찰보증", "입찰 중에만, 계약하면 반환"), row("performance_bond", "이행보증", "계약 후 인수까지"), adv];
    const cash = [{ ...row("advance_payment", "선급금 받음", "초기 현금 유입") }, row("retention", "유보금 묶임", "인수·하자 기간 뒤 반환")];
    const sum = arr => { const lo = arr.reduce((a, r) => a + (r.lo || 0), 0), hi = arr.reduce((a, r) => a + (r.hi || 0), 0); return { lo, hi }; };
    const unpriced = items.filter(i => i.risk === "high" && !["ld_cap", "liquidated_damages", "limitation_of_liability", "bid_bond", "performance_bond", "retention", "advance_payment"].includes(i.key));
    return { loss, bank, bankSum: sum(bank.slice(1)), bankSumLabel: "계약 후 동시 최대(이행+선급금 보증)", cash, unpriced };
  }

  const api = { ITEMS, MUST, josa, THRESHOLDS, CATEGORIES, GROUPS, DEPTS, DOC_TYPES, TYPE, detectDocType, buildPackage, analyzePackage, crossRefs, drafts, exposure, policyOf, mixWarning, isoDate, pseudoPages, chunkPages, buildDocument, tokenize, expandQuery, BM25, sentences, extractRules, assessRisk, offlineAnswer };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ITBEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
