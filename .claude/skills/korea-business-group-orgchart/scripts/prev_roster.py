"""Fetch each company's executive roster from the same periodic report one year earlier, so the page
can flag new appointments, promotions and moves.

usage:
  python scripts/prev_roster.py --data data/ --group-file data/001_삼성.json

Writes data/prev/<corp_code>.json: {"label": "2025 반기보고서", "rcept_no": ..., "people": [{nm, birth_ym, ofcps,
chrg_job, rgist_exctv_at}]}. The API rows are used first; when they hold no 미등기임원 the report
original is read too (same rule as collect.py). Every response is cached, so reruns are cheap.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Dart  # noqa: E402

REPORTS = {"11011": "사업보고서", "11012": "반기보고서", "11013": "1분기보고서", "11014": "3분기보고서"}
FIELDS = ("nm", "birth_ym", "ofcps", "chrg_job", "rgist_exctv_at")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--group-file", required=True)
    a = ap.parse_args()
    dart = Dart(os.environ.get("DART_API_KEY", "").strip(), os.path.join(a.data, "cache"))
    with open(a.group_file, encoding="utf-8") as f:
        g = json.load(f)
    out_dir = os.path.join(a.data, "prev")
    os.makedirs(out_dir, exist_ok=True)
    done = 0
    for c in g["companies"]:
        r = c.get("report")
        if not c.get("executives") or not r:
            continue
        year, code = int(r["bsns_year"]) - 1, r["reprt_code"]
        d = dart.json("exctvSttus", corp_code=c["corp_code"], bsns_year=str(year), reprt_code=code)
        rows = d.get("list", []) if d.get("status") == "000" else []
        if not rows:
            continue
        people = [{k: (x.get(k) or "").strip() for k in FIELDS} for x in rows]
        if not any("미등기" in p["rgist_exctv_at"] for p in people):
            names = {p["nm"] for p in people}
            people += [{k: (x.get(k) or "").strip() for k in FIELDS}
                       for x in dart.document_executives(rows[0]["rcept_no"]) if x.get("nm") not in names]
        with open(os.path.join(out_dir, f"{c['corp_code']}.json"), "w", encoding="utf-8") as f:
            json.dump({"label": f"{year} {REPORTS[code]}", "rcept_no": rows[0]["rcept_no"],
                       "stlm_dt": rows[0].get("stlm_dt"), "people": people}, f, ensure_ascii=False)
        done += 1
    print(f"{done}개사 직전 연도 명단 저장 -> {out_dir} (API {dart.calls}건)")


if __name__ == "__main__":
    main()
