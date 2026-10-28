"""Collect executives, ownership links and company profiles from OpenDART for each business group.

usage:
  export DART_API_KEY=...
  python scripts/collect.py --groups references/groups_2026.json --out data/ --group 삼성
  python scripts/collect.py --groups references/groups_2026.json --out data/ --rank 1-50

For every FTC-listed affiliate it
  1. finds the DART corp_code (name match, tie-broken by 법인등록번호 via company.json),
  2. pulls 임원현황 (exctvSttus) from the latest periodic report that has it,
  3. pulls 타법인출자현황 (otrCprInvstmntSttus) from the annual report and
     최대주주현황 (hyslrSttus) to link parents to subsidiaries inside the group.
Every API response is cached under <out>/cache, so a run interrupted by the
20,000 calls/day limit resumes where it stopped.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Dart, DartError, load_groups, norm_jurir, norm_name, select_groups  # noqa: E402

REPORTS = {"11011": "사업보고서", "11012": "반기보고서", "11013": "1분기보고서", "11014": "3분기보고서"}
EXEC_FIELDS = ["nm", "sexdstn", "birth_ym", "ofcps", "rgist_exctv_at", "fte_at", "chrg_job",
               "main_career", "mxmm_shrholdr_relate", "hffc_pd", "tenure_end_on"]


def pct(v):
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def periods_newer_than(year, today):
    """Periodic reports of `year` newest first, skipping ones not yet due (45 days after quarter end)."""
    due = {"11014": (11, 15), "11012": (8, 15), "11013": (5, 16)}
    out = []
    for code in ("11014", "11012", "11013"):
        m, d = due[code]
        if today >= dt.date(year, m, d):
            out.append((year, code))
    return out


class Collector:
    def __init__(self, dart, period, today, overrides=None):
        self.dart = dart
        self.overrides = {k: v for k, v in (overrides or {}).items() if not k.startswith("_")}
        self.period = period
        self.today = today
        self.index = defaultdict(list)
        for row in dart.corp_codes():
            self.index[norm_name(row["corp_name"])].append(row)

    def profile(self, corp_code):
        d = self.dart.json("company", corp_code=corp_code)
        return d if d.get("status") == "000" else None

    def match(self, aff):
        cands = self.index.get(norm_name(self.overrides.get(aff["name"], aff["name"])), [])
        if not cands:
            return None, "unmatched"
        if len(cands) == 1:
            return cands[0], "name"
        # Several DART entries share the name (old/dissolved companies): confirm by 법인등록번호.
        cands = sorted(cands, key=lambda c: (bool(c["stock_code"]), c["modify_date"]), reverse=True)
        for c in cands[:6]:
            p = self.profile(c["corp_code"])
            if p and norm_jurir(p.get("jurir_no")) == aff["jurir_no"]:
                return c, "jurir"
        return cands[0], "name-ambiguous"

    def latest_report(self, corp_code, endpoint):
        """(year, code, rows) of the newest report with data, or None. Annual first: if the company
        files no 사업보고서 at all we stop after one or two calls."""
        y = self.today.year
        annual = None
        for year in (y - 1, y - 2):
            d = self.dart.json(endpoint, corp_code=corp_code, bsns_year=str(year), reprt_code="11011")
            if d.get("status") == "000" and d.get("list"):
                annual = (year, "11011", d["list"])
                break
        if not annual or self.period == "annual":
            return annual
        for year, code in periods_newer_than(y, self.today):
            d = self.dart.json(endpoint, corp_code=corp_code, bsns_year=str(year), reprt_code=code)
            if d.get("status") == "000" and d.get("list"):
                return (year, code, d["list"])
        return annual

    def company(self, aff):
        rec = {**aff, "corp_code": None, "stock_code": "", "dart_name": None, "match": "unmatched",
               "profile": None, "report": None, "executives": [], "investments": [], "shareholders": []}
        hit, how = self.match(aff)
        if not hit:
            return rec
        rec.update(corp_code=hit["corp_code"], stock_code=hit["stock_code"], dart_name=hit["corp_name"], match=how)

        ex = self.latest_report(hit["corp_code"], "exctvSttus")
        if not ex:
            return rec  # not a periodic-report filer (most unlisted affiliates)
        year, code, rows = ex
        rec["report"] = {"bsns_year": year, "reprt_code": code, "label": f"{year} {REPORTS[code]}",
                         "rcept_no": rows[0].get("rcept_no"), "stlm_dt": rows[0].get("stlm_dt")}
        rec["executives"] = [{k: (r.get(k) or "").strip() for k in EXEC_FIELDS} for r in rows]

        p = self.profile(hit["corp_code"])
        if p:
            rec["profile"] = {k: p.get(k) for k in ("ceo_nm", "corp_cls", "jurir_no", "induty_code", "est_dt",
                                                    "adres", "hm_url", "acc_mt")}
            if aff["jurir_no"] and norm_jurir(p.get("jurir_no")) not in ("", aff["jurir_no"]):
                rec["match"] = "jurir-mismatch"  # same name, different legal entity: flag it in the page

        sh = self.dart.json("hyslrSttus", corp_code=hit["corp_code"], bsns_year=str(year), reprt_code=code)
        for r in sh.get("list", []) if sh.get("status") == "000" else []:
            kind = r.get("stock_knd") or ""
            if r.get("nm") in ("계", "합계", "-") or ("우선" in kind):
                continue
            rec["shareholders"].append({"name": r.get("nm"), "relate": r.get("relate"), "stock_kind": kind,
                                        "stake": pct(r.get("trmend_posesn_stock_qota_rt"))})

        inv = self.latest_report_annual(hit["corp_code"], "otrCprInvstmntSttus")
        for r in inv:
            name = (r.get("inv_prm") or "").strip()
            if not name or name in ("합계", "계", "-"):
                continue
            rec["investments"].append({"name": name, "purpose": r.get("invstmnt_purps"),
                                       "stake": pct(r.get("trmend_blce_qota_rt"))})
        return rec

    def latest_report_annual(self, corp_code, endpoint):
        for year in (self.today.year - 1, self.today.year - 2):
            d = self.dart.json(endpoint, corp_code=corp_code, bsns_year=str(year), reprt_code="11011")
            if d.get("status") == "000" and d.get("list"):
                return d["list"]
        return []


def link(group, companies):
    """Ownership edges inside the group: parent -> child with stake (%)."""
    by_key = {}
    for c in companies:
        by_key[norm_name(c["name"])] = c["name"]
        if c.get("dart_name"):
            by_key[norm_name(c["dart_name"])] = c["name"]
    owner_key = norm_name(group["same_person"])
    edges = {}

    def add(parent, child, stake, source):
        if parent == child or stake is None or stake <= 0:
            return
        k = (parent, child)
        if k not in edges or stake > edges[k]["stake"]:
            edges[k] = {"parent": parent, "child": child, "stake": round(stake, 2), "source": source}

    for c in companies:
        for i in c["investments"]:
            child = by_key.get(norm_name(i["name"]))
            if child:
                add(c["name"], child, i["stake"], "타법인출자현황")
        for s in c["shareholders"]:
            k = norm_name(s["name"])
            if k in by_key:
                add(by_key[k], c["name"], s["stake"], "최대주주현황")
            elif k == owner_key:
                add("__OWNER__", c["name"], s["stake"], "최대주주현황")
    return list(edges.values())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--groups", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--group", help="기업집단명/별칭, 쉼표 구분 (예: 삼성,SK)")
    ap.add_argument("--rank", help="순위 범위 (예: 1-50). --group 과 함께 쓰지 않습니다. 기본 1-50")
    ap.add_argument("--period", choices=["latest", "annual"], default="latest",
                    help="latest: 가장 최근 정기보고서(분기/반기 포함), annual: 직전 사업보고서")
    ap.add_argument("--listed-only", action="store_true", help="상장사만 조회 (호출 수 절감)")
    ap.add_argument("--overrides", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                                                        "references", "name_overrides.json"),
                    help="공정위명 -> DART명 수동 매핑 JSON")
    ap.add_argument("--today", help="기준일 YYYY-MM-DD (테스트용)")
    a = ap.parse_args()

    today = dt.date.fromisoformat(a.today) if a.today else dt.date.today()
    doc = load_groups(a.groups)
    groups = select_groups(doc, a.group, a.rank)
    os.makedirs(a.out, exist_ok=True)
    try:
        dart = Dart(os.environ.get("DART_API_KEY", "").strip(), os.path.join(a.out, "cache"))
        overrides = {}
        if os.path.exists(a.overrides):
            with open(a.overrides, encoding="utf-8") as f:
                overrides = json.load(f)
        col = Collector(dart, a.period, today, overrides)
        for g in groups:
            affs = g["affiliates"]
            companies = []
            for aff in affs:
                if a.listed_only:
                    hit = col.index.get(norm_name(col.overrides.get(aff["name"], aff["name"])), [])
                    if not any(h["stock_code"] for h in hit):
                        companies.append({**aff, "corp_code": None, "stock_code": "", "dart_name": None,
                                          "match": "skipped", "profile": None, "report": None,
                                          "executives": [], "investments": [], "shareholders": []})
                        continue
                companies.append(col.company(aff))
            out = {
                "group": {k: v for k, v in g.items() if k != "affiliates"},
                "source": doc["source"],
                "collected_at": dt.datetime.now().isoformat(timespec="seconds"),
                "period": a.period,
                "companies": companies,
                "edges": link(g, companies),
            }
            fn = os.path.join(a.out, f"{g['rank']:03d}_{re.sub(r'[^0-9A-Za-z가-힣]', '', g['name'])}.json")
            with open(fn, "w", encoding="utf-8") as f:
                json.dump(out, f, ensure_ascii=False, indent=1)
            n_ex = sum(1 for c in companies if c["executives"])
            n_un = sum(1 for c in companies if c["match"] == "unmatched")
            print(f"[{g['rank']:>3}] {g['name']}: 계열사 {len(companies)} / DART 미등록 {n_un} / "
                  f"임원현황 {n_ex}개사 {sum(len(c['executives']) for c in companies)}명 / "
                  f"지분연결 {len(out['edges'])} -> {fn}  (누적 API {dart.calls}건)")
    except DartError as e:
        sys.exit(f"중단: {e}")


if __name__ == "__main__":
    main()
