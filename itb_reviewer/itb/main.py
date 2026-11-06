"""ITB Reviewer API 서버.

실행:  uvicorn itb.main:app --port 8000   (itb_reviewer 폴더에서)
"""
from __future__ import annotations

import csv
import io
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from . import llm
from .service import store

STATIC = Path(__file__).resolve().parent.parent / "static"
MAX_UPLOAD_MB = 200
ALLOWED = {".pdf", ".docx", ".txt", ".md"}

app = FastAPI(title="ITB Reviewer", version="1.0.0")


def _rec(rid: str):
    rec = store.get(rid)
    if not rec:
        raise HTTPException(404, "문서를 찾을 수 없습니다.")
    return rec


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/status")
def status():
    return {"llm": llm.available(), "model": llm.MODEL if llm.available() else None}


@app.post("/api/documents")
async def upload(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "PDF, DOCX, TXT 파일만 올릴 수 있습니다.")
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"{MAX_UPLOAD_MB}MB 이하만 올릴 수 있습니다.")
    rec = store.add(file.filename, content)
    return rec.summary()


@app.get("/api/documents")
def list_documents():
    return [r.summary() for r in store.list()]


@app.get("/api/documents/{rid}")
def get_document(rid: str):
    rec = _rec(rid)
    return {**rec.summary(), "extraction": rec.extraction}


@app.post("/api/documents/{rid}/reanalyze")
def reanalyze(rid: str):
    rec = _rec(rid)
    if rec.status in ("parsing", "extracting"):
        raise HTTPException(409, "분석이 진행 중입니다.")
    import threading

    threading.Thread(target=store.analyze, args=(rec,), daemon=True).start()
    rec.status = "extracting"
    return rec.summary()


@app.get("/api/documents/{rid}/pages/{n}")
def get_page(rid: str, n: int):
    rec = _rec(rid)
    if not rec.doc or not (1 <= n <= rec.doc.page_count):
        raise HTTPException(404, "페이지가 없습니다.")
    return {"page": n, "total": rec.doc.page_count, "text": rec.doc.page_text(n), "kind": rec.doc.kind}


class ChatIn(BaseModel):
    question: str
    history: list[dict] = []


@app.post("/api/documents/{rid}/chat")
def chat(rid: str, body: ChatIn):
    rec = _rec(rid)
    if not rec.doc or not rec.index:
        raise HTTPException(409, "문서 분석이 아직 끝나지 않았습니다.")
    q = body.question.strip()
    if not q:
        raise HTTPException(400, "질문을 입력하세요.")
    if llm.available():
        try:
            return llm.chat_with_claude(rec.doc, rec.index, rec.extraction, q, body.history)
        except Exception as e:
            out = llm.chat_offline(rec.index, q)
            out["answer"] = f"Claude 호출 실패({type(e).__name__}: {e}). 관련 조항 발췌를 대신 보여 드립니다."
            return out
    return llm.chat_offline(rec.index, q)


@app.get("/api/documents/{rid}/export.csv")
def export_csv(rid: str):
    rec = _rec(rid)
    if not rec.extraction:
        raise HTTPException(409, "추출 결과가 없습니다.")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["분류", "항목", "값", "요약", "리스크", "리스크 사유", "페이지", "근거 원문", "추출 엔진"])
    for it in rec.extraction["items"]:
        w.writerow([it["category"], it["label"], it["value"], it.get("summary", ""), it["risk"],
                    it["risk_reason"], ", ".join(map(str, it["pages"])), it["evidence"], it["source"]])
    data = ("﻿" + buf.getvalue()).encode("utf-8")  # 엑셀 한글 깨짐 방지(BOM)
    name = Path(rec.filename).stem + "_ITB검토.csv"
    from urllib.parse import quote

    return StreamingResponse(io.BytesIO(data), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(name)}"})
