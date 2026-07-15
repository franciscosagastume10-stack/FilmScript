#!/usr/bin/env python3
import io
import json
import sys
import unicodedata

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_W, PAGE_H = A4
MARGIN = 24
LETTER_HEIGHT = 792
TOP_SHIFT = PAGE_H - LETTER_HEIGHT
INK = HexColor("#171715")
MUTED = HexColor("#66645E")
LINE = HexColor("#9E998E")
ACCENT = HexColor("#BA7517")


def safe_text(value):
    text = unicodedata.normalize("NFC", str(value if value is not None else ""))
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u2011", "-")
    return text.encode("cp1252", "replace").decode("cp1252")


def wrap_text(text, width, font="Helvetica", size=8):
    lines = []
    for paragraph in safe_text(text).splitlines() or [""]:
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
    return lines


def fit_text(text, width, font="Helvetica", size=8):
    value = safe_text(text)
    if stringWidth(value, font, size) <= width:
        return value
    suffix = "..."
    while value and stringWidth(value.rstrip() + suffix, font, size) > width:
        value = value[:-1]
    return value.rstrip() + suffix


def draw_wrapped(c, text, x, top, width, height, font="Helvetica", size=8, leading=9.5, color=INK):
    lines = wrap_text(text, width, font, size)
    max_lines = max(1, int(height // leading))
    clipped = len(lines) > max_lines
    lines = lines[:max_lines]
    if clipped and lines:
        last = lines[-1]
        while last and stringWidth(last + "...", font, size) > width:
            last = last[:-1]
        lines[-1] = last.rstrip() + "..."
    c.setFillColor(color)
    c.setFont(font, size)
    y = top
    for line in lines:
        c.drawString(x, y, line)
        y -= leading


def draw_field(c, label, value, x, y, label_width, total_width):
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.2)
    c.drawString(x, y, safe_text(label))
    value_x = x + label_width
    c.setFont("Helvetica", 7.6)
    c.drawString(value_x + 3, y, fit_text(value, total_width - label_width - 4, "Helvetica", 7.6))
    c.setStrokeColor(LINE)
    c.setLineWidth(0.45)
    c.line(value_x, y - 2, x + total_width, y - 2)


def draw_cell(c, label, value, x, bottom, width, height):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.55)
    c.rect(x, bottom, width, height, stroke=1, fill=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.3)
    c.drawString(x + 5, bottom + height - 11, safe_text(label))
    draw_wrapped(c, value or "No", x + 5, bottom + height - 23, width - 10, height - 29, size=7.4, leading=9)


