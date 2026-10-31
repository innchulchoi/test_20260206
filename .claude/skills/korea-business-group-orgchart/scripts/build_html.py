"""Render collected group data into one self-contained HTML org-chart page.

usage:
  python scripts/build_html.py --groups references/groups_2026.json --data data/ --out out/orgchart.html
  python scripts/build_html.py --groups references/groups_2026.json --data data/ --out out/samsung.html --group 삼성

Without collected data for a group the page still lists the group and its FTC affiliates,
marked "공시 미수집", so the 50-group overview is useful before DART collection finishes.
"""
import argparse
import datetime as dt
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
# "事" is the 사업부 abbreviation some companies use ("중대형事").
UNIT_SUFFIXES = ("사업부문", "사업본부", "사업부", "事", "부문", "본부", "총괄", "연구소", "연구원", "센터",
                 "그룹", "법인", "실", "팀", "단", "원", "부", "소")
ROLE_WORDS = re.compile(r"(장|대표|담당|리더|책임자|CEO|CFO|CTO|COO|CHO|CSO|CISO|CPO|임원|위원)$", re.I)


SPLIT_DUTIES = re.compile(r"\s*(?:겸|/|,|，|;|ㆍ|\n|\(|\[)\s*")


# All-caps abbreviations name units too ('DSC 담당임원', 'SAS법인장'); C-level ones ('CTO') are always
# a unit of their own, other abbreviations join a following unit word ('DRAM TD팀').
ACRONYM = re.compile(r"^[A-Z][A-Z0-9&-]{1,7}$")
MAX_DEPTH = 5


def unit_path(chrg_job, leading=frozenset()):
    """Organisational path and whether the person heads its last unit.

    'DS부문 CTO 반도체연구소 공정개발실장' -> (['DS부문', 'CTO', '반도체연구소', '공정개발실'], True)
    'DS부문 DSC 담당임원'                -> (['DS부문', 'DSC'], False)

    Only leading tokens that look like organisational units are kept; a trailing title such as
    '실장' is folded back into its unit and marks the head. A unit may span up to three words
    ('Mobile eXperience사업부'). `leading` holds first words that many executives of the same company
    share ('메모리', 'Foundry'); such a word counts as a unit even without a unit suffix. With several
    duties ('대표이사 겸 DX부문장') the first one that names a unit is used."""
    s = (chrg_job or "").strip()
    if not s or s in ("-", "–"):
        return [], False
    for part in SPLIT_DUTIES.split(s):
        toks = [t.strip("·.") for t in part.split() if t.strip("·.")]
        path, buf, head = [], [], False
        for n in (2, 1):
            if len(toks) > n and " ".join(toks[:n]) in leading:
                path.append(" ".join(toks[:n]))
                toks = toks[n:]
                break
        for i, t in enumerate(toks):
            last = i == len(toks) - 1
            nxt = toks[i + 1] if not last else ""
            base = re.sub(r"장$", "", t)
            if base != t and base.endswith(UNIT_SUFFIXES) and len(base) > 1:
                if base in UNIT_SUFFIXES and path and not buf:
                    head = True  # 'AI혁신본부 본부장': the head of the unit just named, not a unit '본부'
                    break
                path.append(" ".join(buf + [base]))
                head = True
                break
            if t.endswith(UNIT_SUFFIXES) and not ROLE_WORDS.search(t) and len(t) > 1:
                path.append(" ".join(buf + [t]))
                buf = []
                head = last and t.endswith("총괄")
                continue
            if ACRONYM.match(t):
                if ROLE_WORDS.search(t):  # CTO, CFO ...
                    path.append(" ".join(buf + [t]) if buf else t)
                    buf = []
                    head = last
                    continue
                if nxt.endswith(UNIT_SUFFIXES) or re.sub(r"장$", "", nxt).endswith(UNIT_SUFFIXES):
                    buf.append(t)
                else:
                    path.append(" ".join(buf + [t]))
                    buf = []
                continue
            if ROLE_WORDS.search(t):
                if buf and re.match(r"^(담당|담당임원|임원)$", t):
                    path.append(" ".join(buf))  # 'Global CS 담당임원': a member of that unit
                break
            if len(buf) == 2:
                break
            buf.append(t)
        if path:
            return path[:MAX_DEPTH], head and len(path) <= MAX_DEPTH
    return [], False


