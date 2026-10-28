"""Read executive tables straight from a periodic report's original document (DART document.xml).

Many large companies (삼성전자, 삼성SDI ...) send only 등기임원 through the exctvSttus API and
publish the 미등기임원 list as a table in the report body ("VIII. 임원 및 직원 등에 관한 사항 >
1. 임원 및 직원 등의 현황 > 미등기임원 현황"). This module pulls every executive table out of
that section and maps its columns to the same field names exctvSttus uses.

The report XML is DART's own dialect and is not always well formed, so tables are read with
regular expressions rather than an XML parser.
"""
import html
import io
import re
import zipfile

# Bump when parsing changes: cached results live under cache/document_v<VERSION>/.
VERSION = 2

# Header text (spaces removed) -> exctvSttus field.
COLUMNS = {
    "성명": "nm", "성별": "sexdstn", "출생연월": "birth_ym", "출생년월": "birth_ym", "직위": "ofcps",
    "등기임원여부": "rgist_exctv_at", "상근여부": "fte_at", "담당업무": "chrg_job", "주요경력": "main_career",
    "학력": "education", "최대주주와의관계": "mxmm_shrholdr_relate", "재직기간": "hffc_pd",
    "임기만료일": "tenure_end_on",
}
# Tables in the same section that also have 성명/직위 columns but are not the executive roster.
SKIP_HEADERS = ("겸직", "변동", "구분", "선임", "해임", "퇴임", "사유")

_TAG = re.compile(r"<[^>]+>")
_TABLE = re.compile(r"<TABLE\b.*?</TABLE>", re.S | re.I)
_ROW = re.compile(r"<TR\b.*?</TR>", re.S | re.I)
# Cells are <TD>/<TH>, or <TE>/<TU> for fields DART's form editor tags with a code (SH5_NM_T ...).
_CELL = re.compile(r"<(T[DHEU])\b([^>]*)>(.*?)</T[DHEU]>", re.S | re.I)
_SPAN = re.compile(r"COLSPAN=\"?(\d+)", re.I)


def unzip_document(raw):
    """document.xml returns a zip of one or more XML files; the main report is the largest one."""
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        name = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
        data = z.read(name)
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", "replace")


def text(cell_html):
    s = html.unescape(_TAG.sub(" ", cell_html)).replace("　", " ").replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return "" if s in ("-", "–") else s


def exec_section(doc):
    """Body of '임원 및 직원 등의 현황' up to the next table-of-contents title."""
    m = re.search(r"<TITLE[^>]*>[^<]*임원\s*및\s*직원\s*등의\s*현황[^<]*</TITLE>", doc)
    if not m:
        m = re.search(r"임원\s*및\s*직원\s*등의\s*현황", doc)
        if not m:
            return ""
    end = re.search(r"<TITLE\s+ATOC=\"Y\"", doc[m.end():])
    return doc[m.end(): m.end() + end.start()] if end else doc[m.end():]


def colname(s):
    """'재직기간(최초선임일)' -> '재직기간', '담당 업무' -> '담당업무'."""
    return re.sub(r"\s+", "", re.sub(r"\(.*?\)", "", s))


def parse_rows(table_html):
    rows = []
    for tr in _ROW.findall(table_html):
        cells = []
        for tag, attrs, body in _CELL.findall(tr):
            span = _SPAN.search(attrs)
            cells.append((tag.upper(), int(span.group(1)) if span else 1, text(body)))
        if cells:
            rows.append(cells)
    return rows


def header_columns(rows):
    """Column names and the index of the first data row. Handles a two-row header where a
    COLSPAN cell in the first row ('소유주식수') is split by the second row."""
    for i, row in enumerate(rows):
        names = [colname(c[2]) for c in row]
        if "성명" in names and "직위" in names:
            break
    else:
        return None, None
    first = rows[i]
    if any(span > 1 for _, span, _ in first) and i + 1 < len(rows):
        sub = [colname(c[2]) for c in rows[i + 1]]
        cols, k = [], 0
        for _, span, name in first:
            name = colname(name)
            if span > 1:
                cols += [f"{name}:{s}" for s in sub[k:k + span]]
                k += span
            else:
                cols.append(name)
        return cols, i + 2
    return [colname(c[2]) for c in first], i + 1


def executives_from_document(doc):
    """List of executive dicts (exctvSttus field names) from every roster table in the section.
    A table without a 등기임원여부 column is the 미등기임원 table, so its rows are marked 미등기."""
    out = []
    for t in _TABLE.findall(exec_section(doc)):
        rows = parse_rows(t)
        cols, start = header_columns(rows)
        if not cols or any(s in c for c in cols for s in SKIP_HEADERS) or "담당업무" not in cols:
            continue
        registered_col = "등기임원여부" in cols
        for row in rows[start:]:
            vals = [c[2] for c in row]
            if len(vals) != len(cols) or not vals[0] or vals[0] == "성명":
                continue
            e = {}
            for name, v in zip(cols, vals):
                f = COLUMNS.get(name)
                if f:
                    e[f] = v
            if not e.get("nm") or not e.get("ofcps"):
                continue
            if not registered_col:
                e["rgist_exctv_at"] = "미등기"
            edu = e.pop("education", "")
            if edu:
                e["main_career"] = " · ".join(x for x in (e.get("main_career", ""), edu) if x)
            out.append(e)
    return out
