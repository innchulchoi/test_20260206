"""문서 저장소 + 분석 파이프라인 (업로드 → 파싱 → 색인 → 규칙 추출 → Claude 추출)."""
from __future__ import annotations

import json
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from . import llm
from .checklist import CATEGORIES
from .parser import ParsedDocument, parse_document
from .retrieval import BM25Index
from .rules import extract_rules

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@dataclass
class Record:
    id: str
    filename: str
    path: Path
    status: str = "queued"  # queued | parsing | extracting | done | error
    message: str = ""
    created_at: float = field(default_factory=time.time)
    doc: ParsedDocument | None = None
    index: BM25Index | None = None
    extraction: dict | None = None

    def summary(self) -> dict:
        ex = self.extraction or {}
        items = ex.get("items", [])
        return {
            "id": self.id,
            "filename": self.filename,
            "status": self.status,
            "message": self.message,
            "created_at": self.created_at,
            "pages": self.doc.page_count if self.doc else None,
            "kind": self.doc.kind if self.doc else None,
            "engine": ex.get("engine"),
            "risk_counts": {lvl: sum(1 for i in items if i["risk"] == lvl) for lvl in ("high", "medium", "low")},
            "found": sum(1 for i in items if i["found"]),
            "total": len(items),
        }


class Store:
    def __init__(self):
        self.records: dict[str, Record] = {}
        self.lock = threading.Lock()
        (DATA_DIR / "uploads").mkdir(parents=True, exist_ok=True)

    def add(self, filename: str, content: bytes) -> Record:
        rid = uuid.uuid4().hex[:12]
        safe = Path(filename).name
        path = DATA_DIR / "uploads" / f"{rid}_{safe}"
        path.write_bytes(content)
        rec = Record(id=rid, filename=safe, path=path)
        with self.lock:
            self.records[rid] = rec
        threading.Thread(target=self.analyze, args=(rec,), daemon=True).start()
        return rec

    def get(self, rid: str) -> Record | None:
        return self.records.get(rid)

    def list(self) -> list[Record]:
        return sorted(self.records.values(), key=lambda r: r.created_at, reverse=True)

    def analyze(self, rec: Record, use_llm: bool | None = None) -> None:
        try:
            if rec.doc is None:
                rec.status, rec.message = "parsing", "문서를 읽고 색인하는 중"
                rec.doc = parse_document(rec.path, rec.filename)
                rec.index = BM25Index(rec.doc.chunks)
            rec.status, rec.message = "extracting", "규칙 엔진으로 주요 항목 추출 중"
            rules = extract_rules(rec.doc, rec.index)
            rec.extraction = {"engine": "rule", "items": rules, "overall_summary": "", "top_risks": [],
                              "categories": CATEGORIES}
            if use_llm is None:
                use_llm = llm.available()
            if use_llm:
                rec.message = f"Claude({llm.MODEL})가 근거를 읽고 항목을 검증하는 중"
                try:
                    out = llm.extract_with_claude(rec.doc, rec.index, rules)
                    rec.extraction = {"engine": "claude", "categories": CATEGORIES, **out}
                    rec.message = ""
                except Exception as e:  # LLM 실패 시 규칙 결과는 유지
                    rec.message = f"Claude 추출 실패, 규칙 엔진 결과를 표시합니다: {type(e).__name__}: {e}"
            else:
                rec.message = ""
            if rec.extraction["engine"] == "rule":
                rec.extraction["top_risks"] = [
                    f"{i['label']}: {i['risk_reason']}" for i in rules if i["risk"] == "high"
                ]
            rec.status = "done"
            self._persist(rec)
        except Exception as e:
            rec.status, rec.message = "error", f"{e}"
            traceback.print_exc()

    def _persist(self, rec: Record) -> None:
        out = DATA_DIR / "results" / f"{rec.id}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"document": rec.summary(), "extraction": rec.extraction},
                                  ensure_ascii=False, indent=2), encoding="utf-8")


store = Store()