GENERIC_LEADING = {"Global", "글로벌", "Samsung", "삼성", "전사", "그룹"}


def leading_words(executives, min_count=5):
    """First one or two words of the duty that at least `min_count` executives share. A word that
    is nearly always followed by the same word ('글로벌' -> '제조&인프라총괄') is only the first half
    of a longer name, so it is left out and the pair is judged instead."""
    count, after = {}, {}
    for e in executives:
        toks = [t.strip("·.") for t in SPLIT_DUTIES.split((e.get("chrg_job") or "").strip())[0].split()]
        for n in (1, 2):
            if len(toks) > n:
                k = " ".join(toks[:n])
                count[k] = count.get(k, 0) + 1
                nxt = after.setdefault(k, {})
                nxt[toks[n]] = nxt.get(toks[n], 0) + 1
    return frozenset(k for k, c in count.items()
                     if c >= min_count and not ROLE_WORDS.search(k) and not k.endswith(UNIT_SUFFIXES)
                     and k not in GENERIC_LEADING
                     and max(after[k].values()) < 0.6 * c)


def is_registered(e):
    """DART 등기임원여부 is '사내이사'/'사외이사'/'기타비상무이사'/'감사'... or '미등기'."""
    v = (e.get("rgist_exctv_at") or "").strip()
    return bool(v) and v != "-" and "미등기" not in v


# Top-level unit categories, judged from the unit name. Order matters: the first match wins.
# Overseas subsidiaries are written as codes ('SEA', 'SEVT법인', 'SIEL-S', 'SRA연구소'); regional
# headquarters as '<region>총괄'. SAIT (종합기술원) looks like a code but is a domestic lab.
REGION = re.compile(r"^(?!SAIT$)(S|TS|DS)[A-Z]{1,6}(-[A-Za-z.]+)?(법인|연구소)?$|법인$|^S[A-Z]+-?[A-Za-z]*연구소$|"
                    r"^(한국|북미|구주|유럽|중국|동남아|서남아|중남미|중동|아프리카|CIS|일본|미주|아시아|인도|베트남)")
STAFF = re.compile(r"법무|People|인사|인재|재경|재무|IR|경영|기획|구매|커뮤니케이션|홍보|대외|감사|진단|Compliance|준법|"
                   r"정보보호|상생|지원|Public Affairs|Corporate|지속가능|브랜드|전략협력|협력팀|비서|CFO|CHO", re.I)
RND = re.compile(r"연구|Research|SAIT|기술원|CTO|개발|디자인|Lab|AI|Data|데이터|DX센터|CDO|플랫폼|생산기술|미래|로봇", re.I)


# A business division names itself as one (…부문, …사업부) or carries sub-units of its own; smaller
# company-wide units such as CX센터, D2C센터, AX팀 are 전사 기능, not lines of business.
BIZ = re.compile(r"(부문|사업부|사업본부|사업부문)$")


def category(node, divisions=()):
    name = node["name"]
    if REGION.search(name):
        return "region"
    if name in divisions or BIZ.search(name) or (node["size"] >= 30 and len(node["children"]) >= 3 and not STAFF.search(name)):
        return "biz" if not RND.search(name) or name in divisions or BIZ.search(name) else "rnd"
    if STAFF.search(name):
        return "staff"
    if RND.search(name):
        return "rnd"
    return "fn"


