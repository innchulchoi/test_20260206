#!/usr/bin/env python3
"""
Kearney Slide Generator — Flask Backend
========================================
- PPT 업로드 → 슬라이드 내용 파싱 API
- 슬라이드 내용 → PPT 다운로드 API (업로드된 템플릿 서식 유지)
- 프론트엔드(index.html) 서빙

Usage:
    python app.py
    → http://localhost:5000 에서 접속
"""

import io
import os
import json
import copy
import tempfile
from flask import Flask, request, jsonify, send_file, send_from_directory
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

app = Flask(__name__, static_folder=".", static_url_path="")

# Store uploaded template in memory (per-session simplicity)
_uploaded_template = {"pptx_bytes": None, "filename": None}

# Kearney brand colors
PURPLE = RGBColor(0x5B, 0x2D, 0x8E)
DARK_TEXT = RGBColor(0x1A, 0x1A, 0x1A)
GREY_TEXT = RGBColor(0x55, 0x55, 0x55)
FOOTER_GREY = RGBColor(0x88, 0x88, 0x88)
LABEL_BG = RGBColor(0xF2, 0xF0, 0xF0)
LABEL_TEXT = RGBColor(0x33, 0x33, 0x33)


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/upload-pptx", methods=["POST"])
def upload_pptx():
    """Upload a PPTX file → parse content from the first slide."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["file"]
    if not f.filename.lower().endswith((".pptx", ".ppt")):
        return jsonify({"error": "PPT/PPTX 파일만 업로드 가능합니다"}), 400

    pptx_bytes = f.read()
    _uploaded_template["pptx_bytes"] = pptx_bytes
    _uploaded_template["filename"] = f.filename

    # Parse content
    try:
        content = parse_pptx(pptx_bytes)
    except Exception as e:
        return jsonify({"error": f"파일 파싱 오류: {str(e)}"}), 400

    return jsonify({
        "success": True,
        "filename": f.filename,
        "content": content,
    })


@app.route("/api/download-pptx", methods=["POST"])
def download_pptx():
    """Generate a PPTX from the provided content. Uses uploaded template if available."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No content provided"}), 400

    try:
        pptx_bytes = generate_pptx(data, _uploaded_template.get("pptx_bytes"))
    except Exception as e:
        return jsonify({"error": f"PPT 생성 오류: {str(e)}"}), 500

    return send_file(
        io.BytesIO(pptx_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        as_attachment=True,
        download_name="kearney_slide.pptx",
    )


# ─────────────────────────────────────────
# PPTX Parser
# ─────────────────────────────────────────
def parse_pptx(pptx_bytes):
    """Parse a PPTX file and extract structured content from all text."""
    prs = Presentation(io.BytesIO(pptx_bytes))
    slide_width = prs.slide_width
    slide_height = prs.slide_height

    result = {
        "headline": "",
        "boxes": [],
        "footer_left": "",
        "page_number": "1",
        "slide_width": slide_width,
        "slide_height": slide_height,
    }

    if not prs.slides:
        return result

    slide = prs.slides[0]

    # Collect all text shapes sorted by position (top → bottom, left → right)
    shapes_with_text = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            shapes_with_text.append({
                "top": shape.top or 0,
                "left": shape.left or 0,
                "width": shape.width or 0,
                "height": shape.height or 0,
                "text_frame": shape.text_frame,
                "text": shape.text_frame.text.strip(),
                "shape": shape,
            })

    shapes_with_text.sort(key=lambda s: (s["top"], s["left"]))

    if not shapes_with_text:
        return result

    # Heuristic classification:
    # - Topmost large text → headline
    # - Bottom text → footer
    # - Middle shapes → content boxes (group by vertical proximity)

    # Find headline (top area, typically first large text)
    page_mid_y = slide_height * 0.25 if slide_height else Emu(Inches(2))
    page_bottom_y = slide_height * 0.85 if slide_height else Emu(Inches(6.5))

    headline_shapes = []
    content_shapes = []
    footer_shapes = []

    for s in shapes_with_text:
        if not s["text"]:
            continue
        if s["top"] < page_mid_y:
            headline_shapes.append(s)
        elif s["top"] > page_bottom_y:
            footer_shapes.append(s)
        else:
            content_shapes.append(s)

    # Headline
    if headline_shapes:
        result["headline"] = " ".join(s["text"] for s in headline_shapes)

    # Footer
    if footer_shapes:
        footer_texts = [s["text"] for s in footer_shapes]
        for ft in footer_texts:
            if any(kw in ft.upper() for kw in ["CONFIDENTIAL", "KEARNEY", "PROPRIETARY"]):
                result["footer_left"] = ft
            elif ft.strip().isdigit():
                result["page_number"] = ft.strip()
            else:
                if not result["footer_left"]:
                    result["footer_left"] = ft

    # Content → group into boxes by vertical clusters
    if content_shapes:
        boxes = _cluster_content_into_boxes(content_shapes, slide_width)
        result["boxes"] = boxes

    # Ensure at least 3 boxes
    while len(result["boxes"]) < 3:
        result["boxes"].append({
            "label": "",
            "main": "",
            "bullets": ["", ""],
        })

    return result


def _cluster_content_into_boxes(shapes, slide_width):
    """Group content shapes into logical boxes by vertical proximity."""
    if not shapes:
        return []

    # Sort by top position
    shapes.sort(key=lambda s: s["top"])

    # Cluster by vertical gap (if gap > threshold → new box)
    threshold = Emu(Inches(0.4))
    clusters = []
    current_cluster = [shapes[0]]

    for i in range(1, len(shapes)):
        prev_bottom = current_cluster[-1]["top"] + current_cluster[-1]["height"]
        cur_top = shapes[i]["top"]
        gap = cur_top - prev_bottom

        if gap > threshold:
            clusters.append(current_cluster)
            current_cluster = [shapes[i]]
        else:
            current_cluster.append(shapes[i])

    clusters.append(current_cluster)

    # Convert clusters to box format
    boxes = []
    mid_x = slide_width * 0.2 if slide_width else Emu(Inches(2))

    for cluster in clusters:
        box = {"label": "", "main": "", "bullets": []}

        # Separate label (left side, narrow) from content (right side)
        left_shapes = [s for s in cluster if s["left"] < mid_x and s["width"] < slide_width * 0.3]
        right_shapes = [s for s in cluster if s not in left_shapes]

        if not right_shapes:
            right_shapes = left_shapes
            left_shapes = []

        # Label
        if left_shapes:
            box["label"] = " ".join(s["text"] for s in left_shapes if s["text"])

        # Main + bullets from right shapes
        right_shapes.sort(key=lambda s: s["top"])

        for idx, rs in enumerate(right_shapes):
            tf = rs["text_frame"]
            paragraphs = [p.text.strip() for p in tf.paragraphs if p.text.strip()]

            if idx == 0 and paragraphs:
                # First paragraph of first right shape → main point
                box["main"] = paragraphs[0]
                # Remaining → bullets
                for p_text in paragraphs[1:]:
                    clean = p_text.lstrip("—–-•· ").strip()
                    if clean:
                        box["bullets"].append(clean)
            else:
                for p_text in paragraphs:
                    clean = p_text.lstrip("—–-•· ").strip()
                    if clean:
                        box["bullets"].append(clean)

        if box["main"] or box["label"] or box["bullets"]:
            boxes.append(box)

    return boxes


# ─────────────────────────────────────────
# PPTX Generator
# ─────────────────────────────────────────
def generate_pptx(data, template_bytes=None):
    """
    Generate a PPTX file from structured content.
    If template_bytes is provided, clone its layout/format.
    """
    if template_bytes:
        return _generate_from_template(data, template_bytes)
    else:
        return _generate_fresh(data)


def _generate_fresh(data):
    """Generate a new PPTX from scratch in Kearney style."""
    prs = Presentation()
    prs.slide_width = Inches(13.33)   # A4 Landscape-ish (widescreen)
    prs.slide_height = Inches(7.5)

    slide_layout = prs.slide_layouts[6]  # blank
    slide = prs.slides.add_slide(slide_layout)

    content = data.get("content", data)
    headline = content.get("headline", "")
    boxes = content.get("boxes", [])
    footer_left = content.get("footer_left", "KEARNEY  |  PROPRIETARY & CONFIDENTIAL")
    page_number = content.get("page_number", "1")

    # ── Headline ──
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(12.3), Inches(1.2))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = headline
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = PURPLE

    # ── Purple line ──
    line = slide.shapes.add_shape(
        1, Inches(0.5), Inches(1.55), Inches(12.3), Pt(3)
    )
    line.fill.solid()
    line.fill.fore_color.rgb = PURPLE
    line.line.fill.background()

    # ── Content boxes ──
    box_top = 2.0
    box_height = 1.5

    for i, box_data in enumerate(boxes[:3]):
        y = Inches(box_top + i * (box_height + 0.15))

        # Label box background
        label_shape = slide.shapes.add_shape(
            5, Inches(0.5), y, Inches(1.0), Inches(box_height)
        )
        label_shape.fill.solid()
        label_shape.fill.fore_color.rgb = LABEL_BG
        label_shape.line.fill.background()

        # Label text
        label_tf = label_shape.text_frame
        label_tf.word_wrap = True
        label_p = label_tf.paragraphs[0]
        label_p.text = box_data.get("label", "")
        label_p.font.size = Pt(14)
        label_p.font.bold = True
        label_p.font.color.rgb = LABEL_TEXT
        label_p.alignment = PP_ALIGN.CENTER
        label_tf.paragraphs[0].space_before = Pt(20)

        # Content text box (main + bullets)
        content_box = slide.shapes.add_textbox(
            Inches(1.7), y, Inches(11.1), Inches(box_height)
        )
        ctf = content_box.text_frame
        ctf.word_wrap = True

        # Main point
        main_p = ctf.paragraphs[0]
        main_p.text = box_data.get("main", "")
        main_p.font.size = Pt(18)
        main_p.font.bold = True
        main_p.font.color.rgb = DARK_TEXT
        main_p.space_after = Pt(6)

        # Bullets
        bullets = box_data.get("bullets", [])
        for b_text in bullets:
            bp = ctf.add_paragraph()
            bp.text = f"— {b_text}"
            bp.font.size = Pt(14)
            bp.font.color.rgb = GREY_TEXT
            bp.space_before = Pt(2)
            bp.level = 1

        # Divider line between boxes
        if i < 2:
            div_y = Inches(box_top + (i + 1) * (box_height + 0.15) - 0.075)
            div_line = slide.shapes.add_shape(
                1, Inches(0.5), div_y, Inches(12.3), Pt(1)
            )
            div_line.fill.solid()
            div_line.fill.fore_color.rgb = RGBColor(0xD0, 0xD0, 0xD0)
            div_line.line.fill.background()

    # ── Footer ──
    footer_box = slide.shapes.add_textbox(
        Inches(0.5), Inches(6.9), Inches(10), Inches(0.4)
    )
    ftf = footer_box.text_frame
    fp = ftf.paragraphs[0]
    fp.text = footer_left
    fp.font.size = Pt(10)
    fp.font.color.rgb = FOOTER_GREY

    # Page number
    pn_box = slide.shapes.add_textbox(
        Inches(12.3), Inches(6.9), Inches(0.5), Inches(0.4)
    )
    pntf = pn_box.text_frame
    pnp = pntf.paragraphs[0]
    pnp.text = page_number
    pnp.font.size = Pt(10)
    pnp.font.color.rgb = FOOTER_GREY
    pnp.alignment = PP_ALIGN.RIGHT

    # Footer divider
    fdiv = slide.shapes.add_shape(
        1, Inches(0.5), Inches(6.85), Inches(12.3), Pt(1)
    )
    fdiv.fill.solid()
    fdiv.fill.fore_color.rgb = RGBColor(0xD0, 0xD0, 0xD0)
    fdiv.line.fill.background()

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def _generate_from_template(data, template_bytes):
    """
    Generate PPTX by replacing text in the uploaded template,
    preserving the original formatting (fonts, colors, positions).
    """
    prs = Presentation(io.BytesIO(template_bytes))

    if not prs.slides:
        return _generate_fresh(data)

    slide = prs.slides[0]
    content = data.get("content", data)
    headline = content.get("headline", "")
    boxes = content.get("boxes", [])
    footer_left = content.get("footer_left", "")
    page_number = content.get("page_number", "1")

    # Collect shapes sorted by position
    shapes_with_text = []
    for shape in slide.shapes:
        if shape.has_text_frame:
            shapes_with_text.append({
                "top": shape.top or 0,
                "left": shape.left or 0,
                "width": shape.width or 0,
                "height": shape.height or 0,
                "shape": shape,
                "text": shape.text_frame.text.strip(),
            })

    shapes_with_text.sort(key=lambda s: (s["top"], s["left"]))

    slide_height = prs.slide_height
    slide_width = prs.slide_width
    page_mid_y = slide_height * 0.25
    page_bottom_y = slide_height * 0.85
    mid_x = slide_width * 0.2

    headline_shapes = []
    content_clusters = []
    footer_shapes = []

    for s in shapes_with_text:
        if not s["text"]:
            continue
        if s["top"] < page_mid_y:
            headline_shapes.append(s)
        elif s["top"] > page_bottom_y:
            footer_shapes.append(s)
        else:
            content_clusters.append(s)

    # Replace headline text (preserve formatting of first run)
    if headline_shapes and headline:
        _replace_shape_text(headline_shapes[0]["shape"], headline)

    # Replace footer
    for fs in footer_shapes:
        txt = fs["text"]
        if any(kw in txt.upper() for kw in ["CONFIDENTIAL", "KEARNEY", "PROPRIETARY"]):
            if footer_left:
                _replace_shape_text(fs["shape"], footer_left)
        elif txt.strip().isdigit():
            _replace_shape_text(fs["shape"], page_number)

    # Cluster content shapes and replace
    if content_clusters:
        content_clusters.sort(key=lambda s: s["top"])
        threshold = Emu(Inches(0.4))
        clusters = []
        cur_cluster = [content_clusters[0]]

        for i in range(1, len(content_clusters)):
            prev_b = cur_cluster[-1]["top"] + cur_cluster[-1]["height"]
            if content_clusters[i]["top"] - prev_b > threshold:
                clusters.append(cur_cluster)
                cur_cluster = [content_clusters[i]]
            else:
                cur_cluster.append(content_clusters[i])
        clusters.append(cur_cluster)

        for ci, cluster in enumerate(clusters):
            if ci >= len(boxes):
                break

            box_data = boxes[ci]
            left_shapes = [s for s in cluster if s["left"] < mid_x and s["width"] < slide_width * 0.3]
            right_shapes = [s for s in cluster if s not in left_shapes]

            if not right_shapes:
                right_shapes = left_shapes
                left_shapes = []

            # Replace label
            if left_shapes and box_data.get("label"):
                _replace_shape_text(left_shapes[0]["shape"], box_data["label"])

            # Replace content (main + bullets)
            if right_shapes:
                right_shapes.sort(key=lambda s: s["top"])
                bullets = box_data.get("bullets", [])
                main_text = box_data.get("main", "")

                # Build combined text with bullets
                combined_paragraphs = [main_text] + [f"— {b}" for b in bullets if b]
                _replace_shape_paragraphs(right_shapes[0]["shape"], combined_paragraphs)

    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def _replace_shape_text(shape, new_text):
    """Replace all text in a shape while preserving formatting of the first run."""
    tf = shape.text_frame
    if tf.paragraphs:
        p = tf.paragraphs[0]
        if p.runs:
            # Preserve first run's formatting
            run = p.runs[0]
            run.text = new_text
            # Remove extra runs
            for r in p.runs[1:]:
                r.text = ""
        else:
            p.text = new_text
        # Remove extra paragraphs
        for para in tf.paragraphs[1:]:
            for r in para.runs:
                r.text = ""
            if not para.runs:
                para.text = ""


