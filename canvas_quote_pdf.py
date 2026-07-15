#!/usr/bin/env python3
import base64
import html
import io
import json
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.utils import ImageReader


INK = colors.HexColor("#242422")
MUTED = colors.HexColor("#77756E")
HAIR = colors.HexColor("#DDD8CE")
PAPER = colors.HexColor("#FCFAF5")
ACCENT = colors.HexColor("#BA7517")
SOFT = colors.HexColor("#F1ECE3")


def money(value):
    try:
        return f"${float(value):,.2f}"
    except Exception:
        return "$0.00"


def clean(value, fallback=""):
    text = str(value or "").strip()
    return text or fallback


def safe(value, fallback=""):
    """Escape user-authored copy before passing it to ReportLab Paragraph."""
    return html.escape(clean(value, fallback), quote=False)


def quote_type_label(value):
    return {
        "visual_proposal": "Visual Proposal",
        "rental_quote": "Rental Quote",
        "inventory_pull_list": "Inventory Pull List",
        "art_department_package": "Art Department Package",
    }.get(value, "Rental Quote")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(HAIR)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 9.5 * mm, "FilmScript")
    canvas.drawRightString(A4[0] - 18 * mm, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def safe_image(asset_id, image_data, max_width=22 * mm, max_height=18 * mm):
    encoded = image_data.get(asset_id)
    if not encoded:
        return Spacer(max_width, max_height)
    try:
        raw = base64.b64decode(encoded)
        reader = ImageReader(io.BytesIO(raw))
        width, height = reader.getSize()
        scale = min(max_width / width, max_height / height)
        return Image(io.BytesIO(raw), width=width * scale, height=height * scale)
    except Exception:
        return Spacer(max_width, max_height)


def build(payload):
    quote = payload.get("quote") or {}
    totals = payload.get("totals") or {}
    image_data = payload.get("imageData") or {}
    display = quote.get("display") or {}

    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=21 * mm,
        title=clean(quote.get("projectName"), "FilmScript quote"),
        author="FilmScript",
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=27, textColor=INK, alignment=TA_LEFT, spaceAfter=4 * mm)
    eyebrow = ParagraphStyle("Eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, leading=9, textColor=ACCENT, tracking=1.4, uppercase=True)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=INK)
    muted = ParagraphStyle("Muted", parent=body, fontSize=7.5, leading=10, textColor=MUTED)
    small_bold = ParagraphStyle("SmallBold", parent=body, fontName="Helvetica-Bold", fontSize=8, leading=10)
    right = ParagraphStyle("Right", parent=body, alignment=TA_RIGHT)
    story = []

    doc_label = quote_type_label(quote.get("documentType"))
    story.append(Paragraph(doc_label.upper(), eyebrow))
    story.append(Spacer(1, 2.5 * mm))
    story.append(Paragraph(safe(quote.get("projectName"), clean(payload.get("scriptTitle"), "Untitled project")), title))
    summary_left = [
        Paragraph(safe(quote.get("companyName"), "FilmScript production workspace"), small_bold),
        Paragraph(safe(quote.get("contactInformation"), "Contact information not filled"), muted),
    ]
    summary_right = [
        Paragraph(f"<b>Quote</b> {safe(quote.get('quoteNumber'), 'Not filled')}", right),
        Paragraph(f"Issued {safe(quote.get('issueDate'), 'Not filled')}<br/>Valid until {safe(quote.get('validityDate'), 'Not filled')}", ParagraphStyle("MetaRight", parent=muted, alignment=TA_RIGHT)),
    ]
    info = Table([[summary_left, summary_right]], colWidths=[105 * mm, 52 * mm], hAlign="LEFT")
    info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.7, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 7 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info)
    story.append(Spacer(1, 5 * mm))

    client_rows = [
        [Paragraph("PREPARED FOR", eyebrow), Paragraph("RENTAL WINDOW", eyebrow)],
        [Paragraph(safe(quote.get("clientName"), "Client not filled"), small_bold), Paragraph(f"{safe(quote.get('rentalStartDate'), 'Not filled')} - {safe(quote.get('rentalEndDate'), 'Not filled')}", body)],
        [Paragraph(safe(quote.get("productionName"), "Production not filled"), muted), Paragraph("Prices are project-specific and do not alter Vault rates.", muted)],
    ]
    client_table = Table(client_rows, colWidths=[78.5 * mm, 78.5 * mm])
    client_table.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    story.append(client_table)
    story.append(Spacer(1, 4 * mm))

    items = quote.get("items") or []
    show_images = bool(display.get("imageStyle", "compact"))
    show_prices = display.get("prices", True)
    headers = []
    widths = []
    if show_images:
        headers.append(Paragraph("REFERENCE", eyebrow))
        widths.append(25 * mm)
    headers.append(Paragraph("ITEM", eyebrow))
    widths.append(67 * mm if show_images else 91 * mm)
    headers.extend([Paragraph("QTY / DAYS", eyebrow), Paragraph("RATE", eyebrow), Paragraph("TOTAL", eyebrow)])
    widths.extend([25 * mm, 20 * mm, 20 * mm])
    rows = [headers]
    for item in items:
        name_parts = [f"<b>{safe(item.get('name'), 'Vault item')}</b>"]
        if display.get("itemCodes", True) and item.get("code"):
            name_parts.append(f"<font color='#77756E'>Code {safe(item.get('code'))}</font>")
        if display.get("descriptions", True) and item.get("description"):
            name_parts.append(safe(item.get("description")))
        if display.get("assignments", True):
            assignments = " · ".join(filter(None, [safe(item.get("sceneAssignment")), safe(item.get("setAssignment"))]))
            if assignments:
                name_parts.append(f"<font color='#BA7517'>{assignments}</font>")
        item_total = float(item.get("quantity") or 1) * float(item.get("rentalDays") or 1) * float(item.get("pricePerDay") or 0)
        row = []
        if show_images:
            row.append(safe_image(item.get("imageId"), image_data))
        row.extend([
            Paragraph("<br/>".join(name_parts), body),
            Paragraph(f"{item.get('quantity') or 1} × {item.get('rentalDays') or 1}d", body),
            Paragraph(money(item.get("pricePerDay")) if show_prices else "-", body),
            Paragraph(money(item_total) if show_prices else "-", small_bold),
        ])
        rows.append(row)
    if len(rows) == 1:
        empty = [Paragraph("No items selected", muted)] + [""] * (len(headers) - 1)
        rows.append(empty)
    item_table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOFT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("LINEBELOW", (0, 1), (-1, -1), 0.35, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, 0), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3 * mm),
        ("TOPPADDING", (0, 1), (-1, -1), 3.5 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3.5 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (-3, 1), (-1, -1), "RIGHT"),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 4 * mm))

    summary_rows = [
        ["Subtotal", money(totals.get("subtotal"))],
        ["Discount", f"− {money(quote.get('discount'))}"],
        ["Transportation", money(quote.get("transportationCosts"))],
        ["Labor", money(quote.get("laborCosts"))],
        ["Additional fees", money(quote.get("additionalFees"))],
        [f"Tax ({float(quote.get('taxRate') or 0):g}%)", money(totals.get("tax"))],
        ["Deposit", money(quote.get("deposit"))],
        ["TOTAL", money(totals.get("total"))],
    ]
    summary = Table(summary_rows, colWidths=[45 * mm, 32 * mm], hAlign="RIGHT")
    summary.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -2), "Helvetica"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, -2), MUTED),
        ("TEXTCOLOR", (0, -1), (-1, -1), INK),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.8 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.8 * mm),
        ("LINEABOVE", (0, -1), (-1, -1), 1, INK),
    ]))
    story.append(summary)

    notes = safe(quote.get("notes"))
    terms = safe(quote.get("terms"))
    if notes or terms:
        story.append(Spacer(1, 3 * mm))
        notes_cell = [Paragraph("NOTES", eyebrow), Spacer(1, 1.5 * mm), Paragraph(notes.replace("\n", "<br/>"), body)] if notes else []
        terms_cell = [Paragraph("TERMS &amp; CONDITIONS", eyebrow), Spacer(1, 1.5 * mm), Paragraph(terms.replace("\n", "<br/>"), muted)] if terms else []
        notes_table = Table([[notes_cell, terms_cell]], colWidths=[78.5 * mm, 78.5 * mm])
        notes_table.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(notes_table)

    story.append(Spacer(1, 2 * mm))
    signatures = Table([
        [Paragraph("AUTHORIZED SIGNATURE", eyebrow), Paragraph("CLIENT APPROVAL", eyebrow)],
    ], colWidths=[78.5 * mm, 78.5 * mm])
    signatures.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(signatures)

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def main():
    payload = json.load(sys.stdin)
    sys.stdout.buffer.write(build(payload))


if __name__ == "__main__":
    main()