# Function tags read from the duty text and the unit path: what a person is responsible for.
TAGS = [
    ("AI", re.compile(r"(?<![A-Za-z])AI(?![A-Za-z])|인공지능|LLM|GenAI|생성형|에이전트|Agent|ML(?![A-Za-z])|머신러닝|딥러닝", re.I)),
    ("데이터", re.compile(r"Data|데이터|Analytics|Big ?Data", re.I)),
    # '혁신' alone also names quality/process improvement teams, so only digital kinds of 혁신 count
    # Samsung's 'DX부문' is Device eXperience, a business division, not digital transformation
    ("DX", re.compile(r"(?<![A-Za-z])(DX(?!\s*(부문|사업부))|AX|PI)(?![A-Za-z])|디지털|Digital(?!\s*(Wallet|Appliance|Display))|Twin|자동화|스마트팩토리|Smart ?Factory|(AI|DX|AX|디지털)\s*(&\s*)?혁신", re.I)),
    # 'IT' only as a function (IT전략, IT팀 …), not product words like 'IT광학'
    ("IT·보안", re.compile(r"(?<![A-Za-z])IT(?=\s*(전략|기획|운영|팀|센터|인프라|서비스|실|담당|부|$))|정보전략|정보시스템|SW|소프트웨어|Software|클라우드|Cloud|보안|Security|CISO|CIO", re.I)),
    ("전략", re.compile(r"전략|기획|CSO|경영지원|사업지원|Corporate", re.I)),
    ("구매", re.compile(r"구매|조달|Procurement|SCM|공급망", re.I)),
    ("인사", re.compile(r"People|인사(?!이트)|인재|HR(?![A-Za-z])|CHO", re.I)),
    ("재무", re.compile(r"재경|재무|CFO|IR(?![A-Za-z])|Finance|회계", re.I)),
    ("영업·마케팅", re.compile(r"영업|마케팅|Sales|B2B|CX|고객|Marketing", re.I)),
]
TOP_RANKS = ("회장", "부회장", "사장")
RANK_ORDER = ["회장", "부회장", "사장", "부사장", "전무", "상무", "상무보", "이사"]


def rank_index(p):
    p = re.sub(r"\s", "", p or "")
    for i, r in enumerate(RANK_ORDER):
        if p == r:
            return i
    for i, r in enumerate(RANK_ORDER):
        if p.endswith(r):
            return i
    return 99


def restructure(tree, conf):
    """Merge alias units ('Foundry사업부' into 'Foundry', 'SEVT법인' into 'SEVT') and hang top-level
    units under the division named in unit_structure.json. Works on the dict form before finish()."""
    kids = tree["children"]
    aliases = dict(conf.get("aliases", {}))
    for name in list(kids):
        for suf in ("사업부", "법인"):
            if name.endswith(suf) and name[: -len(suf)] in kids:
                aliases.setdefault(name, name[: -len(suf)])

    def merge(dst, src):
        dst["people"] += src["people"]
        dst["heads"] += src["heads"]
        for k, v in src["children"].items():
            if k in dst["children"]:
                merge(dst["children"][k], v)
            else:
                dst["children"][k] = v

    for a, target in aliases.items():
        if a in kids and target in kids and a != target:
            merge(kids[target], kids.pop(a))
    for child, parent in conf.get("parents", {}).items():
        if child in kids and child != parent:
            node = kids.pop(child)
            par = kids.setdefault(parent, {"name": parent, "people": [], "heads": [], "children": {}})
            if child in par["children"]:
                merge(par["children"][child], node)
            else:
                par["children"][child] = node


