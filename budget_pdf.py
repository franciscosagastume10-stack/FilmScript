#!/usr/bin/env python3
import io
import json
import math
import sys
from datetime import datetime, timezone
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


INK = colors.HexColor("#242422")
MUTED = colors.HexColor("#77756E")
HAIR = colors.HexColor("#DED9CF")
SOFT = colors.HexColor("#F3F0EA")
PAPER = colors.HexColor("#FFFEF9")
ACCENT = colors.HexColor("#BA7517")
GREEN = colors.HexColor("#5B7A4A")
BLUE = colors.HexColor("#4A6B8A")
PURPLE = colors.HexColor("#8A5A8A")
RED = colors.HexColor("#C74440")
PHASE_COLORS = [ACCENT, GREEN, BLUE, PURPLE]


def number(value):
    try:
        parsed = float(value or 0)
        return parsed if math.isfinite(parsed) else 0.0
    except (TypeError, ValueError):
        return 0.0


def text(value, fallback=""):
    value = str(value if value is not None else fallback).replace("\x00", " ").strip()
    return value or fallback


def paragraph(value, style):
    return Paragraph(escape(text(value)), style)


class PhaseBars(Flowable):
    def __init__(self, phases, money_formatter, width=500, height=132):
        super().__init__()
        self.phases = phases
        self.money_formatter = money_formatter
        self.width = width
        self.height = height

    def draw(self):
        canvas = self.canv
        max_total = max([number(phase.get("total")) for phase in self.phases] + [1])
        y = self.height - 18
        for index, phase in enumerate(self.phases):
            total = number(phase.get("total"))
            spent = number(phase.get("spent"))
            color = PHASE_COLORS[index % len(PHASE_COLORS)]
            canvas.setFillColor(INK)
            canvas.setFont("Helvetica-Bold", 8)
            canvas.drawString(0, y, text(phase.get("name"), "Phase"))
            canvas.setFillColor(MUTED)
            canvas.setFont("Helvetica", 7)
            canvas.drawRightString(self.width, y, f"{self.money_formatter(spent)} of {self.money_formatter(total)}")
            y -= 10
            canvas.setFillColor(SOFT)
            canvas.roundRect(0, y, self.width, 7, 3.5, fill=1, stroke=0)
            planned_width = self.width * min(1, total / max_total)
            if planned_width > 0:
                canvas.setFillColor(colors.Color(color.red, color.green, color.blue, alpha=0.28))
                canvas.roundRect(0, y, planned_width, 7, 3.5, fill=1, stroke=0)
            spent_width = planned_width * min(1, spent / total) if total > 0 else 0
            if spent_width > 0:
                canvas.setFillColor(color)
                canvas.roundRect(0, y, spent_width, 7, 3.5, fill=1, stroke=0)
            y -= 19


