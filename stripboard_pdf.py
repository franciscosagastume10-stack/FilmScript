#!/usr/bin/env python3
import io
import json
import sys
import unicodedata

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_W, PAGE_H = landscape(A4)
MARGIN = 40
INK = HexColor("#242421")
MUTED = HexColor("#77746C")
SURFACE = HexColor("#FFFDF8")
LINE = HexColor("#C8C2B5")
ACCENT = HexColor("#BA7517")


def safe_text(value):
    text = unicodedata.normalize("NFC", str(value if value is not None else ""))
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("\u2011", "-")
    return text.encode("cp1252", "replace").decode("cp1252")


def fit_text(value, width, font="Helvetica", size=8):
    text = safe_text(value)
    if stringWidth(text, font, size) <= width:
        return text
    suffix = "..."
    while text and stringWidth(text.rstrip() + suffix, font, size) > width:
        text = text[:-1]
    return text.rstrip() + suffix


def row_height(row):
    return 24 if row.get("type") == "divider" else 30


def paginate(rows):
    pages = []
    current = []
    used = 0
    available = PAGE_H - 164
    for row in rows:
        needed = row_height(row) + 4
        if current and used + needed > available:
            pages.append(current)
            current = []
            used = 0
        current.append(row)
        used += needed
    if current:
        pages.append(current)
    return pages or [[]]


def draw_header(pdf, title, page_number, total_pages):
    pdf.setFillColor(SURFACE)
    pdf.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 19)
    pdf.drawString(MARGIN, PAGE_H - 54, fit_text(title, 430, "Helvetica-Bold", 19))
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(MARGIN, PAGE_H - 70, "SHOOTING ORDER  /  STRIPBOARD")
    pdf.setStrokeColor(ACCENT)
    pdf.setLineWidth(2.2)
    pdf.line(MARGIN, PAGE_H - 79, MARGIN + 82, PAGE_H - 79)

    legend = [
        ("INT DAY", "#F8E9A9", "#A99443"),
        ("EXT DAY", "#DDE9BD", "#7E9660"),
        ("INT NIGHT", "#D2E2EE", "#6D8EA2"),
        ("EXT NIGHT", "#DDD4EA", "#85739D"),
    ]
    x = PAGE_W - MARGIN - 282
    for label, bg, border in legend:
        pdf.setFillColor(HexColor(bg))
        pdf.setStrokeColor(HexColor(border))
        pdf.roundRect(x, PAGE_H - 67, 18, 10, 3, stroke=1, fill=1)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica-Bold", 6.4)
        pdf.drawString(x + 23, PAGE_H - 65, label)
        x += 70

    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(PAGE_W - MARGIN, 18, f"Page {page_number} of {total_pages}")
    pdf.setFillColor(HexColor("#AAA69D"))
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawCentredString(PAGE_W / 2, 18, "FILMSCRIPT")


def draw_column_labels(pdf, y):
    x = MARGIN + 14
    columns = ["SCENE", "INT / EXT", "SET", "SHOOT LOCATION", "CAST IDs", "EST. TIME", "DAY / NIGHT", "PAGES"]
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 6.7)
    inner_w = PAGE_W - 2 * MARGIN - 28
    widths = [40, 50, 185, 185, 60, 75, 60, inner_w - 655]
    for label, width in zip(columns, widths):
        pdf.drawString(x, y, label)
        x += width


def draw_strip(pdf, row, y, height):
    x = MARGIN
    width = PAGE_W - 2 * MARGIN
    pdf.setFillColor(HexColor(row.get("bg") or "#E9E0CC"))
    pdf.setStrokeColor(HexColor(row.get("border") or "#96866A"))
    pdf.setLineWidth(0.8)
    pdf.roundRect(x, y - height, width, height, 7, stroke=1, fill=1)

    inner_x = x + 14
    inner_w = width - 28
    widths = [40, 50, 185, 185, 60, 75, 60, inner_w - 655]
    values = [row.get("sceneNo"), row.get("intExt"), row.get("setName"), row.get("shootLocation"), row.get("castIds"), row.get("timeLabel"), row.get("dayNight"), row.get("pageLength")]
    fonts = ["Helvetica-Bold", "Helvetica-Bold", "Helvetica", "Helvetica", "Helvetica-Bold", "Helvetica-Bold", "Helvetica", "Helvetica-Bold"]
    sizes = [8.6, 8, 8.3, 8.3, 7.3, 7, 7.2, 8.2]
    pdf.setFillColor(INK)
    for value, font, size, col_w in zip(values, fonts, sizes, widths):
        pdf.setFont(font, size)
        pdf.drawString(inner_x, y - height + 11.5, fit_text(value, col_w - 8, font, size))
        inner_x += col_w


def draw_divider(pdf, row, y, height):
    x = MARGIN
    width = PAGE_W - 2 * MARGIN
    pdf.setFillColor(INK)
    pdf.setStrokeColor(INK)
    pdf.roundRect(x, y - height, width, height, 6, stroke=1, fill=1)
    pdf.setFillColor(SURFACE)
    pdf.setFont("Helvetica-Bold", 8.2)
    pdf.drawString(x + 14, y - height + 9.5, safe_text(row.get("label") or "" ).upper())
    pdf.setFont("Helvetica", 7.5)
    pdf.drawRightString(x + width - 14, y - height + 9.5, safe_text(row.get("total") or ""))


def draw_break(pdf, row, y, height):
    x = MARGIN
    width = PAGE_W - 2 * MARGIN
    pdf.setFillColor(HexColor("#FFF7E5"))
    pdf.setStrokeColor(LINE)
    pdf.setDash(3, 2)
    pdf.roundRect(x, y - height, width, height, 6, stroke=1, fill=1)
    pdf.setDash()
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(x + 14, y - height + 10, safe_text(row.get("label") or "").upper())
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawRightString(x + width - 14, y - height + 10, safe_text(row.get("total") or ""))


def main():
    payload = json.load(sys.stdin)
    rows = payload.get("rows") or []
    pages = paginate(rows)
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=(PAGE_W, PAGE_H), pageCompression=1)
    pdf.setTitle(safe_text(payload.get("title") or "FilmScript Stripboard"))
    for page_number, page_rows in enumerate(pages, start=1):
        draw_header(pdf, payload.get("title") or "Untitled Screenplay", page_number, len(pages))
        draw_column_labels(pdf, PAGE_H - 102)
        y = PAGE_H - 112
        for row in page_rows:
            height = row_height(row)
            if row.get("type") == "divider":
                draw_divider(pdf, row, y, height)
            elif row.get("type") == "break":
                draw_break(pdf, row, y, height)
            else:
                draw_strip(pdf, row, y, height)
            y -= height + 4
        pdf.showPage()
    pdf.save()
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()