def org_tree(executives, conf=None):
    """Nest 미등기 executives by unit path; executives without a unit stay at the root. Each unit
    lists the people placed in it and, separately, those whose duty names them its head."""
    root = {"name": "", "people": [], "heads": [], "children": {}}
    leading = leading_words([e for e in executives if not is_registered(e)])
    for i, e in enumerate(executives):
        if is_registered(e):
            continue
        node = root
        path, head = unit_path(e.get("chrg_job"), leading)
        for u in path:
            node = node["children"].setdefault(u, {"name": u, "people": [], "heads": [], "children": {}})
        node["people"].append(i)
        if head:
            node["heads"].append(i)
    restructure(root, conf or {})

    # 등기임원 sit on the board, not in the chart, but a director whose duty says 'DX부문장 직무대행ㆍ
    # MX사업부장' or 'DS부문 경영전반 총괄' still heads those units. Every duty part is checked and the
    # unit is looked up anywhere in the tree (after restructure), also without '사업부' and via aliases.
    alias = (conf or {}).get("head_aliases", {})

    index = {}
    queue = [root]
    while queue:  # breadth first, so the shallowest unit of a name wins
        n = queue.pop(0)
        for k, c in n["children"].items():
            index.setdefault(k, c)
            queue.append(c)

    def lookup(name):
        for cand in (name, alias.get(name, ""), re.sub(r"사업부$", "", name)):
            if cand and cand in index:
                return index[cand]
        return None

    for i, e in enumerate(executives):
        if not is_registered(e):
            continue
        for part in SPLIT_DUTIES.split((e.get("chrg_job") or "").replace("(", " ").replace(")", " ")):
            part = re.sub(r"^\s*(대표이사|사내이사)\s*", "", part)
            path, head = unit_path(part, leading)
            if path and len(path) > 1 and "경영전반" in path[-1]:
                path, head = path[:-1], True  # 'DS부문 경영전반 총괄' heads DS부문
            node = lookup(path[-1]) if path and head else None
            if node is not None and i not in node["heads"]:
                node["heads"].append(i)

    def finish(n):
        kids = []
        for c in n["children"].values():
            c = finish(c)
            # 'DS부문 CTO' alone makes a one-person CTO unit with no members: fold that person back
            # into the parent so a C-level title does not become an empty box.
            if not c["children"] and len(c["people"]) == 1 and ACRONYM.match(c["name"]) and ROLE_WORDS.search(c["name"]):
                n["people"] += c["people"]
                continue
            kids.append(c)
        kids.sort(key=lambda c: -c["size"])
        size = len(n["people"]) + sum(k["size"] for k in kids)
        return {"name": n["name"], "people": n["people"], "heads": n["heads"], "children": kids, "size": size}

    tree = finish(root)
    divisions = set((conf or {}).get("parents", {}).values())
    for k in tree["children"]:
        k["cat"] = category(k, divisions)
    return tree


def annotate(executives, tree, prev):
    """Per-person fields the page uses: function tags, decision tier, and change vs. a year earlier."""
    leading = leading_words([e for e in executives if not is_registered(e)])
    where = {}

    def walk(n, path, depth):
        for i in n["people"]:
            where[i] = (path, depth)
        for k in n["children"]:
            walk(k, path + [k["name"]], depth + 1)
    walk(tree, [], 0)
    heads = {}

    def hwalk(n, depth):
        for i in n.get("heads", []):
            heads[i] = min(heads.get(i, 99), depth)
        for k in n["children"]:
            hwalk(k, depth + 1)
    hwalk(tree, 0)
    big_head = {}

    def bwalk(n, depth):
        if depth and depth <= 2 and n["size"] >= 20:
            for i in n.get("heads", []):
                big_head[i] = True
        for k in n["children"]:
            bwalk(k, depth + 1)
    bwalk(tree, 0)

    old = {}
    for p in (prev or {}).get("people", []):
        old[(p["nm"], re.sub(r"\D", "", p.get("birth_ym", ""))[:6])] = p
    for i, e in enumerate(executives):
        path, _ = where.get(i, ([], 0))
        # tag what the person does, not every unit above them: a People팀 inside AI센터 is HR work.
        # Use the person's own unit plus whatever the duty says after the unit names.
        job = e.get("chrg_job") or ""
        rest = job
        for u in path:
            rest = rest.replace(u, " ")
        text = " ".join([path[-1] if path else job, rest])
        e["tags"], e["tag_src"] = [], {}
        for t, rx in TAGS:
            m = rx.search(text)
            if m:
                e["tags"].append(t)
                e["tag_src"][t] = m.group(0)  # the words that triggered the tag, shown on the page
        top = (e.get("ofcps") or "").replace(" ", "") in TOP_RANKS
        hd = heads.get(i)
        # 결정권자: 사장 이상, or the head of a sizeable unit near the top (부문·사업부·총괄급)
        e["tier"] = 1 if top or (hd is not None and big_head.get(i)) else 2 if hd is not None else 3
        if prev:
            o = old.get((e.get("nm"), re.sub(r"\D", "", e.get("birth_ym", ""))[:6]))
            if not o:
                e["chg"] = "신규"
            elif rank_index(e.get("ofcps")) < rank_index(o.get("ofcps")):
                e["chg"] = "승진"
                e["prev"] = f"{o.get('ofcps', '')} · {o.get('chrg_job', '')}"
            else:
                # a move means the top two units differ; wording changes inside the same unit are ignored
                was = [u.replace("사업부", "") for u in unit_path(o.get("chrg_job"), leading)[0][:2]]
                now = [u.replace("사업부", "") for u in path[:2]]
                if was and now and was[0] != now[0] and was[0] not in now and now[0] not in was:
                    e["chg"] = "이동"
                    e["prev"] = f"{o.get('ofcps', '')} · {o.get('chrg_job', '')}"


