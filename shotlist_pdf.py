#!/usr/bin/env python3
import io
import json
import sys
import unicodedata
import base64

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image


PAGE_W, PAGE_H = landscape(A4)
MARGIN = 38
CONTENT_TOP = PAGE_H - 112
CONTENT_BOTTOM = 38
INK = HexColor("#242421")
MUTED = HexColor("#77746C")
SURFACE = HexColor("#FFFDF8")
LINE = HexColor("#CEC8BC")
SOFT = HexColor("#F1ECE3")
ACCENT = HexColor("#BA7517")
ACCENT_SOFT = HexColor("#F6E9D7")
COLUMN_WIDTHS = [48, 82, 70, 82, 74, 62, 78, PAGE_W - 2 * MARGIN - 496]


def safe_text(value):
    text = unicodedata.normalize("NFC", str(value if value is not None else ""))
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u2011", "-")
    return text.encode("cp1252", "replace").decode("cp1252")


def wrap_text(value, width, font="Helvetica", size=8.4):
    lines = []
    for paragraph in safe_text(value).splitlines() or [""]:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if stringWidth(candidate, font, size) <= width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines or [""]


def fit_text(value, width, font="Helvetica", size=8):
    text = safe_text(value)
    if stringWidth(text, font, size) <= width:
        return text
    suffix = "..."
    while text and stringWidth(text.rstrip() + suffix, font, size) > width:
        text = text[:-1]
    return text.rstrip() + suffix


def reference_image_reader(image_data):
    """Make compact, print-ready thumbnails so image-heavy exports stay fast."""
    raw = base64.b64decode(image_data)
    with Image.open(io.BytesIO(raw)) as source:
        source.thumbnail((360, 240), Image.Resampling.LANCZOS)
        if source.mode not in ("RGB", "L"):
            source = source.convert("RGB")
        output = io.BytesIO()
        source.save(output, format="JPEG", quality=80, optimize=True)
    return ImageReader(io.BytesIO(output.getvalue()))


def shot_row_height(shot):
    widths = COLUMN_WIDTHS[2:]
    values = [shot.get("size"), shot.get("angle"), shot.get("focalLength"), f'{shot.get("estimatedMinutes") or 15} min', shot.get("movement"), shot.get("description")]
    line_counts = [len(wrap_text(value or "Not set", width - 16)) for value, width in zip(values, widths)]
    return max(62, 18 + max(line_counts) * 10.4)


def paginate(scenes):
    available = CONTENT_TOP - CONTENT_BOTTOM
    pages = []
    current = []
    used = 0

    def new_page():
        nonlocal current, used
        if current:
            pages.append(current)
        current = []
        used = 0

    for scene in scenes:
        shots = scene.get("shots") or []
        display_rows = shots or [{"number": "-", "size": "", "angle": "", "focalLength": "50mm", "estimatedMinutes": 15, "movement": "", "description": "No shots planned for this scene"}]
        first_height = shot_row_height(display_rows[0])
        header_height = 29
        if current and used + header_height + first_height > available:
            new_page()
        current.append({"type": "scene", "height": header_height, "scene": scene, "continued": False})
        used += header_height
        for shot in display_rows:
            height = min(180, shot_row_height(shot))
            if current and used + height > available:
                new_page()
                current.append({"type": "scene", "height": header_height, "scene": scene, "continued": True})
                used += header_height
            current.append({"type": "shot", "height": height, "shot": shot})
            used += height
    if current:
        pages.append(current)
    return pages or [[]]


def draw_header(pdf, title, page_number, total_pages, scene_count, shot_count):
    pdf.setFillColor(SURFACE)
    pdf.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 19)
    pdf.drawString(MARGIN, PAGE_H - 50, fit_text(title, 480, "Helvetica-Bold", 19))
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN, PAGE_H - 67, "CAMERA PLAN  /  SHOT LIST")
    pdf.setStrokeColor(ACCENT)
    pdf.setLineWidth(2.2)
    pdf.line(MARGIN, PAGE_H - 77, MARGIN + 76, PAGE_H - 77)

    pdf.setFont("Helvetica-Bold", 7.2)
    pdf.setFillColor(MUTED)
    pdf.drawRightString(PAGE_W - MARGIN, PAGE_H - 52, f"{scene_count} SCENES  /  {shot_count} SHOTS")
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(PAGE_W - MARGIN, PAGE_H - 67, "FILMSCRIPT EXPORT")

    x = MARGIN
    labels = ["SHOT", "REFERENCE", "SIZE", "ANGLE", "LENS", "TIME", "MOVEMENT", "DESCRIPTION"]
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 6.8)
    for label, width in zip(labels, COLUMN_WIDTHS):
        pdf.drawString(x + 8, PAGE_H - 101, label)
        x += width
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(0.55)
    pdf.line(MARGIN, PAGE_H - 107, PAGE_W - MARGIN, PAGE_H - 107)

    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(PAGE_W - MARGIN, 18, f"Page {page_number} of {total_pages}")
    pdf.setFillColor(HexColor("#AAA69D"))
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawCentredString(PAGE_W / 2, 18, "FILMSCRIPT")


