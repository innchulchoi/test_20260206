"""단독 HTML(standalone/itb_reviewer.html) 생성: template.html + engine.js + 가상 샘플 페이지 텍스트.

  python standalone/build.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

from itb.parser import parse_document  # noqa: E402

samples = {}
for key, name in (("en", "sample_itb_en.pdf"), ("ko", "sample_itb_ko.docx")):
    path = ROOT / "samples" / name
    if not path.exists():
        import runpy

        runpy.run_path(str(ROOT / "samples" / "make_samples.py"), run_name="__main__")
    d = parse_document(path)
    samples[key] = {"kind": d.kind, "pages": [{"number": p.number, "text": p.text} for p in d.pages]}

data = json.dumps(samples, ensure_ascii=False).replace("</", "<\\/")
engine = (HERE / "engine.js").read_text(encoding="utf-8")
html = (HERE / "template.html").read_text(encoding="utf-8")
html = html.replace("__SAMPLES__", data, 1).replace("__ENGINE__", engine, 1)
out = HERE / "itb_reviewer.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html.encode()) // 1024} KB)")
