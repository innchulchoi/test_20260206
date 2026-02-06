#!/usr/bin/env python3
"""
Kearney-style Consulting Slide Generator
=========================================
Generates professional consulting report slides (A4 Landscape) using Pillow.
Includes a Tkinter-based Live Editor for real-time text and layout adjustments.

Usage:
    python slide_generator.py          # Launch with Tkinter Live Editor (GUI)
    python slide_generator.py --nogui  # Generate slide image directly (no GUI)
"""

import sys
import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# A4 Landscape at 150 DPI (suitable for screen & print)
PAGE_W, PAGE_H = 1587, 1123  # ~A4 landscape at 150 DPI

# Colors (Kearney palette)
COLOR_BG = "#FFFFFF"
COLOR_HEADLINE = "#5B2D8E"       # Kearney purple
COLOR_LABEL_BG = "#F2F0F0"      # Light grey for label boxes
COLOR_LABEL_TEXT = "#333333"     # Dark grey for label text
COLOR_MAIN_TEXT = "#1A1A1A"      # Near-black for main points
COLOR_BULLET_TEXT = "#555555"    # Grey for bullet details
COLOR_DIVIDER = "#D0D0D0"       # Light grey divider lines
COLOR_FOOTER_TEXT = "#888888"    # Grey footer text
COLOR_PURPLE_LINE = "#5B2D8E"   # Accent line

# Font paths – try several CJK-capable fonts in order
_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]

_FONT_BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def _find_font(candidates):
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


FONT_PATH = _find_font(_FONT_CANDIDATES)
FONT_BOLD_PATH = _find_font(_FONT_BOLD_CANDIDATES)

if FONT_PATH is None:
    print("WARNING: No suitable CJK font found. Korean text may not render.")
    FONT_PATH = ""
    FONT_BOLD_PATH = ""
if FONT_BOLD_PATH is None:
    FONT_BOLD_PATH = FONT_PATH


# ---------------------------------------------------------------------------
# Default slide content (from the provided screenshot)
# ---------------------------------------------------------------------------
DEFAULT_CONTENT = {
    "headline": (
        "2026년 이커머스 시장 선점을 위해 모바일 트렌드 대응, 물류 자동화 "
        "및 데이터 기반의 초개인화 마케팅을 핵심 전략으로 추진해야"
    ),
    "box1_label": "시장 환경",
    "box1_main": "모바일 쇼핑 비중 80% 돌파 및 MZ세대 중심의 숏폼 커머스가 시장 성장을 주도하...",
    "box1_bullets": [
        "MZ세대의 핵심 소비층 부상 및 구매 영향력 확대",
        "숏폼 콘텐츠 플랫폼 기반의 커머스 생태계 급성장",
    ],
    "box2_label": "운영 체계",
    "box2_main": "배송 경쟁력 확보를 위한 물류 자동화 시스템 구축 및 AI 기반의 선제적 재고 관리가...",
    "box2_bullets": [
        "당일 배송 권역 확대를 통한 고객 라스트마일 만족도 제고",
        "AI 재고 예측 시스템 도입으로 운영 효율성 및 비용 최적화",
    ],
    "box3_label": "고객 경험",
    "box3_main": "CRM 고도화와 초개인화 추천 엔진 도입을 통해 고객 데이터 기반의 맞춤형 마케팅...",
    "box3_bullets": [
        "CRM 시스템 고도화를 통한 정교한 고객 타겟팅 수행",
        "실시간 고객 행동 데이터 기반의 초개인화 추천 엔진 강화",
    ],
    "footer_left": "KEARNEY  |  PROPRIETARY & CONFIDENTIAL",
    "page_number": "1",
}

