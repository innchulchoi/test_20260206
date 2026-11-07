(() => {
"use strict";
const E = window.ITBEngine;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 판정 표시(한 곳에서만 정의해 모든 화면이 같은 말·색을 쓴다)
const RISK = { high: "높음", medium: "주의", low: "양호", none: "정보", unknown: "확인 필요" };
const RISK_HELP = { high: "입찰 전 질의·이탈·가격 반영이 필요한 조건", medium: "통상보다 불리해 주의가 필요한 조건", low: "업계 통상 범위의 조건", none: "판정 대상이 아닌 정보 항목(사업명·범위 등)", unknown: "문서에서 찾지 못했거나 단위가 불분명해 사람이 확인해야 하는 항목" };
const STATE = { open: ["모순", "f-open", "문서마다 값이 달라 적용 값이 정해지지 않음(값 미정)"], addendum: ["추가 공고 반영", "f-add", "추가 공고가 앞선 값을 바꿔 최신 판 값을 적용함"], miss: ["조항 못 찾음", "f-miss", "문서에서 이 항목의 조항을 찾지 못함"] };
const GCLS = { "일정": "g1", "입찰 절차": "g2", "상업 조건": "g3", "기술 조건": "g4", "일반": "g5" };
const CDN = "https://cdnjs.cloudflare.com/ajax/libs/";
const TABS = [["summary", "입찰 요약표"], ["issues", "모순·리스크"], ["drafts", "질의·이탈 초안"], ["source", "원문 형광펜"], ["teams", "부서별 전달"], ["ask", "문서에 질문"], ["docs", "문서 묶음"], ["guide", "처음이라면"]];
const ABBR = { CD: "Contract Data, 계약 데이터", PCC: "Particular Conditions of Contract, 계약 특수조건", GCC: "General Conditions of Contract, 계약 일반조건", ER: "Employer's Requirements, 발주처 요구사항", TS: "Technical Specifications, 기술 시방" };
const GLOSSARY = [["ITB", "발주처가 주는 입찰 문서 묶음 전체, 또는 그중 입찰 절차를 정한 권(Instructions to Bidders)"], ["BDS", "Bid Data Sheet. 입찰지침의 빈칸(마감·보증 등)을 채운 표"], ["추가 공고", "Addendum. 입찰 중에 발주처가 문서를 고치는 공고. 앞선 판보다 우선"], ["CD", "Contract Data. 계약조건의 빈칸(비율·기간·금액)을 채운 표"], ["PCC", "Particular Conditions. 일반조건을 이 사업에 맞게 고친 특수조건"], ["GCC", "General Conditions. FIDIC 같은 표준 일반조건"], ["ER", "Employer's Requirements. 발주처가 원하는 성능·범위"], ["TS", "Technical Specifications. 기술 시방서"], ["우선순위", "문서끼리 값이 다를 때 어느 문서를 따를지 정한 조항(보통 PCC 1.5)"], ["질의", "Clarification. 질의 마감 전에 모순·누락을 발주처에 묻는 공식 문서"], ["이탈", "Deviation. 입찰서의 이탈 목록에 '이 조건은 이렇게 바꿔 달라'고 적는 요청. 금지된 입찰도 있음"], ["지체상금", "Delay damages(LD). 준공이 늦으면 하루·주마다 내는 돈"], ["DNP", "Defects Notification Period. 인수 뒤 하자를 고칠 책임 기간(하자담보기간)"], ["RUI", "Rely Upon Information. 계약자가 믿고 설계·가격에 써도 되는 조사 자료"], ["EPC", "설계·조달·시공 일괄 계약. 턴키라고도 함"], ["FIDIC", "국제 건설 계약 표준 조건을 만드는 단체. Silver Book은 EPC/턴키용"], ["Lump sum", "총액 고정 계약. 물량 변동 위험을 계약자가 짐"], ["예비비", "Contingency. 위험이 실제로 생길 때를 대비해 가격에 넣는 돈"], ["PQ", "Prequalification/Qualification. 입찰 참가 자격(실적·매출·기술 요건). 못 맞추면 입찰 무효"], ["잠정금액", "Provisional Sum(PS). 입찰 때 금액을 확정하지 않고 나중에 실제 물량·금액으로 정산하는 항목"], ["가격표", "Schedule of Prices / BOQ. 총액을 공종·물량별로 나눠 적는 양식"], ["EL", "Expected Loss, 기대손실. 발생 확률 × 발생 시 손실. 여러 위험의 EL 합계가 예비비의 하한"], ["P90", "열 번 중 아홉 번은 넘지 않을 손실 금액. 분포를 가정해 구하므로 원가팀이 정함"], ["기술 이탈", "기술 요구사항을 그대로 맞추지 못할 때 대안을 제시하는 이탈(Technical deviation)"]];
const CURRENCIES = ["USD", "EUR", "KRW", "GBP", "JPY", "SAR", "AED"];

const st = { pkgs: [], cur: null, tab: "summary", group: "전체", rf: "all", open: new Set(), src: { doc: null, page: 1, focus: null },
  sample: null, tools: false, downloads: null, busy: null, pickInto: null };
let seq = 0;
const store = { get(k, d) { try { const v = localStorage.getItem("itbr:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("itbr:" + k, JSON.stringify(v)); } catch {} } };
const cur = () => st.pkgs.find(p => p.id === st.cur);

// ── 파일 읽기(브라우저 안에서만) ─────────────────────
const loaded = {};
function loadScript(src) {
  return loaded[src] ||= new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok;
    s.onerror = () => { delete loaded[src]; no(new Error("문서 해석 라이브러리를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 올려 주세요.")); }; document.head.appendChild(s); });
}
async function readPdf(buf, onp) {
  await loadScript(CDN + "pdf.js/3.11.174/pdf.min.js");
  await loadScript(CDN + "pdf.js/3.11.174/pdf.worker.min.js");
  const pdf = await window.pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise, pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent(); let text = "", lastY = null;
    for (const it of tc.items) { const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !text.endsWith("\n")) text += "\n";
      text += it.str; if (it.hasEOL) text += "\n"; if (y !== null) lastY = y; }
    pages.push({ number: i, text: text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() });
    if (onp && i % 10 === 0) onp(`${i}/${pdf.numPages}쪽`);
  }
  return pages;
}
async function readDocx(buf) { await loadScript(CDN + "mammoth/1.6.0/mammoth.browser.min.js");
  const { value } = await window.mammoth.extractRawText({ arrayBuffer: buf }); return E.pseudoPages(value.split(/\n+/).map(s => s.trim()).filter(Boolean)); }
async function readTxt(buf) { let t; try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { t = new TextDecoder("euc-kr").decode(buf); }
  return E.pseudoPages(t.split(/\n\s*\n/).filter(b => b.trim())); }

// ── 입찰 건(패키지) ───────────────────────────────
function analyze(pkg) {
  const live = pkg.docs.filter(d => d.pages && d.status === "done");
  pkg.built = E.buildPackage(live);
  pkg.policy = live.length ? E.policyOf(pkg.built) : {};
  pkg.items = live.length ? E.analyzePackage(pkg.built, pkg.policy) : [];
  pkg.refs = live.length ? E.crossRefs(pkg.built) : [];
  pkg.mix = live.length > 1 ? E.mixWarning(pkg.built) : "";
  pkg.drafts = E.drafts(pkg.items, pkg.refs, pkg.policy);
  pkg.claude = null; pkg.claudeDrafts = null; pkg.reqs = null; // 문서가 바뀌면 Claude 결과·다듬은 문장은 옛것이 되므로 버린다
}
function newPkg(name, sample) { const p = { id: "p" + (++seq), name, sample: !!sample, docs: [], chat: [], items: [], refs: [], drafts: { Q: [], D: [] }, policy: {} }; st.pkgs.push(p); return p; }
function addSamplePkg(s) {
  const p = newPkg(s.name, true);
  p.docs = s.docs.map((d, i) => ({ id: p.id + "d" + (i + 1), name: d.name, kind: d.kind, pages: d.pages, status: "done", type: d.type }));
  analyze(p); return p;
}
async function addFiles(files, intoPkg) {
  const all = [...files], ok = all.filter(f => /\.(pdf|docx|txt|md)$/i.test(f.name));
  if (!ok.length) return toast("PDF, DOCX, TXT 파일만 읽을 수 있습니다.");
  if (ok.length < all.length) toast(`${all.length - ok.length}개 파일은 형식이 맞지 않아 건너뜁니다.`);
  clearToast();
  const pkg = intoPkg || newPkg(ok.length === 1 ? ok[0].name.replace(/\.[^.]+$/, "") : `새 입찰 건 ${st.pkgs.length + 1}`);
  st.cur = pkg.id;
  const recs = ok.map(f => { const d = { id: pkg.id + "d" + (++seq), name: f.name, file: f, status: "reading", msg: "읽는 중" }; pkg.docs.push(d); return d; });
  go(pkg.items.length ? st.tab : "docs");
  for (const d of recs) {
    try {
      const buf = await d.file.arrayBuffer(), ext = d.file.name.split(".").pop().toLowerCase();
      d.pages = ext === "pdf" ? await readPdf(buf, m => { d.msg = m; renderTab(); }) : ext === "docx" ? await readDocx(buf) : await readTxt(buf);
      d.kind = ext === "pdf" ? "pdf" : "docx";
      if (!d.pages.some(p => p.text.trim())) throw new Error("글자를 읽지 못했습니다. 스캔 이미지 PDF는 OCR을 먼저 거쳐야 합니다.");
      d.status = "done";
    } catch (e) { d.status = "error"; d.msg = e.message || String(e); }
    delete d.file; renderAll();
  }
  analyze(pkg);
  const n = recs.filter(d => d.status === "done").length;
  if (n) toast(`문서 ${n}권을 분석했습니다.`);
  renderAll();
}

// ── 파생 값 ──────────────────────────────────────
const items = p => (p.claude ? p.claude.items : p.items);
const drafts = p => p.claudeDrafts || p.drafts;
const reviewKey = p => "review:" + p.name;
const review = p => store.get(reviewKey(p), {});
function setReview(p, key, on) { const r = review(p); if (on) r[key] = 1; else delete r[key]; store.set(reviewKey(p), r); }
function daysTo(iso) { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(iso + "T00:00:00") - t) / 864e5); }
function deadline(p, key) {
  const it = items(p).find(i => i.key === key); if (!it || !it.found) return { state: "none" };
  if (it.undetermined) return { state: "open", item: it };
  const iso = E.isoDate(it.value); return iso ? { state: "ok", iso, n: daysTo(iso), item: it } : { state: "none" };
}
const dtxt = d => d.state === "open" ? "미정(모순)" : d.state === "none" ? "-" : d.n >= 0 ? `D-${d.n}` : `${-d.n}일 지남`;
function counts(p) {
  const its = items(p), d = drafts(p), rv = review(p);
  return { high: its.filter(i => i.risk === "high").length, medium: its.filter(i => i.risk === "medium").length, unknown: its.filter(i => i.risk === "unknown").length,
    open: its.filter(i => i.undetermined).length, added: its.filter(i => i.conflict && i.conflict.status === "addendum").length,
    missRefs: p.refs.filter(r => !r.present).length, q: d.Q.length, d: d.D.length, found: its.filter(i => i.found).length, total: its.length,
    reviewed: its.filter(i => rv[i.key]).length, tech: techCands(p).length };
}
const typeLabel = c => (E.TYPE[c] || E.TYPE.ETC).label;
const docOf = (p, id) => p.docs.find(d => d.id === id);
const shortDoc = d => d.name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
// 문서 버튼 이름은 어디서나 같은 형식: "V2 Contract Data p.2". key가 "-"이면 항목 대신 그 문장(줄)을 칠한다.
function refBtn(p, docId, page, key, hl, target) {
  const d = docOf(p, docId); if (!d || !page) return "";
  return `<button class="docref" data-doc="${esc(docId)}" data-page="${page}" data-k="${esc(key || "")}" data-hl="${esc((hl || "").slice(0, 80))}"${target ? ` data-target="${esc(target)}"` : ""} title="${esc(d.name)} ${page}쪽 원문 보기">${esc(shortDoc(d))} p.${page}</button>`;
}
function flagsOf(it) {
  const f = [`<span class="flag r-${it.risk}" title="${esc(RISK_HELP[it.risk])}">${RISK[it.risk]}</span>`];
  if (it.undetermined) f.push(`<span class="flag ${STATE.open[1]}" title="${STATE.open[2]}">${STATE.open[0]}</span>`);
  else if (it.conflict && it.conflict.status === "addendum") f.push(`<span class="flag ${STATE.addendum[1]}" title="${STATE.addendum[2]}">${STATE.addendum[0]}</span>`);
  if (!it.found) f.push(`<span class="flag ${STATE.miss[1]}" title="${STATE.miss[2]}">${STATE.miss[0]}</span>`);
  return `<div class="fl">${f.join("")}</div>`;
}
const valOf = it => it.undetermined ? `<b class="miss" style="font-style:normal">값 미정</b> · ${esc(it.conflict.values.map(v => `${v.value}(${(E.TYPE[v.type] || {}).code || ""})`).join(" vs "))}` : it.found ? esc(it.value) : '<span class="miss">문서에서 찾지 못함</span>';
const valTxt = it => it.undetermined ? `값 미정: ${it.conflict.values.map(v => v.value).join(" vs ")}` : it.found ? it.value : "조항 못 찾음";
function currencyOf(p) {
  const saved = store.get("cur:" + p.name, null); if (saved) return saved;
  const bc = items(p).find(i => i.key === "bid_currency"), t = bc && bc.found ? bc.value : "";
  const m = t.match(/\b(USD|EUR|KRW|GBP|JPY|SAR|AED)\b|United States Dollars?|Euro|원화|Korean Won/i);
  if (m) return /dollar|USD/i.test(m[0]) ? "USD" : /euro|EUR/i.test(m[0]) ? "EUR" : /원화|won|KRW/i.test(m[0]) ? "KRW" : m[1].toUpperCase();
  return p.policy && p.policy.korean ? "KRW" : "USD";
}
// 원화는 경영진이 읽는 단위(조·억·만)로
// 1억 미만은 원 단위까지 정확히, 1억 이상은 만 원 단위로 반올림(노출액을 작게 보이게 버리지 않는다)
function korUnit(n) { n = Math.round(n); if (n < 1e4) return `${n.toLocaleString("ko-KR")}원`;
  if (n >= 1e8) n = Math.round(n / 1e4) * 1e4;
  const jo = Math.floor(n / 1e12), eok = Math.floor(n % 1e12 / 1e8), man = Math.floor(n % 1e8 / 1e4), won = n % 1e4, parts = [];
  if (jo) parts.push(`${jo.toLocaleString("ko-KR")}조`); if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`); if (man) parts.push(`${man.toLocaleString("ko-KR")}만`); if (won) parts.push(won.toLocaleString("ko-KR"));
  return parts.join(" ") + "원"; }
const money = (n, c) => n == null ? "-" : c === "KRW" ? korUnit(n) : `${c} ${Math.round(n).toLocaleString("en-US")}`;
const mrange = (r, c) => r.lo == null ? (r.fixed ? esc(r.fixed) : "-") : r.lo === r.hi ? money(r.lo, c) : `${money(r.lo, c)} ~<br>${money(r.hi, c)}`;
// "5억", "1조 2천억", "500,000,000", "500M", "1.2bn" → 숫자
// "5억", "5백억", "1조 2천억", "500,000,000", "500k", "1.2bn", "12 million 500 thousand" → 숫자. 못 읽으면 NaN.
function parseAmount(t) {
  t = String(t || "").replace(/,/g, "").replace(/(?:USD|EUR|KRW|GBP|JPY|SAR|AED|US\$|[$€₩£¥]|원)/gi, " ").trim();
  if (!t) return 0;
  if (/-/.test(t)) return NaN;
  const KO = { 조: 1e12, 억: 1e8, 만: 1e4 }, SUB = { 십: 10, 백: 100, 천: 1000 }, EN = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
  if (/\d*\.\d*\.|\.\D|\.$/.test(t)) return NaN; // 1.2.3 같은 숫자는 거부
  let total = 0, rest = t;
  if (/[조억만천백십]/.test(t)) {
    // 큰 단위(조·억·만)까지를 한 묶음으로 보고, 묶음 안의 천·백·십을 먼저 더한 뒤 큰 단위를 곱한다: 3천5백억 = (3000+500)×1억
    rest = t.replace(/((?:\s*[\d.]*\s*(?:십|백|천)?)+?)\s*(조|억|만|$)/g, (m, grp, big) => {
      if (!grp.trim()) return big ? m : "";
      let sub = 0, left = grp.replace(/([\d.]+)?\s*(십|백|천)/g, (mm, n, u) => { sub += (n ? parseFloat(n) : 1) * SUB[u]; return " "; });
      const plain = left.match(/[\d.]+/g); if (plain) { sub += parseFloat(plain.join("")); left = left.replace(/[\d.]+/g, " "); }
      total += sub * (big ? KO[big] : 1); return left; });
  } else {
    rest = t.replace(/([\d.]+)\s*(thousand|million|billion|mil|mn|bn|k|m|b)?\b/gi, (m, n, u) => { total += parseFloat(n) * (u ? EN[u.toLowerCase()] : 1); return " "; });
  }
  if (rest.replace(/\s+/g, "") || !isFinite(total)) return NaN;
  return Math.round(total);
}
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ── 렌더 ─────────────────────────────────────────
function renderAll() { paintEngine(); renderPkgbar(); renderTabs(); renderTab(); }
function paintEngine() { const el = $("#engine"); el.className = "pill" + (st.sample ? " on" : ""); el.lastChild.textContent = st.sample ? "Claude 연결됨" : "규칙 엔진만"; el.title = st.sample ? "Claude 정밀 분석·질문·문장 다듬기를 쓸 수 있습니다(보는 사람의 Claude 사용량 사용)" : "claude.ai에서 열면 Claude 기능이 켜집니다"; }
function renderPkgbar() {
  const p = cur(), qd = p && p.items.length ? deadline(p, "clarification_deadline") : { state: "none" }, bd = p && p.items.length ? deadline(p, "bid_due_date") : { state: "none" };
  $("#pkgbar").innerHTML = `
    <div class="pkgsel" role="group" aria-label="입찰 건">${st.pkgs.map(x => `<button class="pkgbtn" data-pkg="${x.id}" aria-current="${x.id === st.cur}">${esc(x.name)}<span class="t">${x.sample ? "가상 샘플 · " : ""}문서 ${x.docs.length}권</span></button>`).join("")}</div>
    <span class="grow"></span>
    ${qd.state !== "none" || bd.state !== "none" ? `<span class="dday ${[qd, bd].some(x => x.state === "ok" && x.n <= 14 && x.n >= 0) ? "soon" : ""}" title="질의 마감 ${esc(qd.iso || dtxt(qd))} · 입찰 마감 ${esc(bd.iso || dtxt(bd))}">질의 ${dtxt(qd)} · 입찰 ${dtxt(bd)}</span>` : ""}
    <button class="btn" id="b-add" ${p ? "" : "disabled"}><span class="lg">이 건에 </span>문서 추가</button>
    <button class="btn primary" id="b-new">새 입찰 건<span class="lg"> 올리기</span></button>`;
  $$(".pkgbtn").forEach(b => b.onclick = () => { clearToast(); st.cur = b.dataset.pkg; st.open = new Set(); st.src = { doc: null, page: 1, focus: null }; renderAll(); });
  $("#b-new").onclick = () => { st.pickInto = null; $("#file").click(); };
  $("#b-add").onclick = () => { st.pickInto = cur(); $("#file").click(); };
}
function issueCount(c) { return c.open + c.missRefs + c.high + (c.tech || 0); }
function renderTabs() {
  const p = cur(), c = p && p.items.length ? counts(p) : null;
  const badge = { issues: c ? issueCount(c) : 0, drafts: c ? c.q + c.d + c.tech : 0 };
  const tip = { issues: c ? `확인할 것 ${issueCount(c)}: 모순 ${c.open} + 빠진 참조 문서 ${c.missRefs} + 높음 ${c.high}${c.tech ? ` + 기술 조건부·부적합 ${c.tech}` : ""}` : "", drafts: c ? `질의 ${c.q} + 이탈 ${c.d}${c.tech ? ` + 기술 후보 ${c.tech}` : ""}` : "" };
  $("#tabs").innerHTML = TABS.map(([id, label], i) => `<a href="#${id}" role="tab" id="t-${id}" aria-controls="p-${id}" aria-selected="${st.tab === id}" tabindex="${st.tab === id ? 0 : -1}" ${tip[id] ? `title="${tip[id]}"` : ""}><span class="n">${String(i + 1).padStart(2, "0")}</span>${label}${badge[id] ? `<span class="c ${id === "issues" && c.open ? "hot" : ""}">${badge[id]}</span>` : ""}</a>`).join("");
  TABS.forEach(([id]) => { const s = $("#p-" + id); s.hidden = id !== st.tab; s.setAttribute("aria-labelledby", "t-" + id); });
  const a = $(`#t-${st.tab}`); if (a) { const nav = $("#tabs"), l = a.offsetLeft, r = l + a.offsetWidth; if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = l - 16; }
}
$("#tabs").addEventListener("keydown", e => { if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; e.preventDefault();
  const i = TABS.findIndex(t => t[0] === st.tab), n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length][0]; go(n); $(`#t-${n}`).focus(); });