def build_pdf(payload):
    budget = payload.get("budget") or {}
    computed = payload.get("computed") or {}
    settings = budget.get("settings") or {}
    metadata = budget.get("metadata") or {}
    symbol = text(settings.get("currencySymbol"), "Q")

    def money(value):
        value = number(value)
        absolute = f"{symbol}{abs(value):,.2f}"
        return f"({absolute})" if value < 0 else absolute

    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=19 * mm,
        bottomMargin=17 * mm,
        title=f"{text(payload.get('title'), 'FilmScript')} Budget",
        author="FilmScript",
        subject="Production budget",
        pageCompression=1,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("BudgetTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=27, textColor=INK, alignment=TA_LEFT, spaceAfter=5)
    eyebrow = ParagraphStyle("Eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=ACCENT, spaceAfter=4)
    section = ParagraphStyle("Section", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=19, textColor=INK, spaceBefore=2, spaceAfter=6)
    subtitle = ParagraphStyle("Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=14)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=INK)
    small = ParagraphStyle("Small", parent=body, fontSize=6.8, leading=8.3)
    small_right = ParagraphStyle("SmallRight", parent=small, alignment=TA_RIGHT)
    small_right_white = ParagraphStyle("SmallRightWhite", parent=small_right, textColor=colors.white)
    table_head = ParagraphStyle("TableHead", parent=small, fontName="Helvetica-Bold", textColor=colors.white, leading=8)
    kpi_label = ParagraphStyle("KpiLabel", parent=small, fontName="Helvetica-Bold", textColor=MUTED, leading=8)
    kpi_value = ParagraphStyle("KpiValue", parent=body, fontName="Helvetica-Bold", fontSize=13, leading=15, textColor=INK)
    group_style = ParagraphStyle("Group", parent=small, fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=INK)
    group_white = ParagraphStyle("GroupWhite", parent=group_style, textColor=colors.white)
    story = []

    def heading(label, name, description):
        story.append(Paragraph(escape(label.upper()), eyebrow))
        story.append(Paragraph(escape(name), section))
        story.append(Paragraph(escape(description), subtitle))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("FILMSCRIPT PRODUCTION", eyebrow))
    story.append(Paragraph(escape(text(payload.get("title"), "Untitled screenplay")), title_style))
    story.append(Paragraph("Budget", ParagraphStyle("BudgetWord", parent=section, fontSize=18, textColor=ACCENT, spaceAfter=16)))
    detail_data = [
        [paragraph("Producer", kpi_label), paragraph(metadata.get("producer") or "Not filled", body), paragraph("Format", kpi_label), paragraph(metadata.get("format") or "Not filled", body)],
        [paragraph("Director", kpi_label), paragraph(metadata.get("director") or "Not filled", body), paragraph("Locations", kpi_label), paragraph(metadata.get("locations") or "Not filled", body)],
        [paragraph("Shooting Dates", kpi_label), paragraph(metadata.get("shootingDates") or "Not filled", body), paragraph("Currency", kpi_label), paragraph(settings.get("currencyCode") or "GTQ", body)],
    ]
    details = Table(detail_data, colWidths=[28 * mm, 55 * mm, 28 * mm, 55 * mm], hAlign="LEFT")
    details.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, HAIR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(details)
    story.append(Spacer(1, 13 * mm))
    story.append(Paragraph("BUDGET QUICK VIEW", eyebrow))
    kpis = [
        ("Planned Budget", money(computed.get("total"))),
        ("Actual Spend", money(computed.get("spent"))),
        ("Remaining", money(computed.get("remaining"))),
        ("Funding Gap", money(computed.get("fundingGap"))),
    ]
    kpi_table = Table([[Table([[paragraph(label, kpi_label)], [paragraph(value, kpi_value)]], colWidths=[38 * mm]) for label, value in kpis]], colWidths=[42 * mm] * 4)
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.7, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HAIR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("WHERE THE BUDGET GOES", eyebrow))
    story.append(PhaseBars(computed.get("phases") or [], money, width=174 * mm, height=128))

    story.append(PageBreak())
    heading("Rollup", "Budget Summary", "Every account rolls into one auditable production total.")
    summary_rows = [[paragraph(value, table_head) for value in ["Account", "Concept", "Subtotal", "Tax", "Total", "Remaining"]]]
    for account in computed.get("accounts") or []:
        summary_rows.append([
            paragraph(account.get("code"), small),
            paragraph(account.get("name"), small),
            paragraph(money(account.get("subtotal")), small_right),
            paragraph(money(account.get("tax")), small_right),
            paragraph(money(account.get("total")), small_right),
            paragraph(money(account.get("remaining")), small_right),
        ])
    summary_rows.append([
        "", paragraph("Grand Total", group_white), paragraph(money(computed.get("subtotal")), small_right_white),
        paragraph(money(computed.get("tax")), small_right_white), paragraph(money(computed.get("total")), small_right_white),
        paragraph(money(computed.get("remaining")), small_right_white),
    ])
    summary_table = LongTable(summary_rows, colWidths=[17 * mm, 64 * mm, 24 * mm, 21 * mm, 25 * mm, 25 * mm], repeatRows=1)
    summary_table.setStyle(base_table_style(len(summary_rows)))
    summary_table.setStyle(TableStyle([("BACKGROUND", (0, -1), (-1, -1), INK), ("TEXTCOLOR", (0, -1), (-1, -1), colors.white)]))
    story.append(summary_table)

    story.append(PageBreak())
    heading("Cost detail", "Budget Breakdown", "Quantity, unit, times, unit cost, tax and total for every production cost.")
    breakdown_header = [paragraph(value, table_head) for value in ["Code", "Cost Item", "Qty", "Unit", "Times", "Subtotal", "Tax", "Total"]]
    breakdown_rows = [breakdown_header]
    for account in computed.get("accounts") or []:
        breakdown_rows.append([paragraph(account.get("code"), group_style), paragraph(account.get("name"), group_style), "", "", "", "", "", paragraph(money(account.get("total")), small_right)])
        for item in account.get("items") or []:
            breakdown_rows.append([
                paragraph(item.get("code"), small),
                paragraph(item.get("name"), small),
                paragraph(f"{number(item.get('quantity')):g}", small_right),
                paragraph(item.get("unit"), small),
                paragraph(f"{number(item.get('multiplier')):g}", small_right),
                paragraph(money(item.get("subtotal")), small_right),
                paragraph(money(item.get("tax")), small_right),
                paragraph(money(item.get("total")), small_right),
            ])
    breakdown_table = LongTable(breakdown_rows, colWidths=[15 * mm, 66 * mm, 13 * mm, 19 * mm, 14 * mm, 22 * mm, 19 * mm, 23 * mm], repeatRows=1)
    breakdown_table.setStyle(base_table_style(len(breakdown_rows), font_size=6.5))
    group_rows = []
    cursor = 1
    for account in computed.get("accounts") or []:
        group_rows.append(cursor)
        cursor += 1 + len(account.get("items") or [])
    breakdown_table.setStyle(TableStyle([("BACKGROUND", (0, row), (-1, row), SOFT) for row in group_rows] + [("LINEABOVE", (0, row), (-1, row), 0.7, HAIR) for row in group_rows]))
    story.append(breakdown_table)

    story.append(PageBreak())
    heading("Sources and timing", "Finance Plan", "Funding commitments, receipts and the planned production cash flow.")
    finance_kpis = Table([
        [paragraph("Cash Budget", kpi_label), paragraph("In Kind Budget", kpi_label), paragraph("Funding Planned", kpi_label), paragraph("Funding Received", kpi_label)],
        [paragraph(money(computed.get("cashTotal")), kpi_value), paragraph(money(computed.get("inKindTotal")), kpi_value), paragraph(money(computed.get("fundingPlanned")), kpi_value), paragraph(money(computed.get("fundingReceived")), kpi_value)],
    ], colWidths=[42 * mm] * 4)
    finance_kpis.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SOFT), ("BOX", (0, 0), (-1, -1), 0.6, HAIR), ("INNERGRID", (0, 0), (-1, -1), 0.35, HAIR), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.append(finance_kpis)
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph("CONTRIBUTORS", eyebrow))
    funding_rows = [[paragraph(value, table_head) for value in ["Contributor", "Type", "Planned", "Received", "Status", "Payment Date", "Proof"]]]
    for source in budget.get("fundingSources") or []:
        funding_rows.append([
            paragraph(source.get("name"), small), paragraph(text(source.get("type"), "cash").replace("_", " ").title(), small),
            paragraph(money(source.get("amount")), small_right), paragraph(money(source.get("paid")), small_right),
            paragraph(source.get("status"), small), paragraph(source.get("paymentDate") or "", small),
            paragraph(source.get("receiptName") or "", small),
        ])
    if len(funding_rows) == 1:
        funding_rows.append([paragraph("No contributors recorded", small), "", "", "", "", "", ""])
    funding_table = LongTable(funding_rows, colWidths=[47 * mm, 19 * mm, 24 * mm, 24 * mm, 26 * mm, 31 * mm, 27 * mm], repeatRows=1)
    funding_table.setStyle(base_table_style(len(funding_rows)))
    story.append(funding_table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("PLANNED CASH FLOW", eyebrow))
    schedule_rows = [[paragraph(period.get("label"), table_head) for period in budget.get("periods") or []]]
    schedule_rows.append([paragraph(money((computed.get("scheduleTotals") or {}).get(period.get("id"))), small_right) for period in budget.get("periods") or []])
    period_count = max(1, len(budget.get("periods") or []))
    schedule_table = Table(schedule_rows, colWidths=[174 * mm / period_count] * period_count)
    schedule_table.setStyle(base_table_style(len(schedule_rows), font_size=6.2))
    story.append(schedule_table)

    story.append(PageBreak())
    heading("Actuals", "Expense Report", "Every payment linked to a budget line with live variance and receipt status.")
    expense_rows = [[paragraph(value, table_head) for value in ["Payment", "Date", "Budget Line", "Vendor", "Spent", "Variance", "Receipt"]]]
    for expense in computed.get("expenseRows") or []:
        expense_rows.append([
            paragraph(expense.get("paymentNumber"), small), paragraph(expense.get("paymentDate"), small),
            paragraph(f"{text(expense.get('lineItemCode'))} {text(expense.get('lineItemName'))}", small),
            paragraph(expense.get("vendor") or expense.get("concept") or "", small),
            paragraph(money(expense.get("amount")), small_right), paragraph(money(expense.get("variance")), small_right),
            paragraph(expense.get("receiptName") or "", small),
        ])
    if len(expense_rows) == 1:
        expense_rows.append([paragraph("No expenses recorded", small), "", "", "", paragraph(money(0), small_right), paragraph(money(computed.get("total")), small_right), ""])
    expense_rows.append(["", "", paragraph("Total Spent", group_white), "", paragraph(money(computed.get("spent")), small_right_white), paragraph(money(computed.get("remaining")), small_right_white), ""])
    expense_table = LongTable(expense_rows, colWidths=[17 * mm, 24 * mm, 50 * mm, 36 * mm, 22 * mm, 23 * mm, 26 * mm], repeatRows=1)
    expense_table.setStyle(base_table_style(len(expense_rows)))
    expense_table.setStyle(TableStyle([("BACKGROUND", (0, -1), (-1, -1), INK), ("TEXTCOLOR", (0, -1), (-1, -1), colors.white)]))
    story.append(expense_table)

    def footer(canvas, document):
        canvas.saveState()
        width, _ = A4
        canvas.setStrokeColor(HAIR)
        canvas.setLineWidth(0.5)
        canvas.line(16 * mm, 13 * mm, width - 16 * mm, 13 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 6.8)
        canvas.drawString(16 * mm, 8.5 * mm, "FilmScript Budget")
        canvas.drawCentredString(width / 2, 8.5 * mm, datetime.now(timezone.utc).strftime("%Y %m %d"))
        canvas.drawRightString(width - 16 * mm, 8.5 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def base_table_style(row_count, font_size=6.8):
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2 if row_count > 1 else -1), 0.35, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        sys.stdout.buffer.write(build_pdf(payload))
    except Exception as exc:
        sys.stderr.write(f"Budget PDF error: {exc}\n")
        sys.exit(1)