# ---------------------------------------------------------------------------
# Default layout parameters (all adjustable from the Live Editor)
# ---------------------------------------------------------------------------
DEFAULT_PARAMS = {
    # Headline
    "headline_font_size": 32,
    "headline_x": 60,
    "headline_y": 50,
    "headline_max_width": 1467,  # PAGE_W - 2*60
    "headline_line_spacing": 10,
    "headline_letter_spacing": 0,

    # Content area
    "content_start_y": 190,
    "content_x": 60,
    "content_right_margin": 60,
    "box_spacing": 20,           # vertical gap between boxes

    # Label box (left side)
    "label_box_width": 120,
    "label_font_size": 18,
    "label_letter_spacing": 2,

    # Main point text
    "main_font_size": 22,
    "main_letter_spacing": 0,
    "main_x_offset": 150,       # offset from content_x

    # Bullet text
    "bullet_font_size": 17,
    "bullet_letter_spacing": 0,
    "bullet_line_spacing": 8,
    "bullet_indent": 30,        # indent from main_x_offset
    "bullet_symbol_size": 6,    # bullet dot radius

    # Footer
    "footer_font_size": 13,
    "footer_y_offset": 40,      # from bottom

    # Box internal padding
    "box_padding_top": 18,
    "box_padding_bottom": 18,
    "main_to_bullet_gap": 12,

    # Korean glyph clipping prevention
    "korean_y_pad": 4,          # extra vertical padding for Korean glyphs
}


# ---------------------------------------------------------------------------
# Helper: draw text with letter spacing
# ---------------------------------------------------------------------------
def draw_text_with_spacing(draw, xy, text, font, fill, letter_spacing=0):
    """Draw a single line of text with custom letter-spacing."""
    x, y = xy
    if letter_spacing == 0:
        draw.text((x, y), text, font=font, fill=fill)
        return
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = font.getbbox(ch)
        x += (bbox[2] - bbox[0]) + letter_spacing


def text_width_with_spacing(text, font, letter_spacing=0):
    """Calculate rendered width of text with letter-spacing."""
    if letter_spacing == 0:
        bbox = font.getbbox(text)
        return bbox[2] - bbox[0]
    w = 0
    for ch in text:
        bbox = font.getbbox(ch)
        w += (bbox[2] - bbox[0]) + letter_spacing
    return w - letter_spacing if text else 0


def wrap_text(text, font, max_width, letter_spacing=0):
    """Word-wrap text to fit within max_width. Returns list of lines."""
    if not text:
        return [""]
    # For CJK text, wrap character by character if no spaces
    if " " not in text.strip():
        lines, current = [], ""
        for ch in text:
            test = current + ch
            if text_width_with_spacing(test, font, letter_spacing) > max_width and current:
                lines.append(current)
                current = ch
            else:
                current = test
        if current:
            lines.append(current)
        return lines if lines else [""]

    words = text.split(" ")
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        if text_width_with_spacing(test, font, letter_spacing) > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines if lines else [""]


def truncate_to_one_line(text, font, max_width, letter_spacing=0):
    """Truncate text to fit in one line, adding '...' if needed."""
    if text_width_with_spacing(text, font, letter_spacing) <= max_width:
        return text
    for i in range(len(text), 0, -1):
        candidate = text[:i] + "..."
        if text_width_with_spacing(candidate, font, letter_spacing) <= max_width:
            return candidate
    return "..."