function go(tab, scroll = true) { if (!TABS.some(t => t[0] === tab)) tab = "summary"; st.tab = tab; if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab); renderTabs(); renderTab(false); if (scroll) window.scrollTo({ top: 0 }); }
window.addEventListener("hashchange", () => go(location.hash.slice(1) || "summary"));
$("#tabs").addEventListener("click", e => { const a = e.target.closest("a[role=tab]"); if (!a) return; e.preventDefault(); go(a.id.slice(2)); });
// 같은 화면을 다시 그릴 때는 스크롤 위치와 포커스를 지킨다
function focusSel(el) {
  if (!el || el === document.body) return null;
  for (const a of ["data-rv", "data-k", "data-grp", "data-rf", "data-copy", "data-team", "data-type", "data-q", "data-req", "data-el", "data-tc"]) if (el.hasAttribute && el.hasAttribute(a)) return `${el.tagName.toLowerCase()}[${a}="${CSS.escape(el.getAttribute(a))}"]`;
  return el.id ? "#" + CSS.escape(el.id) : null;
}
function renderTab(keep = true) {
  const p = cur(), el = $("#p-" + st.tab), y = window.scrollY, ae = document.activeElement, fs = keep ? focusSel(ae) : null;
  const typing = keep && ae && ae.tagName === "INPUT" && ae.type !== "checkbox" ? { v: ae.value, a: ae.selectionStart, b: ae.selectionEnd } : null;
  if (!p) { el.innerHTML = `<div class="card pad">입찰 문서를 올려 주세요.</div>`; return; }
  const busy = p.docs.filter(d => d.status === "reading");
  const wait = busy.length ? `<div class="card pad small" style="margin-bottom:12px"><span class="spin"></span> 문서 ${busy.length}권을 읽는 중입니다. ${esc(busy[0].name)} ${esc(busy[0].msg || "")}</div>` : "";
  const fn = { summary: vSummary, issues: vIssues, drafts: vDrafts, source: vSource, teams: vTeams, ask: vAsk, docs: vDocs, guide: vGuide }[st.tab];
  if (!p.items.length && !["docs", "guide"].includes(st.tab)) { el.innerHTML = wait + `<div class="card pad">아직 분석한 문서가 없습니다. <button class="btn sm" data-go="docs">07 문서 묶음으로</button></div>`; bindCommon(el); return; }
  st.rendering = true; const html = wait + fn(p); el.innerHTML = html; st.rendering = false; // 교체 중 사라지는 입력칸이 change를 내도 무시
  bindCommon(el); (bind[st.tab] || (() => {}))(p, el);
  if (keep) { window.scrollTo({ top: y }); if (fs) { const f = $(fs, el); if (f) { f.focus({ preventScroll: true }); if (typing && f.tagName === "INPUT") { f.value = typing.v; try { f.setSelectionRange(typing.a, typing.b); } catch {} f.dispatchEvent(new Event("validate")); } } } }
}
function bindCommon(el) {
  $$("[data-go]", el).forEach(b => b.onclick = () => go(b.dataset.go));
  $$("[data-goq]", el).forEach(b => b.onclick = () => { go("drafts"); const c = $(`#p-drafts [data-card="${b.dataset.goq}"]`); if (c) { const top = c.getBoundingClientRect().top + window.scrollY - ($(".tabbar").offsetHeight || 0) - 12; window.scrollTo({ top }); c.classList.add("flash"); c.setAttribute("tabindex", "-1"); c.focus({ preventScroll: true }); setTimeout(() => c.classList.remove("flash"), 1600); } });
  $$(".docref[data-doc]", el).forEach(b => b.onclick = e => { e.stopPropagation(); openSource(b.dataset.doc, +b.dataset.page, b.dataset.k, b.dataset.hl, b.dataset.target); });
}
const bind = {};

