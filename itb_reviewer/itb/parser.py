"""ITB 문서 파서: PDF / DOCX / TXT → 페이지 단위 텍스트 + 청크.

PDF는 실제 페이지 번호를, DOCX/TXT는 약 3,000자 단위의 '가상 페이지'를 사용한다.
각 청크에는 페이지 번호와 가장 가까운 조항 제목(section)이 붙어 근거 표시에 쓰인다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

PSEUDO_PAGE_CHARS = 3000
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 200

# "1.2 Bid Security", "ARTICLE 5", "SECTION II", "제5조", "제 3 장" 같은 조항 제목
HEADING_RE = re.compile(
    r"^\s*(?:"
    r"(?:\d+(?:\.\d+){0,3})\.?\s+[A-Z가-힣][^\n]{2,80}"
    r"|(?:ARTICLE|Article|SECTION|Section|CLAUSE|Clause|PART|Part)\s+[\dIVXLC]+[^\n]{0,80}"
    r"|제\s*\d+\s*(?:조|장|절)[^\n]{0,80}"
    r")\s*$"
)


@dataclass
class Page:
    number: int
    text: str


@dataclass
class Chunk:
    id: int
    page: int
    section: str
    text: str


@dataclass
class ParsedDocument:
    filename: str
    kind: str  # pdf | docx | txt
    pages: list[Page]
    chunks: list[Chunk] = field(default_factory=list)

    @property
    def page_count(self) -> int:
        return len(self.pages)

    @property
    def char_count(self) -> int:
        return sum(len(p.text) for p in self.pages)

    def page_text(self, number: int) -> str:
        for p in self.pages:
            if p.number == number:
                return p.text
        return ""


def _table_to_text(rows: list[list]) -> str:
    out = []
    for row in rows:
        cells = [re.sub(r"\s+", " ", str(c or "")).strip() for c in row]
        if any(cells):
            out.append(" | ".join(cells))
    return "\n".join(out)


def _parse_pdf(path: Path) -> list[Page]:
    import pdfplumber

    pages: list[Page] = []
    with pdfplumber.open(path) as pdf:
        for i, pg in enumerate(pdf.pages, start=1):
            text = pg.extract_text() or ""
            try:
                tables = pg.extract_tables() or []
            except Exception:  # 표 추출 실패는 본문 추출에 영향 주지 않음
                tables = []
            for t in tables:
                tt = _table_to_text(t)
                if tt and tt not in text:
                    text += "\n[표]\n" + tt
            pages.append(Page(i, text))
    return pages


def _split_pseudo_pages(blocks: list[str]) -> list[Page]:
    pages, buf, n = [], "", 1
    for b in blocks:
        if buf and len(buf) + len(b) > PSEUDO_PAGE_CHARS:
            pages.append(Page(n, buf.strip()))
            n += 1
            buf = ""
        buf += b + "\n"
    if buf.strip():
        pages.append(Page(n, buf.strip()))
    return pages


def _parse_docx(path: Path) -> list[Page]:
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    d = docx.Document(str(path))
    blocks: list[str] = []
    # 문단과 표를 문서 순서대로 순회
    for el in d.element.body.iterchildren():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag == "p":
            t = Paragraph(el, d).text.strip()
            if t:
                blocks.append(t)
        elif tag == "tbl":
            tbl = Table(el, d)
            rows = [[c.text for c in r.cells] for r in tbl.rows]
            tt = _table_to_text(rows)
            if tt:
                blocks.append("[표]\n" + tt)
    return _split_pseudo_pages(blocks)


def _parse_txt(path: Path) -> list[Page]:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp949", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    return _split_pseudo_pages([b for b in re.split(r"\n\s*\n", text) if b.strip()])


def _chunk(pages: list[Page]) -> list[Chunk]:
    """페이지별로 약 CHUNK_CHARS 크기 청크를 만든다.

    청크의 section 은 청크 안 첫 조항 제목, 없으면 직전까지 유효한 조항 제목이다.
    """
    chunks: list[Chunk] = []
    section = ""
    cid = 0
    for p in pages:
        buf, start_section, first_heading = "", section, ""
        for line in p.text.split("\n"):
            if len(buf) + len(line) > CHUNK_CHARS and buf:
                chunks.append(Chunk(cid, p.number, first_heading or start_section, buf.strip()))
                cid += 1
                buf = buf[-CHUNK_OVERLAP:] + "\n"
                start_section, first_heading = section, ""
            if HEADING_RE.match(line) and len(line.strip()) < 100:
                section = line.strip()
                first_heading = first_heading or section
            buf += line + "\n"
        if buf.strip():
            chunks.append(Chunk(cid, p.number, first_heading or start_section, buf.strip()))
            cid += 1
    return chunks


def parse_document(path: str | Path, filename: str | None = None) -> ParsedDocument:
    path = Path(path)
    filename = filename or path.name
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        kind, pages = "pdf", _parse_pdf(path)
    elif ext == ".docx":
        kind, pages = "docx", _parse_docx(path)
    elif ext in (".txt", ".md"):
        kind, pages = "txt", _parse_txt(path)
    else:
        raise ValueError(f"지원하지 않는 형식입니다: {ext} (PDF, DOCX, TXT만 지원)")
    if not any(p.text.strip() for p in pages):
        raise ValueError("텍스트를 추출하지 못했습니다. 스캔 이미지 PDF라면 OCR이 먼저 필요합니다.")
    doc = ParsedDocument(filename=filename, kind=kind, pages=pages)
    doc.chunks = _chunk(pages)
    return doc