# ---------------------------------------------------------------------------
# Slide Renderer
# ---------------------------------------------------------------------------
def render_slide(content, params):
    """Render a Kearney-style slide and return a PIL Image."""
    img = Image.new("RGB", (PAGE_W, PAGE_H), COLOR_BG)
    draw = ImageDraw.Draw(img)

    p = {**DEFAULT_PARAMS, **params}
    c = {**DEFAULT_CONTENT, **content}

    # Load fonts
    def load_font(size, bold=False):
        path = FONT_BOLD_PATH if bold else FONT_PATH
        if path:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
        return ImageFont.load_default()

    font_headline = load_font(p["headline_font_size"], bold=True)
    font_label = load_font(p["label_font_size"], bold=True)
    font_main = load_font(p["main_font_size"], bold=True)
    font_bullet = load_font(p["bullet_font_size"])
    font_footer = load_font(p["footer_font_size"])

    y_pad = p["korean_y_pad"]

    # ---- Draw headline ----
    headline_lines = wrap_text(
        c["headline"], font_headline,
        p["headline_max_width"], p["headline_letter_spacing"]
    )
    # Limit to 2 lines
    if len(headline_lines) > 2:
        headline_lines = headline_lines[:2]
        # Truncate last line
        headline_lines[1] = truncate_to_one_line(
            headline_lines[1], font_headline,
            p["headline_max_width"], p["headline_letter_spacing"]
        )

    hy = p["headline_y"]
    h_bbox = font_headline.getbbox("가Ag")
    h_line_h = (h_bbox[3] - h_bbox[1]) + y_pad
    for line in headline_lines:
        draw_text_with_spacing(
            draw, (p["headline_x"], hy), line,
            font_headline, COLOR_HEADLINE, p["headline_letter_spacing"]
        )
        hy += h_line_h + p["headline_line_spacing"]

    # ---- Purple accent line under headline ----
    accent_y = hy + 5
    draw.line([(p["headline_x"], accent_y), (PAGE_W - p["content_right_margin"], accent_y)],
              fill=COLOR_PURPLE_LINE, width=3)

    # ---- Content boxes ----
    content_y = max(p["content_start_y"], accent_y + 20)
    content_x = p["content_x"]
    content_right = PAGE_W - p["content_right_margin"]
    text_area_x = content_x + p["main_x_offset"]
    text_area_w = content_right - text_area_x

    main_bbox = font_main.getbbox("가Ag")
    main_line_h = (main_bbox[3] - main_bbox[1]) + y_pad
    bullet_bbox = font_bullet.getbbox("가Ag")
    bullet_line_h = (bullet_bbox[3] - bullet_bbox[1]) + y_pad

    boxes = []
    for i in range(1, 4):
        label = c.get(f"box{i}_label", "")
        main_text = c.get(f"box{i}_main", "")
        bullets = c.get(f"box{i}_bullets", [])
        boxes.append((label, main_text, bullets))

    # Calculate box heights based on content (no over-stretching)
    def calc_box_height(main_text, bullets):
        h = p["box_padding_top"]
        h += main_line_h
        if bullets:
            h += p["main_to_bullet_gap"]
            for bi, b in enumerate(bullets):
                h += bullet_line_h
                if bi < len(bullets) - 1:
                    h += p["bullet_line_spacing"]
        h += p["box_padding_bottom"]
        return h

    box_heights = [calc_box_height(b[1], b[2]) for b in boxes]

    # Calculate total used height and available height
    footer_y_limit = PAGE_H - p["footer_y_offset"] - 30
    total_used = sum(box_heights) + (len(boxes) - 1) * p["box_spacing"]
    total_avail = footer_y_limit - content_y

    # If overflowing, scale down
    if total_used > total_avail and total_used > 0:
        scale = total_avail / total_used
        box_heights = [int(h * scale) for h in box_heights]
        total_used = sum(box_heights) + (len(boxes) - 1) * p["box_spacing"]

    # Evenly distribute the vertical gap between boxes
    remaining = total_avail - total_used
    gap = p["box_spacing"]
    if len(boxes) > 1 and remaining > 0:
        gap = p["box_spacing"] + remaining // (len(boxes) - 1 + 2)
        # +2 gives some top/bottom margin as well
        top_offset = remaining // (len(boxes) - 1 + 2)
    else:
        top_offset = 0

    # Draw each box
    cur_y = content_y + top_offset
    for idx, (label, main_text, bullets) in enumerate(boxes):
        box_h = box_heights[idx]

        # Divider line above (except first)
        if idx > 0:
            div_y = cur_y - gap // 2
            draw.line(
                [(content_x, div_y), (content_right, div_y)],
                fill=COLOR_DIVIDER, width=1
            )

        # Label box (left) – full height of content box
        label_box_x = content_x
        label_box_y = cur_y
        draw.rounded_rectangle(
            [label_box_x, label_box_y,
             label_box_x + p["label_box_width"], label_box_y + box_h],
            radius=6, fill=COLOR_LABEL_BG
        )
        # Center label text in box
        label_w = text_width_with_spacing(label, font_label, p["label_letter_spacing"])
        label_bbox_r = font_label.getbbox(label)
        label_text_h = label_bbox_r[3] - label_bbox_r[1]
        lx = label_box_x + (p["label_box_width"] - label_w) // 2
        ly = label_box_y + (box_h - label_text_h) // 2
        draw_text_with_spacing(
            draw, (lx, ly), label,
            font_label, COLOR_LABEL_TEXT, p["label_letter_spacing"]
        )

        # Main point text (1 line, truncated if needed)
        main_display = truncate_to_one_line(
            main_text, font_main, text_area_w, p["main_letter_spacing"]
        )
        my = cur_y + p["box_padding_top"]
        draw_text_with_spacing(
            draw, (text_area_x, my), main_display,
            font_main, COLOR_MAIN_TEXT, p["main_letter_spacing"]
        )

        # Bullet points
        by = my + main_line_h + p["main_to_bullet_gap"]
        bullet_x = text_area_x + p["bullet_indent"]
        bullet_text_w = content_right - bullet_x - 10
        for bi, bullet in enumerate(bullets):
            bullet_display = truncate_to_one_line(
                bullet, font_bullet, bullet_text_w, p["bullet_letter_spacing"]
            )
            # Draw bullet symbol (em-dash style like the screenshot)
            dot_y = by + bullet_line_h // 2
            r = p["bullet_symbol_size"]
            draw.line(
                [(bullet_x - 18, dot_y), (bullet_x - 18 + r * 2, dot_y)],
                fill=COLOR_BULLET_TEXT, width=2
            )
            draw_text_with_spacing(
                draw, (bullet_x, by), bullet_display,
                font_bullet, COLOR_BULLET_TEXT, p["bullet_letter_spacing"]
            )
            by += bullet_line_h + p["bullet_line_spacing"]

        cur_y += box_h + gap

    # ---- Footer ----
    footer_y = PAGE_H - p["footer_y_offset"]
    # Divider line above footer
    draw.line(
        [(content_x, footer_y - 15), (content_right, footer_y - 15)],
        fill=COLOR_DIVIDER, width=1
    )
    draw.text((content_x, footer_y), c["footer_left"], font=font_footer, fill=COLOR_FOOTER_TEXT)
    # Page number (right-aligned)
    pn_w = font_footer.getbbox(c["page_number"])
    draw.text(
        (content_right - (pn_w[2] - pn_w[0]), footer_y),
        c["page_number"], font=font_footer, fill=COLOR_FOOTER_TEXT
    )

    return img