// 01 입찰 요약표
function vSummary(p) {
  const c = counts(p), its = items(p), rv = review(p), cc = currencyOf(p), price = store.get("price:" + p.name, 0), docsN = p.built.docs.length;
  const top = its.filter(i => i.risk === "high" || i.undetermined).sort((a, b) => (b.undetermined - a.undetermined));
  const legal = its.filter(i => i.found && i.risk === "none" && /^국내 공공계약/.test(i.risk_reason || ""));
  const unk = its.filter(i => i.risk === "unknown"), unkQ = unk.filter(i => drafts(p).Q.some(q => q.item === i.key)).length;
  const unkRest = unk.filter(i => !drafts(p).Q.some(q => q.item === i.key) && !(i.key === "prequalification" && i.found)).length;
  const ex = E.exposure(its, price);
  const vis = its.filter(i => (st.group === "전체" || i.group === st.group) && (st.rf === "all" || (st.rf === "flag" ? (i.risk === "high" || i.risk === "medium" || i.risk === "unknown" || i.undetermined) : !rv[i.key])));
  let rows = "";
  for (const g of E.GROUPS) {
    const gi = vis.filter(i => i.group === g); if (!gi.length) continue;
    rows += `<tr class="grp"><td colspan="6">${esc(g)} <span class="tiny">· ${gi.length}개</span></td></tr>`;
    for (const it of gi) {
      const o = st.open.has(it.key), done = !!rv[it.key], cand = it.candidates.find(x => x.docId === it.docId);
      rows += `<tr class="row ${done ? "done" : ""} ${it.undetermined ? "hi-c" : it.risk === "high" ? "hi" : ""}" data-k="${it.key}" tabindex="0" aria-expanded="${o}">
        <td class="lab"><span class="car">${o ? "▾" : "▸"}</span>${esc(it.label)}</td>
        <td class="val">${valOf(it)}${it.summary ? `<div class="s">${esc(it.summary)}</div>` : ""}</td>
        <td class="flags">${flagsOf(it)}</td>
        <td class="refc">${it.undetermined ? it.conflict.values.map(v => refBtn(p, v.docId, v.page, it.key, (it.candidates.find(x => x.docId === v.docId) || {}).evidence, (E.TYPE[v.type] || {}).code)).join(" ") : it.found ? refBtn(p, it.docId, it.pages[0], it.key, it.evidence) : ""}</td>
        <td class="small dep">${esc(it.dept)}</td>
        <td class="ck"><input type="checkbox" data-rv="${it.key}" ${done ? "checked" : ""} aria-label="${esc(it.label)} 검토 완료"></td></tr>`;
      if (o) rows += `<tr class="det"><td colspan="6">
        ${it.risk_reason ? `<div><b>판정 이유</b> · ${esc(it.risk_reason)}</div>` : ""}
        ${it.conflict ? `<div class="banner ${it.undetermined ? "warn" : ""}" style="margin:6px 0">${esc(it.conflict.rule)}</div>` : ""}
        ${it.evidence ? `<div class="quote">${esc(it.evidence)}</div>` : ""}
        ${it.candidates.length > 1 ? `<div class="cands"><b class="small">문서별 값</b>${it.candidates.map(cd => `<div class="cand ${!it.undetermined && cd.docId === it.docId ? "applied" : ""}"><span class="vv">${esc(cd.value)}</span><span class="tiny muted">${esc(typeLabel(cd.type))}${cd.clause ? " " + esc(cd.clause) : ""}</span>${refBtn(p, cd.docId, cd.page, it.key, cd.evidence)}${!it.undetermined && cd.docId === it.docId ? '<span class="tiny">← 적용</span>' : ""}</div>`).join("")}</div>` : ""}
        <div class="tiny muted" style="margin-top:6px">쓰임: ${esc(it.use)} · 담당 ${esc(it.dept)}${cand && cand.clause ? ` · 근거 조항 ${esc(cand.clause)}` : ""} · 추출 ${it.source === "claude" ? "Claude" : "규칙 엔진"}${it.rule_value !== undefined && it.rule_value !== it.value ? ` (규칙 엔진 값 ${esc(it.rule_value || "없음")})` : ""}</div></td></tr>`;
    }
  }
  const claudeBusy = st.busy && st.busy.kind === "extract";
  const sec = (title, rowsX, sum) => `<h4>${title}</h4><table><tbody>${rowsX.map(r => `<tr><td>${esc(r.label)}<div class="tiny muted">${esc(r.note || "")}</div></td><td class="num">${esc(r.pct || (r.fixed ? "정액" : "-"))}</td><td class="num">${mrange(r, cc)}${r.range ? ' <span class="flag f-open">모순</span>' : ""}</td></tr>`).join("")}${sum ? `<tr class="sum"><td>${esc(ex.bankSumLabel)}</td><td></td><td class="num">${mrange(sum, cc)}</td></tr>` : ""}</tbody></table>`;
  return `
  <div class="sec-h"><h2>입찰 요약표</h2><span class="muted small">${esc(p.name)} · 문서 ${docsN}권 · ${p.claude ? "Claude 분석" : "규칙 엔진 추출"}</span></div>
  <p class="lede">${docsN}권에서 ${c.total}개 항목 중 <b>${c.found}개</b>를 찾았습니다${c.total - c.found ? `(못 찾은 ${c.total - c.found}개는 '확인 필요')` : ""}. ${docsN > 1 ? "같은 항목을 문서끼리 대조해, 값이 다르면 적용 값을 정하지 않고 <b>모순(값 미정)</b>으로 올립니다." : "문서가 1권이라 문서 간 대조는 하지 않았습니다."} 쪽 번호를 누르면 원문에서 그 자리가 칠해져 보입니다.</p>
  <div class="stack">
  ${p.mix ? `<div class="banner warn">${esc(p.mix)}</div>` : ""}
  <div class="keys">
    <div><div class="k">질의 마감 · 입찰 마감</div><div class="v">${dtxt(deadline(p, "clarification_deadline"))}</div><div class="n">입찰 마감 ${dtxt(deadline(p, "bid_due_date"))}</div></div>
    <div><div class="k">높음</div><div class="v ${c.high ? "high" : ""}">${c.high}</div><div class="n">주의 ${c.medium} · 확인 필요 ${c.unknown}</div></div>
    <div><div class="k">모순(값 미정)</div><div class="v ${c.open ? "conflict" : ""}">${c.open}</div><div class="n">추가 공고로 해소 ${c.added}</div></div>
    <div><div class="k">질의 초안</div><div class="v">${c.q}</div><div class="n">빠진 참조 문서 ${c.missRefs}${c.tech ? ` · 기술 후보 ${c.tech}` : ""}</div></div>
    <div><div class="k">이탈 초안</div><div class="v">${c.d}</div><div class="n">${p.policy.domestic ? "국내 공공계약: 이탈 없음" : p.policy.forbidden ? `이탈 불가 → 완화 질의 ${drafts(p).Q.filter(q => q.basis === "조건 완화 질의").length}건` : "높음 판정에서"}${techCands(p).some(x => x.st === "no") ? ` · 기술 이탈 후보 ${techCands(p).filter(x => x.st === "no").length}` : ""}</div></div>
    <div><div class="k">검토 완료</div><div class="v">${c.reviewed}/${c.total}</div><div class="n">담당자가 근거를 보고 체크</div></div>
  </div>
  <div class="verdict">
    <div class="card pad"><div class="h3">입찰 전에 먼저 볼 것 ${top.length ? `<span class="muted small">높음·모순 ${top.length}건</span>` : ""}</div>
      ${p.claude && p.claude.overall ? `<p style="margin-bottom:10px">${esc(p.claude.overall)}</p>` : ""}
      ${top.length ? `<ul class="toplist">${top.map(i => `<li>${i.undetermined ? `<span class="flag f-open">모순</span>` : `<span class="flag r-high">높음</span>`}<span><b>${esc(i.label)}</b> ${esc(i.undetermined ? i.conflict.values.map(v => `${typeLabel(v.type)} ${v.value}`).join(" vs ") : i.risk_reason)}</span></li>`).join("")}</ul>` : `<p class="muted">자동 판정상 높음·모순이 없습니다${legal.length ? "(법정 기준 항목은 판정에서 뺌)" : ""}.</p>`}
      ${legal.length ? `<p class="small" style="margin-top:8px"><span class="flag r-none">정보</span> <b>법정 기준 항목(판정 안 함)</b>: ${esc(legal.map(i => `${i.label} ${i.value}`).join(", "))}. 금액은 오른쪽 표, 법정 기준과 같은지는 계약법무가 확인합니다.</p>` : ""}
      ${unk.length ? `<p class="small" style="margin-top:6px"><span class="flag r-unknown">확인 필요</span> <b>${unk.length}건</b>: ${esc(unk.map(i => i.label).join(", "))}. ${[unkQ ? `${unkQ}건은 질의 초안이 있습니다.` : "", unk.some(i => i.key === "prequalification" && i.found) ? "PQ는 아래 결재·통제 첫 줄에서 다룹니다." : "", unkRest ? `${unkRest}건은 담당자가 판단합니다.` : ""].filter(Boolean).join(" ")}</p>` : ""}
      <div class="btns" style="margin-top:12px"><button class="btn sm" data-go="issues">02 모순·리스크</button><button class="btn sm" data-go="drafts">03 질의·이탈 초안 ${c.q + c.d + c.tech}건</button>
      ${st.sample ? (claudeBusy ? `<span class="small muted"><span class="spin"></span> ${esc(st.busy.msg)}</span><button class="btn sm" id="stop">중지</button>` : `<button class="btn sm primary" id="deep" ${st.busy ? "disabled" : ""}>${p.claude ? "Claude로 다시 분석" : "Claude로 정밀 분석"}</button>`) : ""}</div>
      <div class="h3" style="margin-top:16px">제출 전 결재·통제</div>
      <ul class="ctl">${controlList(p, c)}</ul>
    </div>
    <div class="card pad exp"><div class="h3">금액으로 보기</div>
      <div class="priceinp"><label for="price" class="small">예상 계약금액</label><select class="sel" id="curr" aria-label="통화">${CURRENCIES.map(x => `<option ${x === cc ? "selected" : ""}>${x}</option>`).join("")}</select><input class="inp" id="price" inputmode="decimal" placeholder="예: 5억, 500M" value="${price ? price.toLocaleString("en-US") : ""}" aria-label="예상 계약금액" aria-describedby="pricehint"><span class="tiny muted" id="pricehint" role="status">${price ? `= ${money(price, cc)}` : ""}</span></div>
      ${ex ? sec("최대 손실 노출", ex.loss) + sec("은행 보증 한도(발급 필요)", ex.bank, ex.bankSum) + sec("현금흐름", ex.cash)
        + (ex.unpriced.length ? `<p class="small" style="margin-top:8px"><b>금액으로 못 바꾼 높음 리스크</b>: ${esc(ex.unpriced.map(i => i.label).join(", "))}. 아래 '기대손실(EL)·예비비' 표에 원가팀 추정을 넣으세요.</p>` : "")
        + `<p class="tiny muted" style="margin-top:6px">비율 × 계약금액 단순 환산입니다. 모순 항목은 문서별 값의 범위로 보여 줍니다.</p>`
        : `<p class="small muted">계약금액을 넣으면 지체상금(하루치·최대), 책임 한도, 보증 한도, 선급금·유보금을 금액으로 보여 줍니다.</p>`}
    </div>
  </div>
  ${elTable(p, its, cc, price)}
  <div class="card pad">
    <div class="btns" style="margin-bottom:8px">${["전체", ...E.GROUPS].map(g => `<button class="chip" data-grp="${esc(g)}" aria-pressed="${st.group === g}">${esc(g)}</button>`).join("")}
      <span class="grow"></span>${[["all", "모두"], ["flag", "확인할 것만"], ["todo", "검토 안 한 것"]].map(([k, l]) => `<button class="chip" data-rf="${k}" aria-pressed="${st.rf === k}">${l}</button>`).join("")}</div>
    <div class="tscroll"><table class="t"><thead><tr><th>항목</th><th>적용 값</th><th>판정</th><th>근거</th><th>담당</th><th>검토</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">조건에 맞는 항목이 없습니다.</td></tr>'}</tbody></table></div>
    <div class="btns" style="margin-top:10px">${st.downloads ? `<button class="btn sm" id="csv">요약표 CSV 저장</button>` : ""}<button class="btn sm" id="copy">요약표 복사(엑셀용)</button><span class="tiny muted">${st.downloads ? "" : "CSV 저장은 claude.ai에서 열 때 쓸 수 있습니다. "}검토 체크는 이 브라우저에만 저장됩니다.</span></div>
  </div></div>`;
}
// 기대손실(EL) = 발생 확률 × 발생 시 손실. 확률·손실은 원가팀이 넣는다(브라우저에 저장).
// 유보금·선급금·지급 기한은 손실이 아니라 자금 묶임이라 EL에서 뺀다. 지체상금 손실은 상한에서 멈춘다.
const CASH_KEYS = new Set(["retention", "advance_payment", "payment_terms"]);
function elCap(p, its, price) { const c = its.find(i => i.key === "ld_cap"); const v = c && c.found ? (c.undetermined ? Math.max(...c.candidates.map(x => parseFloat(x.value)).filter(x => !isNaN(x))) : parseFloat(c.value)) : NaN; return price > 0 && isFinite(v) ? price * v / 100 : null; }
function elRows(p, its, price) {
  const v = store.get("el:" + p.name, {}), cap = elCap(p, its, price);
  return its.filter(i => (i.risk === "high" || i.undetermined) && !CASH_KEYS.has(i.key)).map(i => { const x = v[i.key] || {}, pr = Number(x.p) || 0; let a = Number(x.a) || 0, capped = false;
    if (i.key === "liquidated_damages" && cap != null && a > cap) { a = cap; capped = true; }
    return { i, x, pr, a, el: pr / 100 * a, capped, cap }; });
}
// 아직 저장하지 않은(잘못된 값 포함) 입력 원문: 다른 칸이 다시 그려져도 사용자가 친 글자를 지킨다
const ELT = {};
function parseEl(f, raw, cc) {
  raw = String(raw || "").trim(); if (!raw) return { n: "", err: "" };
  if (/-/.test(raw)) return { err: "음수는 넣을 수 없습니다." };
  if (f === "p") { const n = /^\d+(?:\.\d+)?\s*%?$/.test(raw) ? parseFloat(raw) : NaN;
    return !Number.isFinite(n) ? { err: "확률은 숫자로 넣어 주세요(0~100)." } : n > 100 ? { err: "확률은 0~100% 사이로 넣어 주세요." } : { n, err: "" }; }
  const n = parseAmount(raw); return Number.isFinite(n) ? { n, err: "" } : { err: `금액으로 읽을 수 없습니다(${cc === "KRW" ? "예: 2억, 5천만" : "예: 20M, 1.5bn"}).` };
}
const rawOf = (p, k, f) => { const r = (st.elRaw || {})[p.id + ":" + k + "|" + f]; return r ? r.v : undefined; };
const rawBad = (p, k) => ["p", "a"].some(f => { const r = (st.elRaw || {})[p.id + ":" + k + "|" + f]; return r && parseEl(f, r.v, currencyOf(p)).err; });
function elTable(p, its, cc, price) {
  const rows = elRows(p, its, price), cash = its.filter(i => (i.risk === "high" || i.undetermined) && CASH_KEYS.has(i.key));
  const sum = rows.reduce((s, r) => s + r.el, 0), full = rows.reduce((s, r) => s + r.a, 0);
  const body = rows.length ? rows.map(({ i, x, el, capped, cap }) => `<div class="elrow">
      <div class="elname">${esc(i.label)}${i.undetermined ? ' <span class="flag f-open">모순</span>' : ""}</div>
      <label class="elf"><span class="tiny muted">발생 확률(%)</span><input class="inp eli" data-el="${i.key}|p" inputmode="decimal" value="${esc(rawOf(p, i.key, "p") ?? (x.p ?? ""))}" placeholder="0~100" aria-label="${esc(i.label)} 발생 확률(%)"></label>
      <label class="elf"><span class="tiny muted">발생 시 손실(${cc})</span><input class="inp eli" data-el="${i.key}|a" inputmode="decimal" value="${esc(rawOf(p, i.key, "a") ?? (x.a ? Number(x.a).toLocaleString("en-US") : ""))}" placeholder="${cc === "KRW" ? "예: 2억, 5천만" : "예: 20M, 1.5bn"}" aria-label="${esc(i.label)} 발생 시 손실"></label>
      <div class="elv ${rawBad(p, i.key) ? "stale" : ""}"><span class="tiny muted">EL</span> <b class="mono">${el ? money(el, cc) : "-"}</b><div class="tiny muted elnote" ${rawBad(p, i.key) ? "" : "hidden"}>마지막으로 읽은 값 기준</div></div>
      <div class="elmsg tiny" data-msg="${i.key}|p" role="status"></div><div class="elmsg tiny" data-msg="${i.key}|a" role="status"></div>${capped ? `<div class="elmsg tiny">지체상금 상한(${money(cap, cc)})을 넘어 상한으로 계산했습니다.</div>` : ""}</div>`).join("")
    : `<p class="small muted">높음·모순 항목이 없어 기대손실 표가 없습니다${p.policy && p.policy.domestic ? "(법정 기준 항목은 판정에서 뺌)" : ""}.</p>`;
  return `<details class="card pad elx" ${st.elOpen !== false ? "open" : ""} id="elbox"><summary class="h3" style="margin:0">기대손실(EL)·예비비 <span class="muted small">담당자 입력${rows.length ? ` · ${rows.length}개 위험` : ""}</span></summary>
    <p class="tiny muted" style="margin:6px 0 4px">EL = 발생 확률 × 발생 시 손실. 확률과 손실액은 원가팀이 넣습니다(도구가 확률을 정하지 않음, 이 브라우저에 저장). P90 같은 분포 기반 예비비는 원가팀이 따로 정합니다.${cash.length ? ` ${esc(cash.map(i => i.label).join("·"))}은 손실이 아니라 자금 묶임이라 뺐습니다(금액 표의 현금흐름 참고).` : ""}</p>
    ${body}
    ${rows.length ? `<div class="elsum"><div><span class="small">EL 합계</span> <span class="tiny muted">예비비 권고 하한</span></div><b class="mono">${sum ? money(sum, cc) : "-"}</b></div>
    <div class="elsum sub"><div><span class="small">모두 발생할 때 손실 합계</span> <span class="tiny muted">최악 참고값</span></div><span class="mono">${full ? money(full, cc) : "-"}</span></div>` : ""}
    ${price ? "" : '<p class="tiny muted">위 금액 칸에 계약금액을 넣으면 지체상금 손실이 상한에서 멈추도록 계산합니다.</p>'}</details>`;
}
// 금액 입력 해석 보조: "1억5천"처럼 만 단위를 빠뜨린 표기 안내
function amountHint(t) { return /억\s*\d+\s*천\s*$/.test(String(t).trim()) ? " · 1억 5천만을 뜻하면 '만'까지 써 주세요." : ""; }
function controlList(p, c) {
  const d = drafts(p), qdl = deadline(p, "clarification_deadline"), its = items(p), out = [];
  const highs = its.filter(i => i.risk === "high" && !i.undetermined).map(i => i.label);
  if (d.Q.length) out.push(`질의 ${d.Q.length}건${c.open || c.missRefs ? `(모순 ${c.open}·빠진 참조 문서 ${c.missRefs} 포함)` : ""}을 <b>질의 마감${qdl.iso ? `(${esc(qdl.iso)})` : ""}</b> 전에 제출해야 추가 공고로 고칠 수 있습니다.`);
  if (d.Q.length || d.D.length) out.push(`질의·이탈 문안은 초안입니다. <b>계약법무 검토</b> 뒤 제출하세요.`);
  const pq = its.find(i => i.key === "prequalification");
  if (pq) out.unshift(pq.found ? `<b>참가 자격(PQ) 충족 여부</b>: ${esc(E.pqSummary(pq.evidence) || "요건 핵심 " + (E.pqFacts(pq.evidence).join(" · ") || "원문 참조"))} ${refBtn(p, pq.docId, pq.pages[0], pq.key, pq.evidence)} → 영업이 회사 실적과 대조한 뒤 결재합니다(못 맞추면 입찰 무효).` : `<b>참가 자격(PQ)</b> 조항을 찾지 못했습니다. 질의로 확인한 뒤 영업이 충족 여부를 결재에 올립니다.`);
  const dl = d.D.map(x => x.label), rest = highs.filter(h => !dl.includes(h));
  if (d.D.length) out.push(`높음 ${d.D.length}건(${esc(dl.join("·"))})은 이탈 ${esc(d.D[0].id)}${d.D.length > 1 ? "~" + esc(d.D[d.D.length - 1].id) : ""}로 요청합니다. 이탈을 넣을지, 거절될 때 가격에 얼마를 넣을지는 <b>입찰 심의(경영진) 결재</b> 사항입니다.`);
  if (rest.length) out.push(`높음 ${rest.length}건(${esc(rest.join("·"))})을 그대로 받을지, 가격에 얼마를 넣을지는 <b>경영진 결재</b> 사항입니다.`);
  const tc = techCands(p);
  if (tc.length) out.push(`기술 요구사항 조건부 ${tc.filter(x => x.st === "cond").length}건·부적합 ${tc.filter(x => x.st === "no").length}건(설계·시공 판단)은 03 탭 '기술 질의·이탈 후보'에서 질의나 기술 이탈로 정리하고, 부적합을 안고 입찰할지는 <b>경영진 결재</b> 사항입니다.`);
  if (p.policy && p.policy.domestic) out.push("국내 공공계약: 법정 기준 항목은 판정하지 않고 '정보'로 둡니다. 계약법무가 법령·예규와 같은지 확인하세요.");
  out.push("판정은 업계 통상치 기준의 자동 판정입니다(08 탭 기준표). 회사 기준과 다르면 사람이 고칩니다. 스캔 PDF는 읽지 못합니다.");
  return out.map(x => `<li>${x}</li>`).join("");
}
bind.summary = (p, el) => {
  $$("tr.row", el).forEach(tr => { const tog = () => { const k = tr.dataset.k; st.open.has(k) ? st.open.delete(k) : st.open.add(k); renderTab(); };
    tr.onclick = e => { if (!e.target.closest(".docref,input")) tog(); };
    tr.onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target === tr) { e.preventDefault(); tog(); } }; });
  $$("[data-rv]", el).forEach(c => c.onchange = () => { setReview(p, c.dataset.rv, c.checked); renderTabs(); renderTab(); });
  $$("[data-grp]", el).forEach(b => b.onclick = () => { st.group = b.dataset.grp; renderTab(); });
  $$("[data-rf]", el).forEach(b => b.onclick = () => { st.rf = b.dataset.rf; renderTab(); });
  const pr = $("#price", el);
  if (pr) { let t; const hint = $("#pricehint", el);
    const check = () => { const n = parseAmount(pr.value), cc = currencyOf(p), ok = Number.isFinite(n) && n > 0, last = store.get("price:" + p.name, 0), bad = !ok && !!pr.value.trim();
      $$(".exp table", el).forEach(t => t.classList.toggle("stale", bad));
      if (bad) pr.setAttribute("aria-invalid", "true"); else pr.removeAttribute("aria-invalid"); hint.classList.toggle("err", bad);
      hint.textContent = !pr.value.trim() ? "" : ok ? `= ${money(n, cc)}${cc === "KRW" && n >= 1e8 ? ` (${n.toLocaleString("ko-KR")}원)` : ""}${amountHint(pr.value)}`
        : `${/-/.test(pr.value) ? "음수는 넣을 수 없습니다." : "금액으로 읽을 수 없습니다(예: 5억, 500,000,000, 1.2bn)."}${last ? ` 아래 표는 마지막으로 읽은 값(${money(last, cc)}) 기준입니다.` : ""}`;
      return { n, ok }; };
    pr.addEventListener("validate", check);
    pr.oninput = () => { const { n, ok } = check(); clearTimeout(t); t = setTimeout(() => { if (ok || !pr.value.trim()) { store.set("price:" + p.name, ok ? n : 0); renderTab(); } }, 600); }; }
  const cu = $("#curr", el); if (cu) cu.onchange = () => { store.set("cur:" + p.name, cu.value); renderTab(); };
  const elb = $("#elbox", el); if (elb) elb.ontoggle = () => { st.elOpen = elb.open; };
  st.elRaw = st.elRaw || {};
  $$(".eli", el).forEach(inp => { const [k, f] = inp.dataset.el.split("|"), msg = $(`[data-msg="${k}|${f}"]`, el), rk = p.id + ":" + k + "|" + f;
    const cc = currencyOf(p), row = inp.closest(".elrow");
    const check = () => { const { n, err } = parseEl(f, inp.value, cc);
      if (err) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
      if (msg) { msg.textContent = err || (f === "a" && Number.isFinite(n) && n > 0 ? `= ${money(n, cc)}` : ""); msg.classList.toggle("err", !!err); msg.classList.toggle("muted", !err); }
      // 잘못된 값이 있으면 그 줄 EL을 바로 흐리고 기준을 알린다
      if (row) { const bad = $$(".eli", row).some(x => parseEl(x.dataset.el.split("|")[1], x.value, cc).err), elv = $(".elv", row); if (elv) { elv.classList.toggle("stale", bad); const note = $(".elnote", elv); if (note) note.hidden = !bad; } }
      return err ? null : n; };
    inp.addEventListener("validate", check);
    // 저장은 칸별 타이머 하나로, 실행할 때 그 칸의 최신 입력 원문을 다시 읽는다(다시 그리기 전 타이머가 입력 도중 값을 저장하지 않게)
    const flush = () => { const r = st.elRaw[rk]; if (!r) return; const { n, err } = parseEl(f, r.v, cc); if (err) return;
      delete st.elRaw[rk]; const v = store.get("el:" + p.name, {}); v[k] = v[k] || {}; v[k][f] = n; store.set("el:" + p.name, v); renderTab(); };
    if (st.elRaw[rk]) check(); // 저장 안 된 잘못된 입력은 다시 그린 뒤에도 오류 표시를 유지
    inp.oninput = () => { const n = check(); st.elRaw[rk] = { v: inp.value, bad: n === null }; clearTimeout(ELT[rk]); if (n !== null) ELT[rk] = setTimeout(flush, 600); };
    // 칸을 떠나면 바로 저장하되, 다음 칸으로 포커스가 옮겨진 뒤에 다시 그린다
    inp.onchange = () => { if (st.rendering || !inp.isConnected || !st.elRaw[rk]) return; clearTimeout(ELT[rk]); ELT[rk] = setTimeout(flush, 0); }; });
  const on = (id, f) => { const b = $("#" + id, el); if (b) b.onclick = f; };
  on("deep", () => claudeExtract(p)); on("stop", () => st.busy && st.busy.ctl.abort());
  on("csv", () => saveCsv(p, "summary")); on("copy", () => copyRows(summaryRows(p)));
};