def news_heads(c, rec, aliases):
    """An article that calls a linked person '<unit>장' (윤장현 'DX부문 CTO 사장 겸 삼성리서치장') names that unit's
    head. Recorded separately from the disclosure (node['news_heads']) so the page can label the source."""
    nodes = {}
    queue = [c["org"]]
    while queue:
        n = queue.pop(0)
        for k in n["children"]:
            nodes.setdefault(k["name"], k)
            queue.append(k)
    ex = c["executives"]
    for i in rec["pids"]:
        role = rec["roles"].get(ex[i].get("nm"), "")
        for part in re.split(r"\s*(?:겸|·|,|/)\s*", role):
            for tok in re.findall(r"([0-9A-Za-z가-힣&.]+?)(?:장|원장)(?=$|\s|\(|\))", part):
                for cand in (tok, aliases.get(tok, ""), tok + "사업부", re.sub(r"사업부$", "", tok)):
                    node = nodes.get(cand) if cand else None
                    if node is not None:
                        hs = node.setdefault("news_heads", [])
                        if i not in [h["i"] for h in hs]:
                            hs.append({"i": i, "src": f"{rec['outlet']} {rec['date']}", "id": rec["id"]})
                        break


def attach_news(group, items, structure=None):
    """Link news items to companies, org units and people.

    A unit name is looked up in that company's tree (shallowest match on the last name). Units the
    article is about ("primary") drive the badges and counts; the rest are kept as "mentioned".
    A person is linked only when the name is unique within the company, so namesakes are never
    joined; names that are not in the disclosure stay as plain text ("공시 외")."""
    out = []
    by_dart = {}
    for c in group["companies"]:
        for k in (c.get("dart_name"), c["name"]):
            if k:
                by_dart[re.sub(r"\(주\)|주식회사|\s", "", k)] = c
    for n, it in enumerate(sorted(items, key=lambda x: x["date"], reverse=True)):
        c = by_dart.get(re.sub(r"\(주\)|주식회사|\s", "", it.get("company", "")))
        rec = {k: it.get(k, "") for k in ("date", "outlet", "title", "url", "summary", "category", "grade", "verified")}
        rec["single_note"] = it.get("single_source_note", "")
        rec.update(id=n, company=c["name"] if c else None, paths=[], mpaths=[], pids=[], ext=[],
                   confirm=it.get("confirm", 0), roles=it.get("people_roles", {}), new_unit=None,
                   # a personnel story is a forecast unless it reports a decision: only decisions may
                   # warn that someone's disclosed title is out of date
                   kind=it.get("kind") or ("전망" if re.search(r"초읽기|전망|가능성|관측|예상|촉각|하마평|\?", it["title"]) else "확정"))
        if c and c.get("org"):
            index = {}
            queue = [(c["org"], [])]
            while queue:
                node, path = queue.pop(0)
                for k in node["children"]:
                    index.setdefault(k["name"], path + [k["name"]])
                    queue.append((k, path + [k["name"]]))
            allpaths = []
            queue = [(c["org"], [])]
            while queue:
                node, path = queue.pop(0)
                for k in node["children"]:
                    allpaths.append(path + [k["name"]])
                    queue.append((k, path + [k["name"]]))

            def resolve(text):
                """'DX부문 CTO' -> ['DX부문', 'CTO']: the last word names the unit, earlier words its ancestors."""
                words = text.split()
                if not words:
                    return []
                if text in index:
                    return index[text]
                for p in allpaths:
                    if p[-1] == words[-1] and all(w in p for w in words[:-1]):
                        return p
                return index.get(words[0], [])

            primary = set(it.get("primary") or it.get("units", [])[:1])
            for u in it.get("units", []):
                path = index.get(u.split("›")[-1])
                if path:
                    (rec["paths"] if u in primary else rec["mpaths"]).append(path)
            nu = it.get("new_unit")
            if nu and nu.get("name"):
                par = resolve(nu.get("parent", ""))
                rec["new_unit"] = {"name": nu["name"], "parent": par, "date": min(nu.get("date") or it["date"], it["date"]),
                                   "parent_text": nu.get("parent", ""), "parent_found": bool(par) or not nu.get("parent")}
            ex = c.get("executives", [])
            for name in it.get("people", []):
                idx = [i for i, e in enumerate(ex) if e.get("nm") == name]
                if len(idx) == 1:
                    rec["pids"].append(idx[0])
                else:
                    rec["ext"].append(name)
            # for a personnel story the units that matter are where the named people work
            if it.get("category") == "인사" and rec["pids"]:
                own = []
                for i in rec["pids"]:
                    p = None
                    q = [(c["org"], [])]
                    while q and p is None:
                        node, path = q.pop(0)
                        if i in node["people"]:
                            p = path
                        q += [(k, path + [k["name"]]) for k in node["children"]]
                    if p:
                        own.append(p[:2])
                if own:
                    keep = [x for x in rec["paths"] + rec["mpaths"] if x not in own]
                    rec["paths"] = [list(t) for t in dict.fromkeys(tuple(x) for x in own)]
                    rec["mpaths"] = keep
            conf = (structure or {}).get(c.get("dart_name") or "", {}) or (structure or {}).get(c["name"], {})
            news_heads(c, rec, conf.get("head_aliases", {}))
        else:
            rec["ext"] = list(it.get("people", []))
        out.append(rec)
    # one event, several articles (newsroom + press, or one story split per company): same day ±3,
    # same category, and a shared new unit, person or company-wide title word -> one event id
    for a in out:
        a["event"] = a["id"]
    by_url = {x["url"]: x["id"] for x in out}
    for a, it in zip(out, sorted(items, key=lambda x: x["date"], reverse=True)):
        if it.get("event") in by_url:  # a reviewed grouping in the data wins over the heuristic below
            a["event"] = by_url[it["event"]]
            a["event_fixed"] = True
    for i, a in enumerate(out):
        for b in out[:i]:
            if a.get("event_fixed") or b["event"] != b["id"] or a["category"] != b["category"]:
                continue
            days = abs((dt.date.fromisoformat(a["date"]) - dt.date.fromisoformat(b["date"])).days)
            same_unit = a["new_unit"] and b["new_unit"] and a["new_unit"]["name"] == b["new_unit"]["name"]
            same_people = a["company"] == b["company"] and set(a["pids"]) & set(b["pids"])
            same_title = a["outlet"] == b["outlet"] and a["title"] == b["title"]
            if days <= 3 and (same_unit or same_people or same_title):
                a["event"] = b["id"]
                break
    return out