# ---------------------------------------------------------------------------
# Tkinter Live Editor
# ---------------------------------------------------------------------------
def launch_editor():
    """Launch the Tkinter-based live editor GUI."""
    try:
        import tkinter as tk
        from tkinter import ttk, filedialog, messagebox
    except ImportError:
        print("Tkinter is not available. Use --nogui to generate without GUI.")
        sys.exit(1)

    try:
        from PIL import ImageTk
    except ImportError:
        print("Pillow ImageTk not available. Install with: pip install Pillow")
        sys.exit(1)

    root = tk.Tk()
    root.title("Kearney Slide Generator — Live Editor")
    root.geometry("1600x950")
    root.configure(bg="#F5F5F5")

    # State
    content = dict(DEFAULT_CONTENT)
    # Deep copy bullets
    for k in ["box1_bullets", "box2_bullets", "box3_bullets"]:
        content[k] = list(DEFAULT_CONTENT[k])
    params = dict(DEFAULT_PARAMS)

    preview_label = None
    preview_photo = None

    def update_preview():
        nonlocal preview_photo
        img = render_slide(content, params)
        # Scale to fit preview
        pw, ph = 920, 650
        img_preview = img.copy()
        img_preview.thumbnail((pw, ph), Image.LANCZOS)
        preview_photo = ImageTk.PhotoImage(img_preview)
        preview_label.configure(image=preview_photo)

    def on_content_change(key, var):
        content[key] = var.get()
        update_preview()

    def on_bullet_change(box_idx, bullet_idx, var):
        key = f"box{box_idx}_bullets"
        while len(content[key]) <= bullet_idx:
            content[key].append("")
        content[key][bullet_idx] = var.get()
        update_preview()

    def on_param_change(key, var):
        try:
            params[key] = int(var.get())
        except ValueError:
            pass
        update_preview()

    def save_image():
        filepath = filedialog.asksaveasfilename(
            defaultextension=".png",
            filetypes=[("PNG Image", "*.png"), ("JPEG Image", "*.jpg"), ("All Files", "*.*")],
            initialfile="kearney_slide.png"
        )
        if filepath:
            img = render_slide(content, params)
            img.save(filepath, quality=95)
            messagebox.showinfo("Saved", f"Slide saved to:\n{filepath}")

    # ---- Layout: left panel (controls) + right panel (preview) ----
    left_frame = tk.Frame(root, bg="#F5F5F5", width=620)
    left_frame.pack(side=tk.LEFT, fill=tk.BOTH, padx=5, pady=5)
    left_frame.pack_propagate(False)

    right_frame = tk.Frame(root, bg="#E0E0E0")
    right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)

    # Preview
    preview_label = tk.Label(right_frame, bg="#E0E0E0")
    preview_label.pack(expand=True)

    # Save button
    btn_frame = tk.Frame(right_frame, bg="#E0E0E0")
    btn_frame.pack(fill=tk.X, pady=5)
    tk.Button(btn_frame, text="Save as Image (PNG/JPG)", command=save_image,
              font=("Arial", 12, "bold"), bg="#5B2D8E", fg="white", padx=20, pady=6).pack()

    # ---- Scrollable left panel ----
    canvas = tk.Canvas(left_frame, bg="#F5F5F5", highlightthickness=0)
    scrollbar = ttk.Scrollbar(left_frame, orient="vertical", command=canvas.yview)
    scroll_frame = tk.Frame(canvas, bg="#F5F5F5")

    scroll_frame.bind(
        "<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    canvas.create_window((0, 0), window=scroll_frame, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)

    scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    # Enable mouse wheel scrolling
    def _on_mousewheel(event):
        canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    def _on_mousewheel_linux(event):
        if event.num == 4:
            canvas.yview_scroll(-1, "units")
        elif event.num == 5:
            canvas.yview_scroll(1, "units")

    canvas.bind_all("<MouseWheel>", _on_mousewheel)
    canvas.bind_all("<Button-4>", _on_mousewheel_linux)
    canvas.bind_all("<Button-5>", _on_mousewheel_linux)

    row = 0

    def add_section_label(text):
        nonlocal row
        lbl = tk.Label(scroll_frame, text=text, font=("Arial", 11, "bold"),
                        bg="#5B2D8E", fg="white", anchor="w", padx=8, pady=4)
        lbl.grid(row=row, column=0, columnspan=4, sticky="ew", pady=(10, 4), padx=2)
        row += 1

    def add_text_field(label_text, content_key, width=60):
        nonlocal row
        tk.Label(scroll_frame, text=label_text, bg="#F5F5F5", anchor="w",
                 font=("Arial", 9)).grid(row=row, column=0, sticky="w", padx=4)
        var = tk.StringVar(value=content.get(content_key, ""))
        entry = tk.Entry(scroll_frame, textvariable=var, width=width, font=("Arial", 9))
        entry.grid(row=row, column=1, columnspan=3, sticky="ew", padx=4, pady=2)
        var.trace_add("write", lambda *_: on_content_change(content_key, var))
        row += 1
        return var

    def add_bullet_field(label_text, box_idx, bullet_idx, width=55):
        nonlocal row
        tk.Label(scroll_frame, text=label_text, bg="#F5F5F5", anchor="w",
                 font=("Arial", 9)).grid(row=row, column=0, sticky="w", padx=4)
        key = f"box{box_idx}_bullets"
        initial = content[key][bullet_idx] if bullet_idx < len(content[key]) else ""
        var = tk.StringVar(value=initial)
        entry = tk.Entry(scroll_frame, textvariable=var, width=width, font=("Arial", 9))
        entry.grid(row=row, column=1, columnspan=3, sticky="ew", padx=4, pady=2)
        var.trace_add("write", lambda *_: on_bullet_change(box_idx, bullet_idx, var))
        row += 1
        return var

    def add_param_field(label_text, param_key):
        nonlocal row
        tk.Label(scroll_frame, text=label_text, bg="#F5F5F5", anchor="w",
                 font=("Arial", 9)).grid(row=row, column=0, sticky="w", padx=4)
        var = tk.StringVar(value=str(params.get(param_key, 0)))
        entry = tk.Entry(scroll_frame, textvariable=var, width=8, font=("Arial", 9),
                         justify="center")
        entry.grid(row=row, column=1, sticky="w", padx=4, pady=2)
        var.trace_add("write", lambda *_: on_param_change(param_key, var))
        row += 1
        return var

    # ===== TEXT CONTENT =====
    add_section_label("Lead Message (Headline)")
    add_text_field("Headline", "headline")

    add_section_label("Box #1")
    add_text_field("Label", "box1_label", 20)
    add_text_field("Main Point", "box1_main")
    add_bullet_field("Bullet 1", 1, 0)
    add_bullet_field("Bullet 2", 1, 1)

    add_section_label("Box #2")
    add_text_field("Label", "box2_label", 20)
    add_text_field("Main Point", "box2_main")
    add_bullet_field("Bullet 1", 2, 0)
    add_bullet_field("Bullet 2", 2, 1)

    add_section_label("Box #3")
    add_text_field("Label", "box3_label", 20)
    add_text_field("Main Point", "box3_main")
    add_bullet_field("Bullet 1", 3, 0)
    add_bullet_field("Bullet 2", 3, 1)

    add_section_label("Footer")
    add_text_field("Footer Left", "footer_left", 40)
    add_text_field("Page Number", "page_number", 5)

    # ===== LAYOUT PARAMETERS =====
    add_section_label("Headline — Size / Spacing / Position")
    add_param_field("Font Size", "headline_font_size")
    add_param_field("Letter Spacing", "headline_letter_spacing")
    add_param_field("Line Spacing", "headline_line_spacing")
    add_param_field("X (Left)", "headline_x")
    add_param_field("Y (Top)", "headline_y")

    add_section_label("Main Point — Size / Spacing")
    add_param_field("Font Size", "main_font_size")
    add_param_field("Letter Spacing", "main_letter_spacing")
    add_param_field("X Offset from Left", "main_x_offset")

    add_section_label("Bullet Points — Size / Spacing")
    add_param_field("Font Size", "bullet_font_size")
    add_param_field("Letter Spacing", "bullet_letter_spacing")
    add_param_field("Line Spacing", "bullet_line_spacing")
    add_param_field("Indent", "bullet_indent")
    add_param_field("Symbol Size", "bullet_symbol_size")

    add_section_label("Label Box")
    add_param_field("Font Size", "label_font_size")
    add_param_field("Letter Spacing", "label_letter_spacing")
    add_param_field("Box Width", "label_box_width")

    add_section_label("Content Layout — Position / Spacing")
    add_param_field("Content Start Y", "content_start_y")
    add_param_field("Content X (Left margin)", "content_x")
    add_param_field("Right Margin", "content_right_margin")
    add_param_field("Box Spacing (vertical gap)", "box_spacing")
    add_param_field("Box Padding Top", "box_padding_top")
    add_param_field("Box Padding Bottom", "box_padding_bottom")
    add_param_field("Main→Bullet Gap", "main_to_bullet_gap")

    add_section_label("Korean Glyph Clipping Prevention")
    add_param_field("Extra Y Padding", "korean_y_pad")

    add_section_label("Footer")
    add_param_field("Font Size", "footer_font_size")
    add_param_field("Y Offset from Bottom", "footer_y_offset")

    # Column weight for resizing
    scroll_frame.columnconfigure(1, weight=1)

    # Initial preview
    update_preview()

    root.mainloop()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    if "--nogui" in sys.argv:
        print("Generating slide (no GUI)...")
        img = render_slide(DEFAULT_CONTENT, DEFAULT_PARAMS)
        out_path = os.path.join(os.path.dirname(__file__) or ".", "kearney_slide.png")
        img.save(out_path, quality=95)
        print(f"Saved to: {out_path}")
    else:
        launch_editor()


if __name__ == "__main__":
    main()