// 02 모순·리스크
function vIssues(p) {
  const its = items(p), c = counts(p);
  const open = its.filter(i => i.undetermined), add = its.filter(i => i.conflict && i.conflict.status === "addendum");
  const miss = p.refs.filter(r => !r.present), risks = its.filter(i => i.risk === "high" || i.risk === "medium").sort((a, b) => (a.risk === "high" ? 0 : 1) - (b.risk === "high" ? 0 : 1));
  const qOf = it => drafts(p).Q.find(q => q.item === it.key);
  const conflictCard = (it, isOpen) => `<div class="card icard ${isOpen ? "open" : "add"}"><div class="btns">${isOpen ? `<span class="flag f-open">모순</span>` : `<span class="flag f-add">추가 공고 반영</span>`}<span class="tiny muted">${esc(it.group)} · 담당 ${esc(it.dept)}</span></div>
    <h3>${esc(it.label)}${isOpen ? ' <span class="small muted">값 미정</span>' : ` <span class="mono small">${esc(it.value)}</span>`}</h3><div class="vs">${it.conflict.values.map((v, i) => `<div class="row2"><span class="vv">${esc(v.value)}</span><span class="tiny muted">${esc(typeLabel(v.type))}${v.clause ? " " + esc(v.clause) : ""}</span>${refBtn(p, v.docId, v.page, it.key, (it.candidates.find(x => x.docId === v.docId) || {}).evidence)}${isOpen ? (i === 0 ? '<span class="tiny muted">우선순위로는 앞섬</span>' : "") : (v.docId === it.docId ? '<span class="tiny">← 적용</span>' : "")}</div>`).join("")}</div>
    <p class="rule">${esc(it.conflict.rule)}</p>${isOpen && qOf(it) ? `<div class="btns" style="margin-top:8px"><button class="btn sm" data-goq="${qOf(it).id}">질의 ${qOf(it).id} 보기</button></div>` : ""}</div>`;
  return `<div class="sec-h"><h2>모순·리스크</h2><span class="muted small">확인할 것 ${issueCount(c)}건 = 모순 ${c.open} + 빠진 참조 문서 ${c.missRefs} + 높음 ${c.high}${c.tech ? ` + 기술 조건부·부적합 ${c.tech}` : ""}</span></div>
  <p class="lede">문서끼리 값이 다른 곳, 받은 묶음에 없는 문서를 가리키는 참조, 계약자에게 불리한 조건을 모았습니다. 우선순위는 입찰 절차 항목(마감·보증·유효기간 등)은 입찰지침이, 계약 항목은 ${["CD", "PCC", "GCC", "ER", "TS"].map(a => `<abbr title="${esc(ABBR[a])}">${a}</abbr>`).join(" > ")} 순서(흔한 PCC 1.5 기준)가 정하고, 추가 공고는 늘 앞선 판보다 우선합니다.</p>
  <div class="stack">
  <div><div class="h3">모순 ${open.length}건 <span class="muted small">값 미정, 질의 필요</span></div>${open.length ? `<div class="grid">${open.map(i => conflictCard(i, true)).join("")}</div>` : `<p class="empty">${p.built.docs.length > 1 ? "문서끼리 값이 다른 항목이 없습니다." : "문서가 1권이라 문서 간 대조를 하지 않았습니다."}</p>`}</div>
  ${add.length ? `<div><div class="h3">추가 공고 반영 ${add.length}건 <span class="muted small">해소됨</span></div><div class="grid">${add.map(i => conflictCard(i, false)).join("")}</div></div>` : ""}
  <div><div class="h3">빠진 참조 문서 ${miss.length}건</div>${miss.length ? `<div class="grid">${miss.map(r => `<div class="card icard open"><span class="flag f-miss">빠진 참조 문서</span><h3>${esc(r.target)}</h3>${r.refs.map(f => `<div class="small" style="margin-top:4px">${refBtn(p, f.docId, f.page, "-", f.text, r.target)} <span class="muted">${esc(f.text)}</span></div>`).join("")}</div>`).join("")}</div>` : '<p class="empty">다른 문서를 가리키는 참조가 모두 묶음 안에 있습니다.</p>'}</div>
  ${reqMatrix(p)}
  <div><div class="h3">판정 높음·주의 ${risks.length}건 <span class="muted small">높음 ${risks.filter(r => r.risk === "high").length} · 주의 ${risks.filter(r => r.risk === "medium").length}</span></div>
    ${risks.length ? `<div class="grid">${risks.map(i => `<div class="card icard ${i.risk}">${flagsOf(i)}<h3>${esc(i.label)} <span class="mono small">${esc(i.undetermined ? "값 미정" : i.found ? (i.value.length > 40 ? "" : i.value) : "")}</span></h3><p class="small">${esc(i.risk_reason)}</p>${i.undetermined ? `<div class="small" style="margin-top:6px">${i.conflict.values.map(v => refBtn(p, v.docId, v.page, i.key, (i.candidates.find(x => x.docId === v.docId) || {}).evidence)).join(" ")}</div>` : i.found ? `<div class="small" style="margin-top:6px">${refBtn(p, i.docId, i.pages[0], i.key, i.evidence)}</div>` : ""}</div>`).join("")}</div>` : '<p class="empty">리스크로 판정된 항목이 없습니다.</p>'}</div>
  </div>`;
}