def render_scene(c, project_title, scene, page_number, total_pages):
    metadata = scene.get("metadata") or {}
    cells = scene.get("cells") or {}

    c.setFillColor(HexColor("#FFFDF8"))
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    draw_field(c, "Scene #", metadata.get("sceneNo", page_number), MARGIN, 758 + TOP_SHIFT, 48, 150)
    draw_field(c, "Script Page", metadata.get("scriptPage", "Not set"), MARGIN, 740 + TOP_SHIFT, 48, 150)
    draw_field(c, "Page Count", metadata.get("pageCount", "Not set"), MARGIN, 722 + TOP_SHIFT, 48, 150)

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 11)
    title = fit_text(safe_text(project_title).upper(), 235, "Helvetica-Bold", 11)
    c.drawCentredString(PAGE_W / 2, 747 + TOP_SHIFT, title)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(PAGE_W / 2, 734 + TOP_SHIFT, "BREAKDOWN")
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2.1)
    c.line(PAGE_W / 2 - 34, 728 + TOP_SHIFT, PAGE_W / 2 + 34, 728 + TOP_SHIFT)

    right_x = PAGE_W - MARGIN - 150
    draw_field(c, "Sheet #", metadata.get("sheetNo", page_number), right_x, 758 + TOP_SHIFT, 44, 150)
    draw_field(c, "Int/Ext", metadata.get("intExt", "Not set"), right_x, 742 + TOP_SHIFT, 44, 150)
    draw_field(c, "Day/Night", metadata.get("dayNight", "Not set"), right_x, 726 + TOP_SHIFT, 44, 150)
    draw_field(c, "Est. Time", metadata.get("estimatedTime", "Not set"), right_x, 710 + TOP_SHIFT, 44, 150)

    draw_field(c, "Scene Description", metadata.get("sceneDescription", "Pending analysis"), MARGIN, 695 + TOP_SHIFT, 80, PAGE_W - 2 * MARGIN)
    field_gap = 12
    field_width = (PAGE_W - 2 * MARGIN - field_gap) / 2
    field_right_x = MARGIN + field_width + field_gap
    draw_field(c, "Set", metadata.get("set", "Not set"), MARGIN, 678 + TOP_SHIFT, 30, field_width)
    draw_field(c, "Location", metadata.get("location", "Not set"), field_right_x, 678 + TOP_SHIFT, 46, field_width)
    draw_field(c, "Sequence", metadata.get("sequence", "Not set"), MARGIN, 661 + TOP_SHIFT, 44, field_width)
    draw_field(c, "Script Day", metadata.get("scriptDay", "Not set"), field_right_x, 661 + TOP_SHIFT, 46, field_width)

    grid_top = 648 + TOP_SHIFT
    col_width = (PAGE_W - 2 * MARGIN) / 3
    row_heights = [114, 114, 143, 118, 110]
    row_bottoms = []
    cursor = grid_top
    for height in row_heights:
        cursor -= height
        row_bottoms.append(cursor)

    draw_cell(c, "Cast", cells.get("cast", "No"), MARGIN, row_bottoms[1], col_width, row_heights[0] + row_heights[1])
    draw_cell(c, "Extras", cells.get("extras", "No"), MARGIN + col_width, row_bottoms[0], col_width, row_heights[0])
    draw_cell(c, "Props", cells.get("props", "No"), MARGIN + 2 * col_width, row_bottoms[0], col_width, row_heights[0])
    draw_cell(c, "Stunts", cells.get("stunts", "No"), MARGIN + col_width, row_bottoms[1], col_width, row_heights[1])
    draw_cell(c, "Vehicles / Animals", cells.get("vehicles_animals", "No"), MARGIN + 2 * col_width, row_bottoms[1], col_width, row_heights[1])
    draw_cell(c, "Special FX", cells.get("special_fx", "No"), MARGIN, row_bottoms[2], col_width, row_heights[2])
    draw_cell(c, "Wardrobe", cells.get("wardrobe", "No"), MARGIN + col_width, row_bottoms[2], col_width, row_heights[2])
    draw_cell(c, "Makeup / Hair", cells.get("makeup_hair", "No"), MARGIN + 2 * col_width, row_bottoms[2], col_width, row_heights[2])
    draw_cell(c, "Set Dressing", cells.get("set_dressing", "No"), MARGIN, row_bottoms[3], col_width, row_heights[3])
    draw_cell(c, "Greenery", cells.get("greenery", "No"), MARGIN + col_width, row_bottoms[3], col_width, row_heights[3])
    draw_cell(c, "Special Equipment", cells.get("equipment", "No"), MARGIN + 2 * col_width, row_bottoms[3], col_width, row_heights[3])
    draw_cell(c, "Notes", cells.get("notes", "No"), MARGIN, row_bottoms[4], col_width, row_heights[4])
    draw_cell(c, "Music", cells.get("music", "No"), MARGIN + col_width, row_bottoms[4], col_width, row_heights[4])
    draw_cell(c, "Sound", cells.get("sound", "No"), MARGIN + 2 * col_width, row_bottoms[4], col_width, row_heights[4])

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.8)
    c.drawRightString(PAGE_W - MARGIN, 17, f"Sheet {page_number} of {total_pages}")
    c.setFillColor(HexColor("#AAA69D"))
    c.setFont("Helvetica-Bold", 6.8)
    c.drawCentredString(PAGE_W / 2, 17, "FILMSCRIPT")
    c.showPage()


def main():
    payload = json.load(sys.stdin)
    scenes = payload.get("scenes") or []
    if not scenes:
        raise ValueError("No breakdown scenes supplied")
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4, pageCompression=1)
    pdf.setTitle(safe_text(payload.get("title") or "FilmScript Breakdown"))
    for index, scene in enumerate(scenes, start=1):
        render_scene(pdf, payload.get("title") or "Untitled Screenplay", scene, index, len(scenes))
    pdf.save()
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()
