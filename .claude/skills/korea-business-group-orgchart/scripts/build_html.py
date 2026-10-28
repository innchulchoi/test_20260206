"""Render collected group data into one self-contained HTML org-chart page.

usage:
  python scripts/build_html.py --groups references/groups_2026.json --data data/ --out out/orgchart.html
  python scripts/build_html.py --groups references/groups_2026.json --data data/ --out out/samsung.html --group 삼성

Without collected data for a group the page still lists the group and its FTC affiliates,
marked "공시 미수집", so the 50-group overview is useful before DART collection finishes.
"""
import argparse
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load_groups, select_groups  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "assets", "orgchart_template.html")

# Words that name an organisational unit, longest first so "사업부문" wins over "부문".
UNIT_SUFFIXES = ("사업부문", "사업본부", "사업부", "부문", "본부", "총괄", "연구소", "연구원", "센터",
                 "그룹", "실", "팀", "단", "원", "부", "소")
ROLE_WORDS = re.compile(r"(장|대표|담당|리더|책임자|CEO|CFO|CTO|COO|CHO|CSO|CISO|CPO|임원|위원)$", re.I)


def unit_path(chrg_job):
    """'DS부문 메모리사업부 D램개발실장' -> ['DS부문', '메모리사업부', 'D램개발실'].

    Only leading tokens that look like organisational units are kept; a trailing title such as
    '실장' is folded back into its unit ('D램개발실장' -> 'D램개발실'). With several duties
    ('대표이사 겸 DX부문장') the first one that names a unit is used. Max depth 3."""
    s = (chrg_job or "").strip()
    if not s or s in ("-", "–"):
        return []
    for part in re.split(r"\s*(?:겸|/|,|，|;|\n|\(|\[)\s*", s):
        path = []
        for tok in part.split():
            t = tok.strip("·.")
            base = re.sub(r"장$", "", t)
            if base != t and base.endswith(UNIT_SUFFIXES) and len(base) > 1:
                path.append(base)
                break
            if t.endswith(UNIT_SUFFIXES) and not ROLE_WORDS.search(t) and len(t) > 1:
                path.append(t)
                continue
            break
        if path:
            return path[:3]
    return []


def is_registered(e):
    """DART 등기임원여부 is '사내이사'/'사외이사'/'기타비상무이사'/'감사'... or '미등기'."""
    v = (e.get("rgist_exctv_at") or "").strip()
    return bool(v) and v != "-" and "미등기" not in v


def org_tree(executives):
    """Nest 미등기 executives by unit path; executives without a unit stay at the root."""
    root = {"name": "", "people": [], "children": {}}
    for i, e in enumerate(executives):
        if is_registered(e):
            continue
        node = root
        for u in unit_path(e.get("chrg_job")):
            node = node["children"].setdefault(u, {"name": u, "people": [], "children": {}})
        node["people"].append(i)

    def finish(n):
        kids = sorted((finish(c) for c in n["children"].values()), key=lambda c: -c["size"])
        size = len(n["people"]) + sum(k["size"] for k in kids)
        return {"name": n["name"], "people": n["people"], "children": kids, "size": size}

    return finish(root)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--groups", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--group")
    ap.add_argument("--rank")
    ap.add_argument("--title", default=None)
    a = ap.parse_args()

    doc = load_groups(a.groups)
    groups = select_groups(doc, a.group, a.rank)
    collected = {}
    for fn in glob.glob(os.path.join(a.data, "*.json")):
        with open(fn, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict) and "group" in d:
            collected[d["group"]["rank"]] = d

    out_groups, latest = [], ""
    for g in groups:
        d = collected.get(g["rank"])
        meta = {k: v for k, v in g.items() if k != "affiliates"}
        if not d:
            comps = [{"name": x["name"], "financial": x["financial"], "match": "pending"} for x in g["affiliates"]]
            out_groups.append({**meta, "collected": False, "companies": comps, "edges": []})
            continue
        latest = max(latest, d.get("collected_at", ""))
        comps = []
        for c in d["companies"]:
            c = dict(c)
            if c.get("executives"):
                c["org"] = org_tree(c["executives"])
            comps.append(c)
        out_groups.append({**meta, "collected": True, "collected_at": d.get("collected_at"),
                           "companies": comps, "edges": d.get("edges", [])})

    title = a.title or ("대한민국 50대 기업집단 조직도" if len(out_groups) > 1 else f"{out_groups[0]['name']} 그룹 조직도")
    payload = {"title": title, "source": doc["source"], "collected_at": latest, "groups": out_groups}
    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read()
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = html.replace("__TITLE__", title).replace("/*__DATA__*/null", data)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(html)
    n_done = sum(g["collected"] for g in out_groups)
    print(f"{len(out_groups)}개 그룹 (공시 수집 {n_done}개) -> {a.out} ({os.path.getsize(a.out)/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