def attach_briefs(group, briefs):
    """Per-company AI·AX briefing (interest summary, themes, questions, key people, articles) linked to
    the disclosure: people by unique name within the company, units by name anywhere in its tree."""
    norm = lambda k: re.sub(r"\(주\)|주식회사|\s", "", k or "")
    by = {}
    for c in group["companies"]:
        for k in (c.get("dart_name"), c["name"]):
            if k:
                by[norm(k)] = c
    out = []
    for b in briefs:
        c = by.get(norm(b.get("company")))
        ex = (c or {}).get("executives", [])
        uniq = lambda name: ([i for i, e in enumerate(ex) if e.get("nm") == name] or [None, None])
        pid = lambda name: (lambda ids: ids[0] if len(ids) == 1 else None)(uniq(name))
        index = {}
        if c and c.get("org"):
            q = [(c["org"], [])]
            while q:
                node, path = q.pop(0)
                for k in node["children"]:
                    index.setdefault(k["name"], path + [k["name"]])
                    q.append((k, path + [k["name"]]))
        arts = []
        for a in sorted(b.get("articles", []), key=lambda x: x.get("date", ""), reverse=True):
            names = list(dict.fromkeys(a.get("people", []) + a.get("related", [])))
            arts.append({**{k: a.get(k, "") for k in ("date", "outlet", "title", "url", "summary", "category", "grade", "single_source_note")},
                         "confirm": a.get("confirm", 0), "roles": a.get("people_roles", {}),
                         "people": [{"name": n, "pid": pid(n), "related": n in a.get("related", []) and n not in a.get("people", [])} for n in names],
                         "paths": [index[u] for u in a.get("units", []) if u in index], "unit_hint": a.get("unit_hint", "")})
        out.append({"company": c["name"] if c else b.get("company"), "label": b.get("company"), "in_disclosure": bool(c and ex),
                    "summary": b.get("interest_summary", ""), "themes": b.get("themes", []), "questions": b.get("talking_points", []),
                    "people": [{**p, "pid": pid(p.get("name"))} for p in b.get("key_people", [])], "articles": arts})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--groups", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--group")
    ap.add_argument("--rank")
    ap.add_argument("--title", default=None)
    ap.add_argument("--news", help="빌드 시 모은 보도 JSON (선택)")
    ap.add_argument("--annotate-news", action="store_true",
                    help="판정한 kind(확정/전망)·event(같은 사건 묶음 기준 URL)·신설일을 보도 JSON에 적어 둡니다(검수용)")
    ap.add_argument("--briefs", nargs="*", default=[], help="계열사별 AI·AX 브리핑 JSON(들)")
    ap.add_argument("--structure", default=os.path.join(HERE, "..", "references", "unit_structure.json"))
    a = ap.parse_args()

    doc = load_groups(a.groups)
    groups = select_groups(doc, a.group, a.rank)
    structure = {}
    if os.path.exists(a.structure):
        with open(a.structure, encoding="utf-8") as f:
            structure = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    news = []
    if a.news:
        with open(a.news, encoding="utf-8") as f:
            news = json.load(f)
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
                c["executives"] = [dict(e) for e in c["executives"]]
                conf = structure.get(c.get("dart_name") or "", {}) or structure.get(c["name"], {})
                c["org"] = org_tree(c["executives"], conf)
                prev = None
                pf = os.path.join(a.data, "prev", f"{c.get('corp_code')}.json")
                if os.path.exists(pf):
                    with open(pf, encoding="utf-8") as f:
                        prev = json.load(f)
                    c["prev_label"] = prev.get("label")
                annotate(c["executives"], c["org"], prev)
            comps.append(c)
        grp = {**meta, "collected": True, "collected_at": d.get("collected_at"),
               "companies": comps, "edges": d.get("edges", [])}
        if news:
            grp["news"] = attach_news(grp, [n for n in news if n.get("group", g["name"]) == g["name"]], structure)
            if a.annotate_news:
                by_url = {x["url"]: x for x in grp["news"]}
                lead = {x["id"]: x["url"] for x in grp["news"]}
                for item in news:
                    x = by_url.get(item["url"])
                    if not x:
                        continue
                    if item.get("category") == "인사":
                        item.setdefault("kind", x["kind"])
                    item["event"] = lead[x["event"]]
                    if x.get("new_unit") and item.get("new_unit"):
                        item["new_unit"]["date"] = x["new_unit"]["date"]
                with open(a.news, "w", encoding="utf-8") as f:
                    json.dump(news, f, ensure_ascii=False, indent=1)
        if a.briefs:
            items = []
            for fn in a.briefs:
                if os.path.exists(fn):
                    with open(fn, encoding="utf-8") as f:
                        items += json.load(f).get("companies", [])
            grp["briefs"] = attach_briefs(grp, items)
        out_groups.append(grp)

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