def _replace_shape_paragraphs(shape, paragraphs_text):
    """
    Replace paragraphs in a shape. First paragraph keeps original formatting,
    subsequent paragraphs inherit the second paragraph's formatting if available.
    """
    tf = shape.text_frame
    existing = list(tf.paragraphs)

    # Replace existing paragraphs
    for i, new_text in enumerate(paragraphs_text):
        if i < len(existing):
            p = existing[i]
            if p.runs:
                p.runs[0].text = new_text
                for r in p.runs[1:]:
                    r.text = ""
            else:
                p.text = new_text
        else:
            # Add new paragraph
            p = tf.add_paragraph()
            p.text = new_text
            # Copy formatting from the second existing paragraph if available
            if len(existing) > 1 and existing[1].runs:
                src_run = existing[1].runs[0]
                if p.runs:
                    dst_run = p.runs[0]
                else:
                    dst_run = p.add_run()
                    dst_run.text = new_text
                if src_run.font.size:
                    dst_run.font.size = src_run.font.size
                if src_run.font.color and src_run.font.color.rgb:
                    dst_run.font.color.rgb = src_run.font.color.rgb

    # Clear extra existing paragraphs
    for i in range(len(paragraphs_text), len(existing)):
        p = existing[i]
        for r in p.runs:
            r.text = ""
        if not p.runs:
            p.text = ""


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  Kearney Slide Generator")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=True)
