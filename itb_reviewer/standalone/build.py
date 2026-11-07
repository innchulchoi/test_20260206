"""단독 HTML(standalone/itb_reviewer.html) 생성: template.html + engine.js + app.js + 가상 샘플(문서 묶음 + 국문 단일 문서).

  python standalone/build.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))

from itb.parser import parse_document  # noqa: E402

path = ROOT / "samples" / "sample_itb_ko.docx"
if not path.exists():
    import runpy

    runpy.run_path(str(ROOT / "samples" / "make_samples.py"), run_name="__main__")
ko = parse_document(path)
samples = {
    "bundle": json.loads((HERE / "sample_bundle.json").read_text(encoding="utf-8")),
    "ko": {"name": "한빛시 하수처리장 증설 (가상, 단일 문서)",
           "docs": [{"name": "샘플_하수처리장_입찰안내서.docx", "kind": ko.kind,
                     "pages": [{"number": p.number, "text": p.text} for p in ko.pages]}]},
}

data = json.dumps(samples, ensure_ascii=False).replace("</", "<\\/")
engine = (HERE / "engine.js").read_text(encoding="utf-8")
html = (HERE / "template.html").read_text(encoding="utf-8")
app = (HERE / "app.js").read_text(encoding="utf-8")
html = html.replace("__SAMPLES__", data, 1).replace("__ENGINE__", engine, 1).replace("__APP__", "<script>\n" + app + "</script>", 1)
out = HERE / "itb_reviewer.html"
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html.encode()) // 1024} KB)")