// 기술 요구사항 적합성 표(ER·TS의 shall 문장, 상태는 담당자가 고름)
const REQ_ST = [["", "미검토"], ["ok", "적합"], ["cond", "조건부"], ["no", "부적합"]];
function reqMatrix(p) {
  if (!p.reqs) p.reqs = E.requirements(p.built);
  const R = p.reqs, r = R.list, v = store.get("req:" + p.name, {}), cnt = k => r.filter(x => (v[x.key] || "") === k).length;
  if (!r.length) return `<div class="card pad small muted">기술 요구사항 적합성: 요구사항·시방 문서에서 'shall·하여야 한다' 문장을 찾지 못했습니다(0건).</div>`;
  return `<details class="card pad" ${st.reqOpen ? "open" : ""} id="reqbox"><summary class="h3" style="margin:0">기술 요구사항 적합성 ${R.total > r.length ? `${r.length}/${R.total}건` : `${r.length}건`} <span class="muted small">적합 ${cnt("ok")} · 조건부 ${cnt("cond")} · 부적합 ${cnt("no")} · 미검토 ${cnt("")}</span></summary>
    <p class="tiny muted" style="margin:6px 0">${R.fallback ? "요구사항·시방(ER·TS) 문서가 없어 계약 문서에서 뽑았습니다(요약표가 다루는 상업 조항·발주처 의무는 뺌). " : "요구사항·시방 문서에서 'shall·하여야 한다' 문장을 뽑았습니다. "}${R.total > r.length ? `앞 ${r.length}건만 표시합니다(전체 ${R.total}건). ` : ""}설계·시공이 상태를 고르면 조건부·부적합은 03 탭 '기술 질의·이탈 후보'와 결재·통제에 올라갑니다. 상태는 이 브라우저에 저장됩니다.</p>
    <div class="tscroll"><table class="t" style="min-width:0"><tbody>${r.map(x => `<tr><td style="width:100%">${v[x.key] ? `<span class="flag ${v[x.key] === "ok" ? "r-low" : v[x.key] === "cond" ? "r-medium" : "r-high"}" style="margin-right:6px">${(REQ_ST.find(z => z[0] === v[x.key]) || [])[1]}</span>` : ""}${esc(x.text)}<div>${refBtn(p, x.docId, x.page, "~", x.text)}</div></td><td><select class="sel" data-req="${esc(x.key)}" aria-label="적합성 상태">${REQ_ST.map(([k, l]) => `<option value="${k}" ${(v[x.key] || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>
    <div class="btns" style="margin-top:8px"><button class="btn sm" id="copyreq">적합성 표 복사</button></div></details>`;
}
bind.issues = (p, el) => {
  const box = $("#reqbox", el); if (box) box.ontoggle = () => { st.reqOpen = box.open; };
  $$("[data-req]", el).forEach(sel => sel.onchange = () => { const v = store.get("req:" + p.name, {}); if (sel.value) v[sel.dataset.req] = sel.value; else delete v[sel.dataset.req]; store.set("req:" + p.name, v); renderTabs(); renderTab(); });
  const c = $("#copyreq", el); if (c) c.onclick = () => { const v = store.get("req:" + p.name, {}); copyRows([["문서", "쪽", "요구사항", "상태"], ...p.reqs.list.map(x => [x.docName, x.page, x.text, (REQ_ST.find(s => s[0] === (v[x.key] || "")) || [])[1]])]); };
};

// 03 질의·이탈
// 기술 요구사항 중 담당자가 조건부·부적합으로 고른 것 → 기술 질의·이탈 후보
function techCands(p) {
  if (!p.built || !p.built.docs.length) return [];
  if (!p.reqs) p.reqs = E.requirements(p.built);
  const v = store.get("req:" + p.name, {});
  return p.reqs.list.filter(x => v[x.key] === "cond" || v[x.key] === "no").map(x => ({ ...x, st: v[x.key] }));
}
function wordCut(s, n) { if (s.length <= n) return s; const c = s.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(" "), n - 20)).replace(/[,;:]$/, "") + " …"; }
function techDrafts(p) {
  const qs = drafts(p).Q;
  return techCands(p).map((x, n) => {
    const bd = p.built.docs.find(d => d.id === x.docId), tEn = (E.TYPE[bd ? bd.type : "ETC"] || E.TYPE.ETC).en;
    const at = `${tEn}${x.clause ? `, Clause ${x.clause}` : ""}, p.${x.page}`, quote = wordCut(x.text.replace(/^\d{1,2}(?:\.\d+)+\s+/, ""), 170);
    // 같은 원인(빠진 참조 문서) 또는 같은 조항을 근거로 한 질의·이탈과 연결
    const sameClause = items(p).filter(i => i.candidates.some(c => c.docId === x.docId && x.clause && (c.clause === `Clause ${x.clause}` || c.sub === x.clause))).map(i => i.key);
    const dd = drafts(p), rel = [...qs.filter(q => q.basis === "빠진 참조 문서" && x.text.includes(q.label.replace("빠진 참조 문서: ", ""))), ...[...dd.Q, ...dd.D].filter(z => z.item && sameClause.includes(z.item))].map(z => z.id).filter((v, i, a) => a.indexOf(v) === i);
    return { id: "T-" + String(n + 1).padStart(2, "0"), st: x.st, label: `기술 요구사항${x.clause ? " " + x.clause : ""}`, basis: x.st === "no" ? "기술 부적합" : "기술 조건부", owner: "설계",
      where: `${x.docName} p.${x.page}`, ko: `${x.st === "no" ? "부적합" : "조건부"}: ${x.text}`, rel, refs: [{ docId: x.docId, page: x.page, hl: x.text }], text: x.text, docId: x.docId, page: x.page,
      en: x.st === "no" ? `Technical deviation (${at}): the Bidder cannot comply with the requirement "${quote}" and proposes the following alternative: [TBD by Engineering].`
        : `Clarification (${at}): regarding the requirement "${quote}", please confirm whether the following is acceptable: [TBD by Engineering].` };
  });
}
function techSection(p) {
  const td = techDrafts(p); if (!td.length) return "";
  return `<div><div class="h3">기술 질의·이탈 후보 ${td.length}건 <span class="muted small">02 탭 적합성 표에서 조건부·부적합으로 고른 요구사항</span></div><div class="grid">${td.map((x, n) => `<div class="card draft" data-card="${x.id}" data-tc="${n}"><div class="hd"><span class="${x.st === "no" ? "k-d" : "k-q"}">${x.id}</span><b>${esc(x.label)}</b></div>
    <div class="tiny muted" style="margin:-2px 0 6px">기술 후보 · ${x.st === "no" ? "부적합(기술 이탈)" : "조건부(질의)"} · 담당 설계(시공 협의)</div><p class="small">${esc(x.text)}</p>
    ${x.rel.length ? `<p class="tiny" style="margin-top:4px">관련: ${x.rel.map(id => `<button class="docref" data-goq="${id}">${id}</button>`).join(" ")} (같은 사안이면 한쪽만 제출하거나 질의 회신 뒤 판단)</p>` : ""}
    <div class="en" lang="en">${esc(x.en)}</div>
    <div class="btns"><span class="tiny muted">근거</span>${refBtn(p, x.docId, x.page, "~", x.text)}<span class="grow"></span><button class="btn sm" data-copy="T:${x.id}">영문 복사</button></div></div>`).join("")}</div></div>`;
}
function reqNote(p) {
  const r = p.reqs && p.reqs.list.find(x => x.docId === st.src.doc && x.page === st.src.page && x.text.startsWith((st.src.line || "").slice(0, 30)));
  const v = store.get("req:" + p.name, {}), s = r ? (REQ_ST.find(z => z[0] === (v[r.key] || "")) || [])[1] : "";
  return `<span class="small"><b>기술 요구사항</b>(shall 문장)을 칠했습니다. 현재 적합성 상태: <b>${esc(s || "미검토")}</b>. 상태는 02 탭 '기술 요구사항 적합성' 표에서 고릅니다.</span>`;
}
function vDrafts(p) {
  const d = drafts(p), polishing = st.busy && st.busy.kind === "polish", pol = p.policy || {}, qd = deadline(p, "clarification_deadline");
  const card = (x, kind) => `<div class="card draft" data-card="${x.id}"><div class="hd"><span class="${kind === "Q" ? "k-q" : "k-d"}">${x.id}</span><b>${esc(x.label)}</b></div>
    <div class="tiny muted" style="margin:-2px 0 6px">${kind === "Q" ? "질의" : "이탈"} · ${esc(x.basis.replace("리스크 높음", "높음"))} · 담당 ${esc(x.owner)}</div>
    <p class="small">${esc(x.ko)}</p>${x.why ? `<p class="tiny muted" style="margin-top:2px">${esc(x.why)}</p>` : ""}${x.next ? `<p class="tiny" style="margin-top:4px">순서: 이 질의의 회신이 불리하면 <button class="docref" data-goq="${x.next}">${x.next}</button> 이탈을 넣습니다.</p>` : ""}${x.after ? `<p class="tiny" style="margin-top:4px">순서: <button class="docref" data-goq="${x.after}">${x.after}</button> 질의 회신이 불리할 때 넣는 이탈입니다.</p>` : ""}<div class="en" ${pol.korean ? "" : 'lang="en"'}>${esc(x.en)}</div>
    <div class="btns"><span class="tiny muted">근거</span>${(x.refs || []).length ? x.refs.map(r => refBtn(p, r.docId, r.page, r.line ? "-" : x.item, r.hl, r.line ? x.label.replace("빠진 참조 문서: ", "") : "")).join(" ") : `<span class="tiny muted">${esc(x.where)}</span>`}<span class="grow"></span><button class="btn sm" data-copy="${kind}:${x.id}">${pol.korean ? "문안 복사" : "영문 복사"}</button></div></div>`;
  const tcN = techCands(p).length;
  return `<div class="sec-h"><h2>질의·이탈 초안</h2><span class="muted small">질의 ${d.Q.length} · 이탈 ${d.D.length}${tcN ? ` · 기술 후보 ${tcN}` : ""}</span></div>
  <p class="lede"><b>질의</b>는 질의 마감 전에 모순·누락을 발주처에 묻는 문서이고, <b>이탈</b>은 입찰서의 이탈 목록에 '이 조건은 이렇게 바꿔 달라'고 적는 요청입니다. 모두 초안이며 계약법무 검토 뒤 제출하세요.${qd.state === "ok" ? ` 질의 마감은 <span class="mono">${esc(qd.item.value)}</span>(${dtxt(qd)})입니다.` : ""}</p>
  ${pol.note ? `<div class="banner" style="margin-bottom:12px">${esc(pol.note)}${pol.evidence ? ` <span class="muted">근거: "${esc(pol.evidence)}"</span>` : ""}</div>` : ""}
  <div class="btns" style="margin-bottom:8px"><button class="btn sm" id="copyall">${pol.korean ? "전체 문안 복사" : "전체 영문 복사"}</button>${st.downloads ? `<button class="btn sm" id="csvq">CSV 저장</button>` : ""}
    ${st.sample ? (polishing ? `<span class="small muted"><span class="spin"></span> Claude가 문장을 다듬는 중</span><button class="btn sm" id="stop2">중지</button>` : `<button class="btn sm primary" id="polish" ${st.busy || !(d.Q.length + d.D.length) ? "disabled" : ""}>Claude로 문장 다듬기</button>`) : ""}
    ${p.claudeDrafts ? `<button class="btn sm" id="undo">규칙 초안으로 되돌리기</button>` : ""}</div>
  <details class="small" style="margin-bottom:10px"><summary class="muted">질의를 만드는 기준</summary><p class="tiny muted" style="margin-top:4px">문서 간 모순, 빠진 참조 문서, 못 찾은 핵심 항목(${E.MUST.filter(k => !(pol.domestic && (k === "retention" || k === "bid_currency"))).map(k => E.ITEMS.find(i => i.key === k).label).join("·")}), 발주처가 보증하지 않는 조사 자료.${pol.forbidden ? " 이탈이 금지된 입찰은 높음 조건의 완화 요청도 질의로 넣습니다." : ""}${pol.domestic ? " 국내 공공계약은 유보금·입찰 통화를 묻지 않고, 법정 기준 항목은 '정보'로 둡니다." : ""} 그 밖의 '확인 필요' 항목은 담당자가 판단합니다.</p></details>
  ${p.claudeDrafts ? `<p class="small" style="margin-bottom:12px"><span class="k-q">Claude 다듬음</span> 조항·수치는 그대로 두고 문체만 다듬었습니다. 제출 전에 원문과 대조하세요.</p>` : ""}
  <div class="stack"><div><div class="h3">질의 ${d.Q.length}건</div>${d.Q.length ? `<div class="grid">${d.Q.map(x => card(x, "Q")).join("")}</div>` : '<p class="empty">질의할 모순·누락이 없습니다.</p>'}</div>
  ${techSection(p)}
  <div><div class="h3">이탈 요청 ${d.D.length}건</div>${d.D.length ? `<div class="grid">${d.D.map(x => card(x, "D")).join("")}</div>` : `<p class="empty">${pol.domestic ? "국내 공공계약이라 이탈·조건 완화 요청을 만들지 않았습니다(법정 기준 항목은 '정보')." : pol.forbidden ? (d.Q.some(q => q.basis === "조건 완화 질의") ? "이탈을 쓸 수 없는 입찰이라 조건 완화 요청을 질의로 넣었습니다." : "이탈을 쓸 수 없는 입찰이고, 완화를 요청할 높음 조건도 없습니다.") : "높음 판정 항목이 없어 이탈 초안이 없습니다."}</p>`}</div></div>`;
}
bind.drafts = (p, el) => {
  const d = drafts(p);
  $$("[data-copy]", el).forEach(b => b.onclick = () => { const id = b.dataset.copy.split(":")[1], x = allDrafts(p).find(y => y.id === id); copyText(x.en, /\[TBD/.test(x.en) ? `${id} 문안을 복사했습니다. [TBD …] 자리를 채운 뒤 제출하세요.` : `${id} 문안을 복사했습니다.`); });
  const on = (id, f) => { const b = $("#" + id, el); if (b) b.onclick = f; };
  on("copyall", () => { const all = allDrafts(p); copyText(all.map(x => `${x.id} ${x.en}`).join("\n\n"), hasTBD(all) ? "복사했습니다. 기술 후보에 [TBD …] 작성 자리가 남아 있으니 채운 뒤 제출하세요." : "질의·이탈 문안을 모두 복사했습니다."); });
  on("csvq", () => saveCsv(p, "drafts")); on("polish", () => claudePolish(p)); on("stop2", () => st.busy && st.busy.ctl.abort());
  on("undo", () => { p.claudeDrafts = null; renderTab(); });
};

// 04 원문 형광펜
function marksFor(p, doc, pageNo) {
  const text = doc.pages.find(x => x.number === pageNo)?.text || "", spans = [];
  for (const it of items(p)) for (const c of it.candidates.filter(c => c.docId === doc.id && c.page === pageNo)) {
    const words = c.evidence.replace(/…$/, "").split(/\s+/).filter(Boolean).slice(0, 7).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) continue;
    const m = new RegExp(words.join("\\s+")).exec(text); if (!m) continue;
    let s = m.index, e = m.index + m[0].length;
    if (c.raw) { const r = new RegExp(c.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")).exec(text.slice(s, s + c.evidence.length + 80)); if (r) { e = s + r.index + r[0].length; s = s + r.index; } }
    else { const nl = text.indexOf("\n", e); e = Math.min(nl === -1 ? text.length : nl, s + 160); }
    spans.push({ s, e, it, applied: !it.undetermined && c.docId === it.docId });
  }
  // 초점 항목을 먼저 놓아 겹칠 때 그 항목이 남게 한다
  if (st.src.line) { const w = st.src.line.split(/\s+/).filter(Boolean).slice(0, 8).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); const m = w.length && new RegExp(w.join("\\s+")).exec(text);
    if (m) { const nl = text.indexOf("\n", m.index); spans.push({ s: m.index, e: nl === -1 ? text.length : nl, it: null, line: true }); } }
  spans.sort((a, b) => (b.line ? 2 : 0) + (b.it && b.it.key === st.src.focus) - (a.line ? 2 : 0) - (a.it && a.it.key === st.src.focus) || a.s - b.s);
  const keep = []; for (const sp of spans) if (!keep.some(k => sp.s < k.e && k.s < sp.e)) keep.push(sp);
  return { text, spans: keep.sort((a, b) => a.s - b.s) };
}
function vSource(p) {
  const live = p.docs.filter(d => d.status === "done");
  if (!st.src.doc || !docOf(p, st.src.doc) || docOf(p, st.src.doc).status !== "done") st.src = { doc: live[0].id, page: live[0].pages[0].number, focus: null };
  const doc = docOf(p, st.src.doc), pages = doc.pages, pi = Math.max(0, pages.findIndex(x => x.number === st.src.page)), page = pages[pi];
  const { text, spans } = marksFor(p, doc, page.number);
  let html = "", at = 0;
  for (const sp of spans) { if (sp.line) { html += esc(text.slice(at, sp.s)) + `<mark class="hl ${st.src.lineKind === "req" ? "g4" : "g5"} refline focus" title="${st.src.lineKind === "req" ? "기술 요구사항" : "참조 문장"}">${esc(text.slice(sp.s, sp.e))}<sup>${st.src.lineKind === "req" ? "기술 요구사항" : "참조 문장"}</sup></mark>`; at = sp.e; continue; } html += esc(text.slice(at, sp.s)) + `<mark class="hl ${GCLS[sp.it.group]} ${st.src.focus === sp.it.key ? "focus" : ""}" data-k="${sp.it.key}" tabindex="0" title="${esc(sp.it.label)}${sp.applied ? "" : sp.it.undetermined ? " (모순: 값 미정)" : " (다른 문서 값이 적용됨)"}">${esc(text.slice(sp.s, sp.e))}<sup>${esc(sp.it.label)}</sup></mark>`; at = sp.e; }
  html += esc(text.slice(at));
  const cnt = Object.fromEntries(live.map(d => [d.id, items(p).reduce((n, it) => n + it.candidates.filter(c => c.docId === d.id).length, 0)]));
  const fit = st.src.focus && items(p).find(i => i.key === st.src.focus), onPage = fit && spans.some(sp => sp.it && sp.it.key === fit.key);
  return `<div class="sec-h"><h2>원문 형광펜</h2></div>
  <p class="lede">추출한 값이 원문 어디에서 나왔는지 칠해 보여 줍니다. 색은 요약표 묶음이고, 칠한 곳 위 작은 글자가 항목 이름입니다. 칠한 곳을 누르면 그 항목의 판정이 나옵니다.</p>
  <div class="legend">${E.GROUPS.map(g => `<span><i class="sw" style="background:var(--hl-${GCLS[g].slice(1)})"></i>${g}</span>`).join("")}</div>
  <div class="srcbar"><label class="small" for="sdoc">문서</label><select class="sel" id="sdoc">${live.map(d => `<option value="${d.id}" ${d.id === doc.id ? "selected" : ""}>${esc(shortDoc(d))} · ${esc(typeLabel(d.type))} · 칠한 곳 ${cnt[d.id]}</option>`).join("")}</select>
    <button class="btn sm" id="pprev" ${pi <= 0 ? "disabled" : ""}>이전 쪽</button><span class="mono small">${page.number} / ${pages.length}</span><button class="btn sm" id="pnext" ${pi >= pages.length - 1 ? "disabled" : ""}>다음 쪽</button></div>
  <div class="src-grid"><div class="paper"><div class="run"><span>${esc(doc.name)}</span><span>${esc(typeLabel(doc.type))} · ${doc.kind === "pdf" ? "쪽" : "구간"} ${page.number}</span></div><pre id="ptext">${html}</pre></div>
  <div class="side stack" style="gap:10px"><div class="card pad focuscard">${fit ? `<div class="btns"><b>${esc(fit.label)}</b>${flagsOf(fit)}</div><div class="mono small" style="margin:4px 0">${valOf(fit)}</div><p class="small">${esc(fit.risk_reason || "")}</p>${fit.conflict ? `<p class="small muted" style="margin-top:4px">${esc(fit.conflict.rule)}</p>` : ""}${!onPage ? `<p class="small" style="margin-top:4px">이 쪽에는 이 항목의 근거가 없습니다.</p>` : ""}${fit.found && !fit.undetermined && fit.docId !== doc.id ? `<p class="small" style="margin-top:4px">적용 값 출처: ${refBtn(p, fit.docId, fit.pages[0], fit.key, fit.evidence)}</p>` : ""}` : (st.src.line && st.src.lineKind === "req" ? reqNote(p) : st.src.line ? `<span class="small">${st.src.target ? `<b>${esc(st.src.target)}</b> 문서를 가리키는` : "다른 문서를 가리키는"} <b>참조 문장</b>을 칠했습니다.${st.src.target && p.refs.some(r => r.target === st.src.target && !r.present) ? ` 이 문서는 받은 묶음에 없어 03 탭 ${esc((drafts(p).Q.find(q => q.label === "빠진 참조 문서: " + st.src.target) || {}).id || "")} 질의로 배포를 요청합니다.` : ""}</span>` : `<span class="small muted">이 쪽에서 칠한 곳 ${spans.filter(sp => sp.it).length}개. 칠한 곳이나 아래 목록을 누르세요.</span>`)}</div>
    <div class="card mlist">${spans.filter(sp => sp.it).map(sp => `<button class="mrow ${st.src.focus === sp.it.key ? "on" : ""}" data-k="${sp.it.key}"><span>${esc(sp.it.label)}</span><span class="flag r-${sp.it.risk}">${RISK[sp.it.risk]}</span><span class="vv">${esc(text.slice(sp.s, sp.e).slice(0, 70))}</span></button>`).join("") || '<div class="pad small muted">이 쪽에는 추출한 값이 없습니다.</div>'}</div></div></div>`;
}
bind.source = (p, el) => {
  const doc = docOf(p, st.src.doc);
  $("#sdoc", el).onchange = e => { const d = docOf(p, e.target.value); st.src = { doc: d.id, page: d.pages[0].number, focus: null, line: null }; renderTab(); };
  const pi = doc.pages.findIndex(x => x.number === st.src.page);
  $("#pprev", el).onclick = () => { st.src.page = doc.pages[Math.max(0, pi - 1)].number; st.src.focus = null; st.src.line = null; renderTab(); };
  $("#pnext", el).onclick = () => { st.src.page = doc.pages[Math.min(doc.pages.length - 1, pi + 1)].number; st.src.focus = null; st.src.line = null; renderTab(); };
  $$("mark.hl[data-k],.mrow", el).forEach(m => { const f = () => { st.src.focus = m.dataset.k; st.src.line = null; renderTab(); }; m.onclick = f; m.onkeydown = e => { if (e.key === "Enter") f(); }; });
};
function openSource(docId, page, key, hl, target) {
  const p = cur(), lineMode = key === "-" || key === "~"; let k = key && !lineMode ? key : null;
  if (!k && hl && !lineMode) { const it = items(p).find(i => i.candidates.some(c => c.docId === docId && c.page === page && c.evidence.startsWith(hl.slice(0, 30)))); k = it ? it.key : null; }
  st.src = { doc: docId, page, focus: k, line: lineMode ? hl : null, lineKind: key === "~" ? "req" : "ref", target: target || "" }; go("source", false);
  const bar = ($(".tabbar") || {}).offsetHeight || 0, narrow = window.innerWidth <= 1000;
  const fm = narrow ? $("#p-source .side") : ($("#p-source mark.focus") || $("#p-source mark.refline"));
  if (fm) { const top = fm.getBoundingClientRect().top + window.scrollY - bar - (narrow ? 8 : 120); window.scrollTo({ top: Math.max(0, top) }); }
  else window.scrollTo({ top: 0 });
}

// 05 부서별 전달
function vTeams(p) {
  const its = items(p), d = drafts(p), qd = deadline(p, "clarification_deadline"), bd = deadline(p, "bid_due_date");
  const reply = qd.state === "ok" ? `질의 회신 요청 ${addDays(qd.iso, -7)}(질의 마감 7일 전)` : "";
  const reply2 = bd.state === "ok" ? `견적 회신 요청 ${addDays(bd.iso, -14)}(입찰 마감 14일 전)` : "";
  const all = allDrafts(p);
  return `<div class="sec-h"><h2>부서별 전달</h2></div>
  <p class="lede">요약표 항목과 질의·이탈 초안을 담당 부서별로 나눴습니다. 회신 요청일은 질의 마감 7일 전, 입찰 마감 14일 전을 기본으로 잡은 제안입니다.</p>
  <div class="grid">${E.DEPTS.map(dep => { const mine = its.filter(i => i.dept === dep), qx = all.filter(x => x.owner === dep), qdN = qx.filter(x => x.id[0] !== "T").length, tN = qx.length - qdN, hot = mine.filter(i => i.risk === "high" || i.undetermined).length;
    return `<div class="card pad team"><h3>${dep}<span class="muted small">항목 ${mine.length} · 질의·이탈 ${qdN}${tN ? ` · 기술 후보 ${tN}` : ""}${hot ? ` · <span style="color:var(--high)">먼저 볼 것 ${hot}</span>` : ""}</span></h3>
      ${reply || reply2 ? `<p class="tiny muted">${[qx.length ? reply : "", reply2].filter(Boolean).join(" · ")}</p>` : ""}
      <ul>${mine.map(i => `<li><span>${esc(i.label)}</span>${flagsOf(i)}<span class="vv">${esc(valTxt(i).length > 60 ? valTxt(i).slice(0, 58) + "…" : valTxt(i))} · ${esc(i.use)}</span></li>`).join("")}
      ${qx.map(x => `<li><span><span class="${x.id[0] === "D" ? "k-d" : "k-q"}">${x.id}</span> ${esc(x.label)}</span><span class="tiny muted">${KIND(x)}</span><span class="vv">${esc(x.ko.slice(0, 90))}</span></li>`).join("")}</ul>
      <div class="btns" style="margin-top:8px"><button class="btn sm" data-team="${dep}">${dep} 목록 복사</button></div></div>`; }).join("")}</div>`;
}
bind.teams = (p, el) => {
  $$("[data-team]", el).forEach(b => b.onclick = () => { const dep = b.dataset.team, its = items(p).filter(i => i.dept === dep), d = drafts(p);
    const lines = [`[${p.name}] ${dep} 확인 요청`, ...its.map(i => `- ${i.label}: ${valTxt(i)} (${RISK[i.risk]}${i.undetermined ? ", 모순" : ""})${i.found && !i.undetermined ? ` ${i.docName} p.${i.pages[0]}` : ""}`), ...allDrafts(p).filter(x => x.owner === dep).map(x => `- ${x.id} ${x.label}: ${x.ko}`)];
    copyText(lines.join("\n"), `${dep} 목록을 복사했습니다.`); });
};

// 06 문서에 질문
const SUGG = ["지체상금 조건과 상한을 정리해줘", "문서끼리 다른 값은 무엇이고 어느 쪽이 적용되나?", "계약자에게 불리한 조항 Top 5는?", "입찰 일정(현장설명회·질의·마감)을 정리해줘", "보증서 종류와 비율, 유효기간은?"];
function vAsk(p) {
  const chatBusy = st.busy && st.busy.kind === "chat";
  return `<div class="sec-h"><h2>문서에 질문</h2></div>
  <p class="lede">${st.sample ? (st.tools ? "Claude가 문서 묶음을 직접 검색하고 쪽을 열어 본 뒤, 근거 쪽 번호를 붙여 답합니다." : "Claude가 관련 조항 발췌를 읽고 답합니다.") : "Claude 없이 동작하는 모드입니다. 모순·리스크·일정·보증 질문에는 분석 결과로, 그 밖의 질문에는 관련 조항의 핵심 문장으로 답합니다. claude.ai에서 열면 Claude가 직접 읽고 답합니다."}</p>
  <div class="card pad"><div class="btns">${SUGG.map(s => `<button class="chip" data-q="${esc(s)}" ${st.busy ? "disabled" : ""}>${esc(s)}</button>`).join("")}</div>
  <div class="msgs" id="msgs">${p.chat.map(m => msgHtml(p, m)).join("") || '<p class="empty">위 예시를 누르거나 직접 질문하세요.</p>'}</div>
  <form class="ask" id="askf"><input id="q" placeholder="예: 유보금 비율이 문서마다 다른데 어느 쪽이 맞나요?" autocomplete="off" aria-label="질문">
  ${chatBusy ? `<button class="btn" type="button" id="qstop">중지</button>` : `<button class="btn primary" id="qsend" ${st.busy ? "disabled" : ""}>질문</button>`}</form></div>`;
}
function msgHtml(p, m) {
  if (m.role === "user") return `<div class="msg u">${esc(m.content)}</div>`;
  const body = m.content ? linkify(p, m.content) : m.pending ? `<span class="small muted"><span class="spin"></span> 생각하는 중…</span>` : "";
  const tr = m.trace && m.trace.length ? `<div class="trace">${m.trace.map(esc).join(" → ")}</div>` : "";
  const ps = (m.passages || []).map(x => `<div class="psg">${refBtn(p, x.docId, x.page, x.key || "", x.text)} <span class="tiny muted">${esc(x.section || "")}</span><div>${esc(x.text)}</div></div>`).join("");
  return `<div class="msg a">${body}${tr}${ps}${m.passages && !m.passages.length && !m.answered ? '<div class="tiny muted">관련 조항을 찾지 못했습니다.</div>' : ""}</div>`;
}
function linkify(p, t) {
  return esc(t).replace(/\[([^\]\n]{1,60}?)\s*p\.?\s*(\d+)\]/g, (m, dn, pg) => { const n = dn.trim(); const d = p.docs.find(x => x.status === "done" && (x.name === n || x.name.includes(n) || shortDoc(x).includes(n) || n.includes(x.name.replace(/\.[^.]+$/, ""))));
    return d ? `<button class="docref" data-doc="${d.id}" data-page="${pg}" data-k="" data-hl="">${m}</button>` : m; });
}
bind.ask = (p, el) => {
  $$("[data-q]", el).forEach(b => b.onclick = () => ask(p, b.dataset.q));
  $("#askf", el).onsubmit = e => { e.preventDefault(); const q = $("#q", el).value.trim(); if (q) ask(p, q); };
  const s = $("#qstop", el); if (s) s.onclick = () => st.busy && st.busy.ctl.abort();
  const box = $("#msgs", el); box.scrollTop = box.scrollHeight;
};