def draw_scene_header(pdf, item, y):
    scene = item["scene"]
    height = item["height"]
    pdf.setFillColor(SOFT)
    pdf.setStrokeColor(LINE)
    pdf.rect(MARGIN, y - height, PAGE_W - 2 * MARGIN, height, stroke=1, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.circle(MARGIN + 10, y - height / 2, 2.2, stroke=0, fill=1)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 8)
    suffix = "  /  CONTINUED" if item.get("continued") else ""
    pdf.drawString(MARGIN + 18, y - 18.5, f"SCENE {safe_text(scene.get('number'))}{suffix}")
    pdf.setFont("Helvetica", 8.4)
    pdf.drawString(MARGIN + 96, y - 18.5, fit_text(scene.get("heading") or "Untitled scene", PAGE_W - 2 * MARGIN - 280, "Helvetica", 8.4))
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 6.8)
    count = len(scene.get("shots") or [])
    planned = int(scene.get("plannedMinutes") or 0)
    budget = scene.get("budgetMinutes")
    schedule = f"{planned} MIN PLANNED"
    if budget is not None:
        schedule += f" / {int(budget)} MIN AVAILABLE"
    pdf.drawRightString(PAGE_W - MARGIN - 10, y - 18.5, f"{count} SHOT{'S' if count != 1 else ''}  /  {schedule}")


def draw_text_lines(pdf, value, x, top, width, height, font="Helvetica", size=8.4, color=INK):
    leading = 10.4
    lines = wrap_text(value, width, font, size)
    max_lines = max(1, int((height - 12) // leading))
    clipped = len(lines) > max_lines
    lines = lines[:max_lines]
    if clipped and lines:
        lines[-1] = fit_text(lines[-1] + "...", width, font, size)
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    y = top - 14
    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading


def draw_shot_row(pdf, item, y):
    shot = item["shot"]
    height = item["height"]
    x = MARGIN
    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.rect(MARGIN, y - height, PAGE_W - 2 * MARGIN, height, stroke=1, fill=1)
    for width in COLUMN_WIDTHS[:-1]:
        x += width
        pdf.setStrokeColor(HexColor("#E4DFD5"))
        pdf.line(x, y, x, y - height)

    shot_number = safe_text(shot.get("number") or "-")
    pdf.setFillColor(ACCENT_SOFT)
    pdf.roundRect(MARGIN + 8, y - 27, 34, 19, 8, stroke=0, fill=1)
    pdf.setFillColor(ACCENT)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(MARGIN + 25, y - 20.7, shot_number)

    reference_x = MARGIN + COLUMN_WIDTHS[0]
    reference_width = COLUMN_WIDTHS[1]
    image_data = shot.get("referenceImageData") or ""
    if image_data:
        try:
            reader = reference_image_reader(image_data)
            pdf.drawImage(reader, reference_x + 6, y - height + 7, reference_width - 12, height - 14, preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception:
            image_data = ""
    if not image_data:
        pdf.setFillColor(SOFT)
        pdf.roundRect(reference_x + 9, y - height + 17, reference_width - 18, 22, 6, stroke=0, fill=1)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica-Bold", 6.4)
        pdf.drawCentredString(reference_x + reference_width / 2, y - height + 25, "NO REFERENCE")

    x = MARGIN + COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1]
    values = [
        (shot.get("size") or "Not set", "Helvetica-Bold", INK),
        (shot.get("angle") or "Not set", "Helvetica", INK),
        (shot.get("focalLength") or "50mm", "Helvetica", INK),
        (f'{shot.get("estimatedMinutes") or 15} min', "Helvetica-Bold", ACCENT),
        (shot.get("movement") or "Not set", "Helvetica", INK),
        (shot.get("description") or "No description", "Helvetica", MUTED),
    ]
    for (value, font, color), width in zip(values, COLUMN_WIDTHS[2:]):
        draw_text_lines(pdf, value, x + 8, y, width - 16, height, font=font, color=color)
        x += width


def main():
    payload = json.load(sys.stdin)
    scenes = payload.get("scenes") or []
    if not scenes:
        raise ValueError("No shot list scenes supplied")
    pages = paginate(scenes)
    shot_count = sum(len(scene.get("shots") or []) for scene in scenes)
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    pdf.setTitle(safe_text(payload.get("title") or "FilmScript Shot List"))
    for page_number, page_items in enumerate(pages, start=1):
        draw_header(pdf, payload.get("title") or "Untitled Screenplay", page_number, len(pages), len(scenes), shot_count)
        y = CONTENT_TOP
        for item in page_items:
            if item.get("type") == "scene":
                draw_scene_header(pdf, item, y)
            else:
                draw_shot_row(pdf, item, y)
            y -= item["height"]
        pdf.showPage()
    pdf.save()
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()
