"""Turn the FTC designation spreadsheets into references/groups_<year>.json.

공정위가 매년 5월 1일자로 발표하는 보도자료 별첨 중
  (별첨2) 공시대상기업집단 지정현황.xlsx   -> 순위, 기업집단명, 동일인, 계열사 수, 공정자산총액
  (별첨5) 공시대상기업집단 계열회사 현황.xlsx -> 기업집단별 소속회사 명단, 법인등록번호, 금융/비금융 구분
을 읽습니다.

usage: python scripts/build_groups.py --designation designation.xlsx --affiliates affiliates.xlsx \
           --year 2026 --out references/groups_2026.json
"""
import argparse
import json
import re

import openpyxl

# Common English/short names people type, keyed by the FTC group name.
ALIASES = {
    "에스케이": ["SK"], "엘지": ["LG"], "현대자동차": ["현대차", "Hyundai Motor"], "포스코": ["POSCO"],
    "HD현대": ["현대중공업", "에이치디현대"], "지에스": ["GS"], "케이티": ["KT"], "엘에스": ["LS"],
    "씨제이": ["CJ"], "에이치엠엠": ["HMM"], "네이버": ["NAVER"], "에쓰-오일": ["S-Oil", "에스오일"],
    "DL": ["대림", "디엘"], "한국앤컴퍼니그룹": ["한국타이어", "한국앤컴퍼니"], "케이씨씨": ["KCC"],
    "에이치디씨": ["HDC", "현대산업개발"], "SM": ["삼라마이다스", "에스엠"], "DB": ["동부", "디비"],
    "케이티앤지": ["KT&G"], "교보생명보험": ["교보"], "엘엑스": ["LX"], "오씨아이": ["OCI"],
    "다우키움": ["키움"], "한국지엠": ["GM", "한국GM"], "삼성": ["Samsung"], "롯데": ["Lotte"],
    "한화": ["Hanwha"], "농협": ["NH", "농협중앙회"], "카카오": ["Kakao"], "쿠팡": ["Coupang"],
    "HL": ["한라"], "KG": ["케이지"], "BS": ["보성"], "BGF": ["비지에프"], "DN": ["동남"],
    "엘아이지": ["LIG"], "QCP그룹(舊 큐로홀딩스)": ["QCP", "큐로홀딩스"],
}


def num(v):
    return v if isinstance(v, (int, float)) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--designation", required=True)
    ap.add_argument("--affiliates", required=True)
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    groups = []
    ws = openpyxl.load_workbook(a.designation, data_only=True).active
    for r in ws.iter_rows(min_row=6, values_only=True):
        rank, prev, change, name, owner, n_aff, _, assets = r[1:9]
        if not isinstance(rank, int):
            continue
        groups.append({
            "rank": rank,
            "name": name,
            "aliases": ALIASES.get(name, []),
            "same_person": owner,  # 동일인 (자연인 또는 법인)
            "prev_rank": prev if isinstance(prev, int) else None,
            "change": str(change) if change not in (0, None) else "",
            "affiliate_count": n_aff,
            "assets_krw_bn": round(num(assets) or 0, 1),  # 공정자산총액, 십억 원
            "cross_holding_restricted": (num(assets) or 0) >= 12000,  # 상호출자제한(12조 원 이상)
            "affiliates": [],
        })
    by_rank = {g["rank"]: g for g in groups}

    ws = openpyxl.load_workbook(a.affiliates, data_only=True).active
    for r in ws.iter_rows(min_row=5, values_only=True):
        rank, nonfin_name, fin_name, jurir = r[1], r[5], r[7], r[8]
        if rank not in by_rank:
            continue
        name = (nonfin_name or fin_name or "").strip()
        if not name:
            continue
        by_rank[rank]["affiliates"].append({
            "name": name,
            "jurir_no": re.sub(r"\D", "", str(jurir or "")).zfill(13) if jurir else "",
            "financial": not nonfin_name,
        })

    for g in groups:
        if len(g["affiliates"]) != g["affiliate_count"]:
            print(f"경고: {g['name']} 계열사 수 {g['affiliate_count']} vs 명단 {len(g['affiliates'])}")

    doc = {
        "source": f"공정거래위원회 {a.year}년 공시대상기업집단 지정 결과 (별첨2, 별첨5), {a.year}-05-01 기준",
        "year": a.year,
        "units": {"assets_krw_bn": "십억 원"},
        "groups": groups,
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print(f"{len(groups)}개 기업집단, {sum(len(g['affiliates']) for g in groups)}개 소속회사 -> {a.out}")


if __name__ == "__main__":
    main()