// 07 문서 묶음
function vDocs(p) {
  return `<div class="sec-h"><h2>문서 묶음</h2><span class="muted small">${esc(p.name)}</span></div>
  <p class="lede">한 입찰 건의 문서를 모두 올리세요(입찰지침, 입찰 데이터 시트, 계약 데이터, 특수·일반조건, 요구사항, 시방, 추가 공고). 문서 종류는 파일 이름과 첫 쪽으로 추정합니다. 틀리면 고르세요. 종류에 따라 문서 우선순위가 정해집니다. 파일은 이 브라우저 안에서만 읽고 어디로도 올라가지 않으며, 창을 닫으면 사라집니다.</p>
  ${p.mix ? `<div class="banner warn" style="margin-bottom:10px">${esc(p.mix)}</div>` : ""}
  <label class="drop" id="drop"><strong>파일을 끌어다 놓거나 눌러서 이 건에 추가</strong>PDF · DOCX · TXT, 여러 개 한꺼번에<input type="file" id="file2" accept=".pdf,.docx,.txt,.md" multiple hidden></label>
  <div class="doclist">${p.docs.map(d => { const pending = p.docs.some(x => x.status === "reading"); return `<div class="docrow"><span class="nm">${esc(d.name)}</span>
    ${d.status === "done" && pending ? '<span class="tiny muted">종류 판단 중</span>' : d.status === "done" ? `<select class="sel" data-type="${d.id}" aria-label="${esc(d.name)} 문서 종류">${E.DOC_TYPES.map(t => `<option value="${t.code}" ${t.code === d.type ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</select>` : d.status === "error" ? '<span class="flag r-high">읽기 실패</span>' : '<span class="spin" aria-label="읽는 중"></span>'}
    <span class="mt">${d.status === "done" && pending ? `${d.pages.length}${d.kind === "pdf" ? "쪽" : "구간"} · 묶음을 다 읽은 뒤 종류를 정합니다` : d.status === "done" ? `${d.pages.length}${d.kind === "pdf" ? "쪽" : "구간"} · ${d.type === "ADD" ? "추가 공고는 앞선 판보다 우선" : `우선순위 ${(E.TYPE[d.type] || E.TYPE.ETC).rank + 1}위`}` : esc(d.msg || "읽는 중")}</span></div>`; }).join("")}</div>`;
}
bind.docs = (p, el) => {
  const drop = $("#drop", el), f2 = $("#file2", el);
  f2.onchange = e => { if (e.target.files.length) addFiles(e.target.files, p); e.target.value = ""; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); }; drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove("over"); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files, p); };
  $$("[data-type]", el).forEach(s => s.onchange = () => { const d = docOf(p, s.dataset.type), before = typeLabel(d.type); d.type = s.value; analyze(p); toast(`문서 종류를 바꿔 다시 대조했습니다: ${shortDoc(d)} ${before} → ${typeLabel(d.type)}`); renderAll(); });
};

// 08 처음이라면
function vGuide() {
  const n = E.ITEMS.length;
  return `<div class="sec-h"><h2>처음이라면</h2></div>
  <div class="stack">
  <div class="card pad"><div class="h3">ITB와 ITB 분석</div>
    <p><b>ITB</b>는 발주처가 입찰자에게 주는 입찰 문서 묶음입니다. 입찰지침, 계약 데이터, 특수·일반조건, 발주처 요구사항, 기술 시방, 부록이 여러 권으로 오고, 입찰 중에 추가 공고로 바뀝니다.</p>
    <p style="margin-top:6px"><b>ITB 분석</b>은 그 묶음에서 값을 뽑아 서로 대조하고, 모순·리스크를 찾아 질의·이탈로 바꾸고, 입찰 요약표로 각 부서에 넘기는 일입니다. 처음 열면 가상 샘플 두 건이 들어 있습니다. 실제 입찰 문서는 '새 입찰 건 올리기'로 올리세요.</p></div>
  <ol class="steps">
    <li><span class="sn">1</span><b>넣는다</b><br><span class="small muted">한 건의 문서를 모두 올리고 종류를 확인합니다.</span><br><button class="btn sm" data-go="docs">07 문서 묶음</button></li>
    <li><span class="sn">2</span><b>찾는다</b><br><span class="small muted">항목마다 관련 조항을 권별로 찾고 원문에 칠합니다.</span><br><button class="btn sm" data-go="source">04 원문 형광펜</button></li>
    <li><span class="sn">3</span><b>뽑는다</b><br><span class="small muted">값·쪽 번호를 뽑고 판정합니다.</span><br><button class="btn sm" data-go="summary">01 입찰 요약표</button></li>
    <li><span class="sn">4</span><b>모은다</b><br><span class="small muted">문서끼리 대조해 모순을 올리고 질의·이탈 초안을 만듭니다.</span><br><button class="btn sm" data-go="issues">02 모순·리스크</button> <button class="btn sm" data-go="drafts">03 질의·이탈</button></li>
    <li><span class="sn">5</span><b>보낸다</b><br><span class="small muted">부서별 목록과 초안을 넘깁니다.</span><br><button class="btn sm" data-go="teams">05 부서별 전달</button></li>
  </ol>
  <div class="card pad"><div class="h3">표시의 뜻</div><table class="thr"><tbody>
    ${["high", "medium", "low", "unknown", "none"].map(r => `<tr><td><span class="flag r-${r}">${RISK[r]}</span></td><td>${esc(RISK_HELP[r])}</td></tr>`).join("")}
    ${Object.values(STATE).map(([l, c, h]) => `<tr><td><span class="flag ${c}">${l}</span></td><td>${esc(h)}</td></tr>`).join("")}
    <tr><td><span class="flag f-miss">빠진 참조 문서</span></td><td>본문이 가리키는데 받은 묶음에 없는 문서(부록·별권)</td></tr></tbody></table></div>
  <div class="card pad"><div class="h3">이 도구가 판정하는 방식</div>
    <ul style="margin:0 0 10px;padding-left:18px">
      <li>규칙 엔진이 ${n}개 항목을 문서마다 찾고, 값마다 문서·쪽·조항을 붙입니다. 근거 문장이 없으면 값을 내지 않습니다.</li>
      <li>같은 항목의 값이 문서마다 다르면 적용 값을 정하지 않고 <b>모순(값 미정)</b>으로 올립니다. 판정·금액은 가장 불리한 값 기준입니다. 추가 공고가 '바꾼다'고 적은 값은 최신 판으로 적용합니다. 질의 회신의 '수용 안 함' 같은 문장은 값으로 쓰지 않습니다.</li>
      <li>입찰지침이 이탈을 금지하거나 국내 공공계약이면 이탈 초안 대신 조건 완화 질의를 만듭니다.</li>
      ${st.sample ? "<li>'Claude로 정밀 분석'을 누르면 Claude가 근거 조항을 다시 읽고 값·판정을 고칩니다. 모순 판정은 규칙 엔진 대조 결과를 유지합니다.</li>" : "<li>claude.ai에서 열면 Claude 정밀 분석·질문·문장 다듬기가 켜집니다. 지금은 규칙 엔진만 씁니다.</li>"}
      <li>스캔 이미지 PDF는 글자를 읽지 못합니다. OCR을 먼저 거쳐야 합니다. 최종 판단은 담당자가 합니다.</li></ul>
    <div class="h3" style="font-size:14px">판정 기준(업계 통상치, 회사 기준과 다르면 사람이 고칩니다)</div>
    <table class="thr"><tbody>${E.THRESHOLDS.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
  <div class="card pad"><div class="h3">용어</div><div class="gloss">${GLOSSARY.map(([t, d]) => `<div><b>${esc(t)}</b><span class="small">${esc(d)}</span></div>`).join("")}</div></div>
  </div>`;
}

// ── Claude ───────────────────────────────────────
function errCopy(e) {
  if (!e || !e.code) return `페이지 오류로 Claude를 부르지 못했습니다(${(e && e.message) || "알 수 없음"}). 새로 고친 뒤 다시 시도해 주세요.`;
  return ({ not_granted: "Claude 사용이 허용되지 않아 규칙 엔진 결과만 표시합니다.", rate_limited: "요청이 많습니다. 잠시 뒤 다시 눌러 주세요.", prompt_too_large: "보낼 발췌가 너무 깁니다. 문서를 나눠 올려 주세요.",
    invalid_json: "Claude 응답을 표로 읽지 못했습니다. 다시 시도해 주세요.", refused: "Claude가 이 요청에 답하지 않았습니다.", session_expired: "다시 로그인한 뒤 시도해 주세요.", tools_unavailable: "이 화면에서는 Claude 도구 호출을 쓸 수 없어 발췌 방식으로 답합니다." })[e.code] || "Claude 호출이 실패했습니다. 잠시 뒤 다시 시도해 주세요.";
}
const FATAL = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"];
function failClaude(e) { if (e && FATAL.includes(e.code)) { st.sample = null; st.tools = false; } }
function evidencePrompt(p, per) {
  const used = new Map(), lines = [];
  for (const it of p.items) {
    const ids = [], q = E.ITEMS.find(x => x.key === it.key).query;
    for (const d of p.built.docs) for (const h of d.index.search(q, per)) { const k = d.id + ":" + h.chunk.id; if (!used.has(k)) used.set(k, { d, c: h.chunk, n: used.size + 1 }); ids.push(used.get(k).n); }
    lines.push(`- ${it.key} (${it.label}) 규칙 엔진: ${it.undetermined ? `모순(값 미정): ${it.conflict.values.map(v => v.value + "@" + v.docName).join(" / ")}` : it.found ? `"${it.value}" @ ${it.docName} p.${it.pages[0]}` : "못 찾음"}${it.conflict && it.conflict.status === "addendum" ? " [추가 공고 반영]" : ""} → 발췌 ${[...new Set(ids)].slice(0, 8).join(",")}`);
  }
  const ex = [...used.values()].map(({ d, c, n }) => `<chunk n="${n}" doc="${esc(d.name)}" type="${typeLabel(d.type)}" page="${c.page}">\n${c.text}\n</chunk>`).join("\n");
  return `당신은 해외 건설·EPC 입찰을 20년 검토한 입찰안내서(ITB) 검토 전문가입니다. 입찰 문서 묶음의 발췌(<chunk>)만 근거로 각 항목의 적용 값과 계약자 입장 리스크를 판정하세요.
규칙:
- 근거에 없으면 found=false, value="".
- 우선순위: 추가 공고('바꾼다'는 문장만) > 입찰 절차 항목은 입찰지침·BDS, 계약 항목은 계약서 > 계약 데이터(CD) > 특수조건(PCC) > 일반조건(GCC) > 발주처 요구사항(ER) > 기술 시방(TS) > 부록.
- 규칙 엔진이 '모순(값 미정)'으로 표시한 항목은 값을 하나로 정하지 말고 summary에 문서별 값을 적으세요.
- value: 원문 수치·날짜·명칭을 살린 짧은 값. summary: 한국어 1~2문장. evidence: 근거 원문 문장 그대로(300자 이내). doc: 근거 문서 파일명. page: 쪽 번호.
- risk: high | medium | low | none | unknown. risk_reason: 한국어, 업계 통상 수준과 비교.
반드시 JSON 하나만: {"overall_summary":"한국어 3~5문장","top_risks":["..."],"items":[{"key":"bid_bond","found":true,"value":"2% of Bid Price","summary":"...","evidence":"...","doc":"V1_....pdf","page":3,"risk":"low","risk_reason":"..."}]}
items에 다음 ${p.items.length}개 key를 모두 한 번씩 넣으세요.

입찰 건: ${p.name}
<items>
${lines.join("\n")}
</items>

<chunks>
${ex}
</chunks>`;
}
async function claudeExtract(p) {
  if (!st.sample || st.busy) return;
  const ctl = new AbortController(); st.busy = { kind: "extract", ctl, msg: "Claude가 근거를 읽는 중…" }; renderTab();
  try {
    let prompt = evidencePrompt(p, 2); if (new Blob([prompt]).size > 220000) prompt = evidencePrompt(p, 1);
    const data = await st.sample.json(prompt, { signal: ctl.signal, onText: () => { if (st.busy && st.busy.msg !== "결과를 받는 중…") { st.busy.msg = "결과를 받는 중…"; renderTab(); } } });
    if (!data || !Array.isArray(data.items)) throw { code: "invalid_json" };
    const by = new Map(data.items.filter(x => x && x.key).map(x => [x.key, x]));
    const SEVN = { high: 4, medium: 3, unknown: 2, low: 1, none: 0 };
    const merged = p.items.map(r => { const x = by.get(r.key); if (!x) return r;
      const risk = RISK[x.risk] ? x.risk : "unknown";
      if (r.undetermined) return { ...r, summary: String(x.summary || ""), risk: SEVN[risk] > SEVN[r.risk] ? risk : r.risk, risk_reason: r.risk_reason, source: "claude" }; // 모순은 규칙 대조 결과 유지
      const d = p.docs.find(dd => dd.status === "done" && x.doc && (dd.name === x.doc || dd.name.includes(String(x.doc))));
      const page = Number(x.page) > 0 ? Number(x.page) : r.pages[0], docId = d ? d.id : r.docId;
      const cand = r.candidates.find(cc => cc.docId === docId && cc.page === page), bd = p.built.docs.find(x => x.id === docId);
      // Claude가 규칙 엔진보다 낮게 판정하면 높은 쪽을 유지하고 두 판정을 함께 보여 준다(사람 확인)
      const lower = SEVN[risk] < SEVN[r.risk];
      return { ...r, found: !!x.found, value: String(x.value || ""), summary: String(x.summary || ""), evidence: String(x.evidence || r.evidence),
        docId, docName: d ? d.name : r.docName, docType: d ? d.type : r.docType, pages: page ? [page] : r.pages, clause: cand ? cand.clause : (docId === r.docId && page === r.pages[0] ? r.clause : bd && bd.type === "ADD" ? `Addendum No. ${bd.addNo}` : ""),
        risk: lower ? r.risk : risk, risk_reason: lower ? `${r.risk_reason} (Claude는 '${RISK[risk]}'로 판정: ${String(x.risk_reason || "")} · 두 판정이 달라 사람이 확인해야 합니다)` : String(x.risk_reason || ""), source: "claude", rule_value: r.value }; });
    p.claude = { overall: String(data.overall_summary || ""), top: (data.top_risks || []).map(String), items: merged };
    p.drafts = E.drafts(merged, p.refs, p.policy); p.claudeDrafts = null; // 판정이 바뀌었으니 초안도 다시 만든다
    toast("Claude 분석을 반영했습니다. 모순은 규칙 엔진 대조 결과를 유지합니다.");
  } catch (e) { if (e.code !== "cancelled") toast(errCopy(e)); failClaude(e); }
  st.busy = null; renderAll();
}
async function claudePolish(p) {
  if (!st.sample || st.busy) return;
  const base = p.drafts, ctl = new AbortController(); st.busy = { kind: "polish", ctl }; renderTab();
  try {
    const list = [...base.Q, ...base.D].map(x => ({ id: x.id, label: x.label, basis: x.basis, where: x.where, en: x.en, ko: x.ko }));
    const data = await st.sample.json(`당신은 국제 EPC 입찰의 계약 담당자입니다. 아래 질의(Q)·이탈(D) 초안의 제출 문안(en)을 발주처에 보내는 공식 문체로 다듬으세요(문안이 한국어면 한국어 공문체로). 조항·쪽 번호·수치는 바꾸지 말고, 사실을 더하지 마세요. 한국어 요약(ko)도 자연스럽게 다듬으세요.
반드시 JSON 배열 하나만: [{"id":"Q-01","en":"...","ko":"..."}]
초안:
${JSON.stringify(list, null, 1)}`, { signal: ctl.signal });
    if (!Array.isArray(data)) throw { code: "invalid_json" };
    const by = new Map(data.filter(x => x && x.id).map(x => [x.id, x]));
    const m = x => { const y = by.get(x.id); return y ? { ...x, en: String(y.en || x.en), ko: String(y.ko || x.ko) } : x; };
    p.claudeDrafts = { Q: base.Q.map(m), D: base.D.map(m), policy: base.policy };
    toast("Claude가 다듬은 문장으로 바꿨습니다.");
  } catch (e) { if (e.code !== "cancelled") toast(errCopy(e)); failClaude(e); }
  st.busy = null; renderAll();
}
const CHAT_RULES = `당신은 입찰안내서(ITB) 검토 어시스턴트입니다. 사용자는 건설사 입찰 담당자입니다. 입찰 건은 여러 문서(권)로 되어 있습니다.
문서 내용은 반드시 도구(search_document, read_pages, get_summary)로 직접 찾아 읽고 답하세요. 지어내지 마세요.
- 동의어(영문/한글)로 여러 번 검색해도 됩니다. 조항이 다른 문서를 참조하면 그 문서도 확인하세요.
- 같은 항목이 문서마다 다르면 둘 다 밝히고, 우선순위(추가 공고 > 입찰 절차는 입찰지침 / 계약 항목은 계약 데이터 > 특수조건 > 일반조건 > 요구사항 > 시방)와 질의 필요 여부를 쓰세요.
- 한국어로, 결론 먼저. 사실마다 [파일명 p.12] 형식으로 출처를 붙이세요.
- 찾지 못한 내용은 "문서에서 확인되지 않음"이라고 쓰세요.`;
function chatTools(p) {
  const docs = p.built.docs, pick = v => { const s = String(v || ""); return docs.find(d => d.name === s) || docs.find(d => d.name.includes(s) || s.includes(d.name.replace(/\.[^.]+$/, ""))) || docs[Number(s) - 1]; };
  const prog = s => { if (st.busy && st.busy.trace) { st.busy.trace.push(s); if (st.tab === "ask") paintLastMsg(p); } };
  return [
    { name: "search_document", description: "입찰 문서 묶음 전체를 키워드로 검색해 관련 발췌를 파일명·쪽 번호와 함께 돌려줍니다. 한글·영문 모두 가능.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, top_k: { type: "integer", description: "1~8" } }, required: ["query"] },
      execute: inp => { const q = String(inp.query || ""); prog(`🔎 "${q}" 검색`); const k = Math.max(1, Math.min(Number(inp.top_k) || 5, 8));
        const hits = docs.flatMap(d => d.index.search(E.expandQuery(q), k).map(h => ({ d, ...h }))).sort((a, b) => b.score - a.score).slice(0, k);
        return hits.length ? hits.map(h => `<result doc="${h.d.name}" type="${typeLabel(h.d.type)}" page="${h.chunk.page}">\n${h.chunk.text}\n</result>`).join("\n") : "검색 결과가 없습니다. 동의어로 다시 검색하세요."; } },
    { name: "read_pages", description: "문서 하나의 지정한 쪽 범위 전문을 읽습니다. doc은 파일명(또는 문서 번호 1부터), 한 번에 최대 3쪽.",
      inputSchema: { type: "object", properties: { doc: { type: "string" }, start_page: { type: "integer" }, end_page: { type: "integer" } }, required: ["doc", "start_page"] },
      execute: inp => { const d = pick(inp.doc); if (!d) throw new Error("문서를 찾지 못했습니다. 파일명: " + docs.map(x => x.name).join(", "));
        const n = d.pages.length, a = Math.max(1, Number(inp.start_page) || 1), b = Math.min(Number(inp.end_page) || a, a + 2, n); if (a > n) throw new Error(`${d.name}은 ${n}쪽까지 있습니다.`);
        prog(`📄 ${shortDoc(d)} p.${a}${b > a ? "–" + b : ""}`); return d.pages.slice(a - 1, b).map(x => `<page doc="${d.name}" number="${x.number}">\n${x.text.slice(0, 9000)}\n</page>`).join("\n"); } },
    { name: "get_summary", description: "이미 만든 입찰 요약표(항목·적용 값·출처·판정·모순 여부)와 질의·이탈 초안 목록을 돌려줍니다.",
      execute: () => { prog("📋 요약표 참조"); return { items: items(p).map(i => ({ label: i.label, value: valTxt(i), doc: i.docName, page: i.pages[0], risk: i.risk, conflict: i.conflict ? { status: i.conflict.status, values: i.conflict.values.map(v => v.value + " @ " + v.docName) } : null })), drafts: [...drafts(p).Q, ...drafts(p).D].map(x => x.id + " " + x.label) }; } },
  ];
}
// Claude 없이: 분석 결과로 답할 수 있는 질문은 그 결과로, 나머지는 핵심 문장 발췌로
function offline(p, q) {
  const its = items(p), row = i => ({ docId: i.docId, page: i.pages[0], key: i.key, section: i.label, text: `${valTxt(i)} · ${RISK[i.risk]}${i.risk_reason ? " · " + i.risk_reason : ""}` });
  const pick = (title, list) => ({ content: title, passages: list.map(row), answered: true });
  if (/다른\s*값|모순|불일치|어느\s*쪽|conflict|discrepan/i.test(q)) {
    const o = its.filter(i => i.undetermined), a = its.filter(i => i.conflict && i.conflict.status === "addendum");
    return { content: o.length || a.length ? `문서끼리 값이 다른 항목입니다.\n${o.map(i => `• ${i.label}: ${i.conflict.values.map(v => `${typeLabel(v.type)} ${v.value}`).join(" vs ")} → 값 미정, 질의 필요`).join("\n")}${a.length ? `\n${a.map(i => `• ${i.label}: 추가 공고로 ${i.value} 적용`).join("\n")}` : ""}` : "문서끼리 값이 다른 항목이 없습니다.",
      passages: o.flatMap(i => i.conflict.values.map(v => ({ docId: v.docId, page: v.page, key: i.key, section: `${i.label} · ${typeLabel(v.type)}`, text: (i.candidates.find(c => c.docId === v.docId) || {}).evidence || v.value }))), answered: true };
  }
  if (/불리|리스크|위험|top|risk/i.test(q)) return pick("판정이 높음·주의인 항목입니다(높음 먼저).", its.filter(i => i.risk === "high" || i.risk === "medium" || i.undetermined).sort((a, b) => (a.risk === "high" ? 0 : 1) - (b.risk === "high" ? 0 : 1)).slice(0, 8).filter(i => i.found));
  if (/일정|마감|설명회|schedule|deadline/i.test(q)) return pick("입찰 일정입니다.", its.filter(i => i.group === "일정" && i.found));
  if (/보증|bond|security|guarantee/i.test(q)) return pick("보증·지급 관련 항목입니다.", its.filter(i => ["bid_bond", "performance_bond", "advance_payment", "retention"].includes(i.key) && i.found));
  if (/지체|delay|liquidated/i.test(q)) return pick("지체상금 관련 항목입니다.", its.filter(i => ["liquidated_damages", "ld_cap", "completion_period"].includes(i.key) && i.found));
  const ps = p.built.docs.flatMap(d => E.offlineAnswer(d.index, q).map(x => ({ ...x, docId: d.id, s: (d.index.search(E.expandQuery(q), 1)[0] || {}).score || 0 }))).sort((a, b) => b.s - a.s).slice(0, 5);
  return { content: "관련 조항의 핵심 문장입니다.", passages: ps };
}
function paintLastMsg(p) { const box = $("#msgs"); if (!box || !box.lastElementChild) return; box.lastElementChild.outerHTML = msgHtml(p, p.chat[p.chat.length - 1]); bindCommon(box); box.scrollTop = box.scrollHeight; }
async function ask(p, q) {
  if (st.busy) return;
  p.chat.push({ role: "user", content: q });
  if (!st.sample) { const o = offline(p, q); p.chat.push({ role: "assistant", ...o, offline: true }); renderTab(); return; }
  const ctl = new AbortController(), msg = { role: "assistant", content: "", pending: true, trace: [] };
  p.chat.push(msg); st.busy = { kind: "chat", ctl, trace: msg.trace }; renderTab();
  const turns = p.chat.filter(m => !m.pending && m.content && !m.offline).slice(-7, -1).map(m => ({ role: m.role, content: m.content }));
  const head = `${CHAT_RULES}\n\n[입찰 건: ${p.name}] 문서: ${p.built.docs.map((d, i) => `${i + 1}) ${d.name}(${typeLabel(d.type)}, ${d.pages.length}쪽)`).join(", ")}`;
  let input;
  if (st.tools) input = [{ role: "user", content: head }, ...turns, { role: "user", content: q }];
  else { const ctx = p.built.docs.flatMap(d => d.index.search(E.expandQuery(q), 3).map(h => ({ d, ...h }))).sort((a, b) => b.score - a.score).slice(0, 6).map(h => `<chunk doc="${h.d.name}" page="${h.chunk.page}">\n${h.chunk.text}\n</chunk>`).join("\n");
    input = [{ role: "user", content: head.replace(/문서 내용은 반드시 도구[^\n]+\n/, "아래 발췌만 근거로 답하세요.\n") }, ...turns, { role: "user", content: `<excerpts>\n${ctx}\n</excerpts>\n\n질문: ${q}` }]; }
  try {
    const opts = { signal: ctl.signal, onText: ({ text }) => { msg.content = text; if (st.tab === "ask") paintLastMsg(p); } };
    if (st.tools) opts.tools = chatTools(p); else opts.cache = false;
    const r = await st.sample(input, opts);
    msg.content = r.text + (r.truncated ? "\n\n(답이 길어 중간에 끊겼습니다. 질문을 좁혀 주세요.)" : "");
  } catch (e) {
    msg.content = e.code === "refused" ? "" : (e.text || "");
    if (e.code === "cancelled") msg.content += (msg.content ? "\n\n" : "") + "(중지함)";
    else { const o = offline(p, q); msg.content += (msg.content ? "\n\n" : "") + errCopy(e) + "\n" + o.content; msg.offline = true; msg.passages = o.passages; msg.answered = o.answered; }
    if (e.code === "tools_unavailable") st.tools = false; failClaude(e);
  }
  msg.pending = false; st.busy = null; renderAll();
}

// ── 내보내기 ─────────────────────────────────────
function summaryRows(p) {
  return [["묶음", "항목", "적용 값", "판정", "판정 이유", "모순", "출처 문서", "쪽", "근거 조항", "담당", "근거 원문", "문서별 값", "검토 완료"],
    ...items(p).map(i => [i.group, i.label, valTxt(i), RISK[i.risk], i.risk_reason, i.undetermined ? "모순(값 미정)" : i.conflict ? "추가 공고 반영" : "", i.undetermined ? "" : i.docName, i.undetermined ? "" : i.pages.join(","), i.clause || "", i.dept, i.undetermined ? "" : i.evidence,
      i.candidates.map(c => `${c.value} @ ${c.docName} p.${c.page}`).join(" / "), review(p)[i.key] ? "예" : ""])];
}
function allDrafts(p) { const d = drafts(p); return [...d.Q, ...d.D, ...techDrafts(p)]; }
const KIND = x => x.id[0] === "Q" ? "질의" : x.id[0] === "D" ? "이탈" : "기술 후보";
function draftRows(p) { return [["번호", "구분", "항목", "근거", "출처", "담당", "한국어 요약", "제출 문안"], ...allDrafts(p).map(x => [x.id, KIND(x), x.label, x.basis, x.where, x.owner, x.ko, x.en])]; }
const hasTBD = arr => arr.some(x => /\[TBD/.test(x.en));
async function saveCsv(p, which) {
  const rows = which === "drafts" ? draftRows(p) : summaryRows(p);
  const csv = "﻿" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  try { await st.downloads.save({ filename: `${p.name.replace(/[\\/:*?"<>|]/g, "_")}_${which === "drafts" ? "질의이탈" : "입찰요약표"}.csv`, data: csv }); toast("CSV를 저장했습니다."); }
  catch (e) { if (e.code !== "declined") toast("저장하지 못했습니다. '복사'로 엑셀에 붙여 넣어 주세요."); }
}
const copyRows = rows => copyText(rows.map(r => r.map(v => String(v ?? "").replace(/[\t\n]+/g, " ")).join("\t")).join("\n"), "표를 복사했습니다. 엑셀에 붙여 넣으세요.");
async function copyText(t, ok) { try { await navigator.clipboard.writeText(t); toast(ok); } catch { toast("복사가 막혀 있습니다. 내용을 직접 선택해 복사해 주세요."); } }
function clearToast() { const t = $("#toast"); if (t) t.hidden = true; }
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 3600); }

$("#file").onchange = e => { if (e.target.files.length) addFiles(e.target.files, st.pickInto); e.target.value = ""; };
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop", e => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files, cur()); });

// ── 시작: 가상 샘플 입찰 건 2개 ─────────────────────
const SAMPLES = JSON.parse($("#samples").textContent);
const first = addSamplePkg(SAMPLES.bundle); addSamplePkg(SAMPLES.ko);
st.cur = first.id; st.tab = TABS.some(t => t[0] === location.hash.slice(1)) ? location.hash.slice(1) : "summary";
renderAll();
(async () => {
  const c = window.claude; if (!c || !c.use) return;
  const [sample, downloads] = await Promise.all([c.use("sample").catch(() => null), c.use("downloads").catch(() => null)]);
  st.downloads = downloads;
  if (sample) { st.sample = sample; const lim = await sample.limits().catch(() => null); st.tools = !!(lim && lim.tools); }
  renderAll();
})();
})();
