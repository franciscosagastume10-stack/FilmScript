#!/usr/bin/env python3
import io
import json
import math
import re
import sys
from datetime import datetime, timedelta, timezone
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


TRANSLATIONS = {
    "en": {
        "production": "FILMSCRIPT PRODUCTION", "budget": "Budget", "producer": "Producer", "notFilled": "Not filled",
        "format": "Format", "director": "Director", "locations": "Locations", "shootingDates": "Shooting Dates", "currency": "Currency", "date": "Date", "budgetLine": "Budget Line", "receipt": "Receipt",
        "quickView": "BUDGET QUICK VIEW", "plannedBudget": "Planned Budget", "actualSpend": "Actual Spend", "remaining": "Remaining", "fundingGap": "Funding Gap",
        "whereBudgetGoes": "WHERE THE BUDGET GOES", "of": "of", "phase": "Phase", "aboveTheLine": "Above the Line", "productionPhase": "Production", "postProduction": "Postproduction", "other": "Other", "rollup": "Rollup", "budgetSummary": "Budget Summary",
        "summaryDescription": "Every account rolls into one auditable production total.", "account": "Account", "concept": "Concept", "subtotal": "Subtotal", "tax": "Tax", "total": "Total", "grandTotal": "Grand Total",
        "costDetail": "Cost detail", "budgetBreakdown": "Budget Breakdown", "breakdownDescription": "Quantity, unit, times, unit cost, tax and total for every production cost.",
        "code": "Code", "costItem": "Cost Item", "qty": "Qty", "unit": "Unit", "times": "Times", "fundingSources": "Funding sources", "financePlan": "Finance Plan",
        "financeDescription": "Funding commitments, receipts and contributor status.", "cashBudget": "Cash Budget", "inKindBudget": "In Kind Budget", "fundingPlanned": "Funding Planned", "fundingReceived": "Funding Received",
        "contributors": "CONTRIBUTORS", "contributor": "Contributor", "type": "Type", "planned": "Planned", "received": "Received", "status": "Status", "paymentDate": "Payment Date", "proof": "Proof", "noContributors": "No contributors recorded",
        "weeklyTiming": "Weekly timing", "cashFlow": "Cash Flow", "cashFlowDescription": "When production cash is planned to leave the project, based on Schedule in Budget Breakdown.", "cashScheduled": "Cash Scheduled", "overScheduled": "Over Scheduled", "cashUnscheduled": "Cash Unscheduled", "peakCashWeek": "Peak Cash Week", "actualCashSpend": "Actual Cash Spend", "placedOnTimeline": "Placed on the production timeline", "rebalanceCostItems": "Rebalance cost items", "stillNeedsProductionWeek": "Still needs a production week", "everyCashCostHasWeek": "Every cash cost has a week", "payments": "payments", "payment": "payment", "datedNeedDates": "dated / need dates", "weeklyCashLedger": "WEEKLY CASH LEDGER", "stage": "Stage", "week": "Week", "dates": "Dates", "plannedCash": "Planned Cash", "actual": "Actual", "variance": "Variance", "noProductionWeeks": "No production weeks", "preproduction": "Preproduction", "productionStage": "Production", "wrap": "Wrap", "postproduction": "Postproduction", "connectedCopy": "Connected to Script Breakdown and Stripboard", "shootDays": "shoot days", "shootWeeks": "shoot weeks", "addBreakdownCopy": "Add Script Breakdown and Stripboard data to include scene and shoot-day context.", "calendarDatesStart": "Calendar dates start", "relativeWeeks": "Weeks remain relative until Production Calendar dates are available.", "inkindExcluded": "In-kind costs are excluded from cash totals.",
        "actuals": "Actuals", "expenseReport": "Expense Report", "expenseDescription": "Approved payments, overruns and unexpected production costs reconciled in one ledger.", "approvedBudget": "Approved Budget", "totalPaid": "Total Paid", "overBudget": "Over Budget", "unexpectedCosts": "Unexpected Costs", "budgetBreakdownTotal": "Budget Breakdown total", "approvedLinesExceeded": "approved lines exceeded", "outsideApprovedPlan": "outside the approved plan", "paymentLedger": "PAYMENT LEDGER", "unexpectedCost": "Unexpected cost", "vendorConcept": "Vendor / Concept", "paid": "Paid", "lineBalance": "Line Balance", "noExpenses": "No expenses recorded", "totalPaidLabel": "Total Paid", "footerBudget": "FilmScript Budget", "page": "Page", "relativeWeek": "Relative week", "noScheduledWeek": "No scheduled week", "cash": "Cash", "inKind": "In kind", "no": "No", "yes": "Yes"
    },
    "es": {
        "production": "PRODUCCIÓN FILMSCRIPT", "budget": "Presupuesto", "producer": "Productor", "notFilled": "Sin completar",
        "format": "Formato", "director": "Director", "locations": "Locaciones", "shootingDates": "Fechas de rodaje", "currency": "Moneda", "date": "Fecha", "budgetLine": "Partida presupuestaria", "receipt": "Comprobante",
        "quickView": "VISTA RÁPIDA DEL PRESUPUESTO", "plannedBudget": "Presupuesto planificado", "actualSpend": "Gasto real", "remaining": "Restante", "fundingGap": "Brecha de financiación",
        "whereBudgetGoes": "A DÓNDE VA EL PRESUPUESTO", "of": "de", "phase": "Fase", "aboveTheLine": "Sobre la línea", "productionPhase": "Producción", "postProduction": "Postproducción", "other": "Otro", "rollup": "Resumen", "budgetSummary": "Resumen del presupuesto",
        "summaryDescription": "Cada cuenta se integra en un total de producción auditable.", "account": "Cuenta", "concept": "Concepto", "subtotal": "Subtotal", "tax": "Impuesto", "total": "Total", "grandTotal": "Total general",
        "costDetail": "Detalle de costos", "budgetBreakdown": "Desglose del presupuesto", "breakdownDescription": "Cantidad, unidad, veces, costo unitario, impuesto y total de cada costo de producción.",
        "code": "Código", "costItem": "Partida", "qty": "Cant.", "unit": "Unidad", "times": "Veces", "fundingSources": "Fuentes de financiación", "financePlan": "Plan financiero",
        "financeDescription": "Compromisos de financiación, recibos y estado de cada aportante.", "cashBudget": "Presupuesto en efectivo", "inKindBudget": "Presupuesto en especie", "fundingPlanned": "Financiación planificada", "fundingReceived": "Financiación recibida",
        "contributors": "APORTANTES", "contributor": "Aportante", "type": "Tipo", "planned": "Planificado", "received": "Recibido", "status": "Estado", "paymentDate": "Fecha de pago", "proof": "Comprobante", "noContributors": "No hay aportantes registrados",
        "weeklyTiming": "Calendario semanal", "cashFlow": "Flujo de caja", "cashFlowDescription": "Cuándo está previsto que el efectivo salga del proyecto, según la programación del desglose del presupuesto.", "cashScheduled": "Efectivo programado", "overScheduled": "Programado de más", "cashUnscheduled": "Efectivo sin programar", "peakCashWeek": "Semana de mayor gasto", "actualCashSpend": "Gasto real en efectivo", "placedOnTimeline": "Colocado en la línea de tiempo de producción", "rebalanceCostItems": "Rebalancea las partidas", "stillNeedsProductionWeek": "Aún necesita una semana de producción", "everyCashCostHasWeek": "Cada costo en efectivo tiene una semana", "payments": "pagos", "payment": "pago", "datedNeedDates": "con fecha / necesitan fecha", "weeklyCashLedger": "LIBRO SEMANAL DE EFECTIVO", "stage": "Etapa", "week": "Semana", "dates": "Fechas", "plannedCash": "Efectivo planificado", "actual": "Real", "variance": "Variación", "noProductionWeeks": "No hay semanas de producción", "preproduction": "Preproducción", "productionStage": "Producción", "wrap": "Cierre", "postproduction": "Postproducción", "connectedCopy": "Conectado con Desglose del guion y Stripboard", "shootDays": "días de rodaje", "shootWeeks": "semanas de rodaje", "addBreakdownCopy": "Agrega datos del Desglose del guion y Stripboard para incluir el contexto de escenas y días de rodaje.", "calendarDatesStart": "Las fechas del calendario empiezan el", "relativeWeeks": "Las semanas seguirán siendo relativas hasta que haya fechas en el Calendario de producción.", "inkindExcluded": "Los costos en especie no se incluyen en los totales de efectivo.",
        "actuals": "Gastos reales", "expenseReport": "Reporte de gastos", "expenseDescription": "Pagos aprobados, excedentes y costos de producción inesperados conciliados en un solo libro.", "approvedBudget": "Presupuesto aprobado", "totalPaid": "Total pagado", "overBudget": "Sobre presupuesto", "unexpectedCosts": "Costos inesperados", "budgetBreakdownTotal": "Total del desglose", "approvedLinesExceeded": "partidas aprobadas excedidas", "outsideApprovedPlan": "fuera del plan aprobado", "paymentLedger": "LIBRO DE PAGOS", "unexpectedCost": "Costo inesperado", "vendorConcept": "Proveedor / Concepto", "paid": "Pagado", "lineBalance": "Saldo de partida", "noExpenses": "No hay gastos registrados", "totalPaidLabel": "Total pagado", "footerBudget": "Presupuesto de FilmScript", "page": "Página", "relativeWeek": "Semana relativa", "noScheduledWeek": "Sin semana programada", "cash": "Efectivo", "inKind": "En especie", "no": "No", "yes": "Sí"
    }
}


MONTHS = {
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "es": ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
}


def translations(language):
    return TRANSLATIONS["es" if str(language or "").lower().startswith("es") else "en"]


def display_date(value, language):
    parsed = iso_date(value)
    if not parsed:
        return text(value)
    if str(language or "").lower().startswith("es"):
        return f"{parsed.day:02d}/{parsed.month:02d}/{parsed.year}"
    return f"{parsed.month:02d}/{parsed.day:02d}/{parsed.year}"


def period_label(period, language, labels):
    raw = text(period.get("label"))
    number_match = re.search(r"(\d+)\s*$", raw)
    week_number = number_match.group(1) if number_match else text(period.get("week"))
    if not week_number:
        return raw
    stage = text(period.get("stage"))
    if str(language or "").lower().startswith("es"):
        spanish_stage = {"prep": "Preproducción", "shoot": "Rodaje", "wrap": "Cierre", "post": "Postproducción"}
        return f"Semana de {spanish_stage.get(stage, labels['productionStage']).lower()} {week_number}"
    english_stage = {"prep": "Prep", "shoot": "Shoot", "wrap": "Wrap", "post": "Post"}
    return f"{english_stage.get(stage, 'Production')} Week {week_number}"


def localized_status(value, labels):
    raw = text(value)
    key = raw.lower().replace("-", "_").replace(" ", "_")
    status_map = {
        "planned": labels["planned"], "received": labels["received"], "paid": labels["paid"],
        "pending": "Pendiente" if labels["status"] == "Estado" else "Pending",
        "partial": "Parcial" if labels["status"] == "Estado" else "Partial",
    }
    return status_map.get(key, raw)


def localized_unit(value, language):
    raw = text(value)
    if not str(language or "").lower().startswith("es"):
        return raw
    unit_map = {"flat": "fijo", "each": "unidad", "unit": "unidad", "day": "día", "days": "días", "week": "semana", "weeks": "semanas", "hour": "hora", "hours": "horas", "month": "mes", "months": "meses"}
    return unit_map.get(raw.lower(), raw)


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


def iso_date(value):
    try:
        return datetime.strptime(text(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def week_range(start, end, language="en"):
    if not start or not end:
        return translations(language)["relativeWeek"]
    month_names = MONTHS["es" if str(language or "").lower().startswith("es") else "en"]
    start_month = month_names[start.month - 1]
    end_month = month_names[end.month - 1]
    prefix = "" if str(language or "").lower().startswith("en") else " de "
    if start.year == end.year and start.month == end.month:
        return f"{start.day}-{end.day}{prefix}{end_month} {end.year}"
    if start.year == end.year:
        return f"{start.day} {start_month}-{end.day} {end_month} {end.year}"
    return f"{start.day} {start_month} {start.year}-{end.day} {end_month} {end.year}"


class PhaseBars(Flowable):
    def __init__(self, phases, money_formatter, of_label="of", width=500, height=132):
        super().__init__()
        self.phases = phases
        self.money_formatter = money_formatter
        self.of_label = of_label
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
            canvas.drawRightString(self.width, y, f"{self.money_formatter(spent)} {self.of_label} {self.money_formatter(total)}")
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
    production_schedule = payload.get("productionSchedule") or {}
    labels = translations(payload.get("language"))
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
        title=f"{text(payload.get('title'), 'FilmScript')} {labels['budget']}",
        author="FilmScript",
        subject=labels["budget"],
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
    story.append(Paragraph(escape(labels["production"]), eyebrow))
    story.append(Paragraph(escape(text(payload.get("title"), "Untitled screenplay")), title_style))
    story.append(Paragraph(escape(labels["budget"]), ParagraphStyle("BudgetWord", parent=section, fontSize=18, textColor=ACCENT, spaceAfter=16)))
    detail_data = [
        [paragraph(labels["producer"], kpi_label), paragraph(metadata.get("producer") or labels["notFilled"], body), paragraph(labels["format"], kpi_label), paragraph(metadata.get("format") or labels["notFilled"], body)],
        [paragraph(labels["director"], kpi_label), paragraph(metadata.get("director") or labels["notFilled"], body), paragraph(labels["locations"], kpi_label), paragraph(metadata.get("locations") or labels["notFilled"], body)],
        [paragraph(labels["shootingDates"], kpi_label), paragraph(metadata.get("shootingDates") or labels["notFilled"], body), paragraph(labels["currency"], kpi_label), paragraph(settings.get("currencyCode") or "GTQ", body)],
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
    story.append(Paragraph(escape(labels["quickView"]), eyebrow))
    kpis = [
        (labels["plannedBudget"], money(computed.get("total"))),
        (labels["actualSpend"], money(computed.get("spent"))),
        (labels["remaining"], money(computed.get("remaining"))),
        (labels["fundingGap"], money(computed.get("fundingGap"))),
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
    story.append(Paragraph(escape(labels["whereBudgetGoes"]), eyebrow))
    phase_name_map = {
        "Above the Line": labels["aboveTheLine"],
        "Production": labels["productionPhase"],
        "Postproduction": labels["postProduction"],
        "Other": labels["other"],
    }
    localized_phases = [{**phase, "name": phase_name_map.get(text(phase.get("name")), text(phase.get("name"), labels["phase"]))} for phase in computed.get("phases") or []]
    story.append(PhaseBars(localized_phases, money, labels["of"], width=174 * mm, height=128))

    story.append(PageBreak())
    heading(labels["rollup"], labels["budgetSummary"], labels["summaryDescription"])
    summary_rows = [[paragraph(value, table_head) for value in [labels["account"], labels["concept"], labels["subtotal"], labels["tax"], labels["total"], labels["remaining"]]]]
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
        "", paragraph(labels["grandTotal"], group_white), paragraph(money(computed.get("subtotal")), small_right_white),
        paragraph(money(computed.get("tax")), small_right_white), paragraph(money(computed.get("total")), small_right_white),
        paragraph(money(computed.get("remaining")), small_right_white),
    ])
    summary_table = LongTable(summary_rows, colWidths=[17 * mm, 64 * mm, 24 * mm, 21 * mm, 25 * mm, 25 * mm], repeatRows=1)
    summary_table.setStyle(base_table_style(len(summary_rows)))
    summary_table.setStyle(TableStyle([("BACKGROUND", (0, -1), (-1, -1), INK), ("TEXTCOLOR", (0, -1), (-1, -1), colors.white)]))
    story.append(summary_table)

    story.append(PageBreak())
    heading(labels["costDetail"], labels["budgetBreakdown"], labels["breakdownDescription"])
    breakdown_header = [paragraph(value, table_head) for value in [labels["code"], labels["costItem"], labels["qty"], labels["unit"], labels["times"], labels["subtotal"], labels["tax"], labels["total"]]]
    breakdown_rows = [breakdown_header]
    for account in computed.get("accounts") or []:
        breakdown_rows.append([paragraph(account.get("code"), group_style), paragraph(account.get("name"), group_style), "", "", "", "", "", paragraph(money(account.get("total")), small_right)])
        for item in account.get("items") or []:
            breakdown_rows.append([
                paragraph(item.get("code"), small),
                paragraph(item.get("name"), small),
                paragraph(f"{number(item.get('quantity')):g}", small_right),
                paragraph(localized_unit(item.get("unit"), payload.get("language")), small),
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
    heading(labels["fundingSources"], labels["financePlan"], labels["financeDescription"])
    finance_kpis = Table([
        [paragraph(labels["cashBudget"], kpi_label), paragraph(labels["inKindBudget"], kpi_label), paragraph(labels["fundingPlanned"], kpi_label), paragraph(labels["fundingReceived"], kpi_label)],
        [paragraph(money(computed.get("cashTotal")), kpi_value), paragraph(money(computed.get("inKindTotal")), kpi_value), paragraph(money(computed.get("fundingPlanned")), kpi_value), paragraph(money(computed.get("fundingReceived")), kpi_value)],
    ], colWidths=[42 * mm] * 4)
    finance_kpis.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SOFT), ("BOX", (0, 0), (-1, -1), 0.6, HAIR), ("INNERGRID", (0, 0), (-1, -1), 0.35, HAIR), ("LEFTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.append(finance_kpis)
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph(escape(labels["contributors"]), eyebrow))
    funding_rows = [[paragraph(value, table_head) for value in [labels["contributor"], labels["type"], labels["planned"], labels["received"], labels["status"], labels["paymentDate"], labels["proof"]]]]
    for source in budget.get("fundingSources") or []:
        funding_rows.append([
            paragraph(source.get("name"), small), paragraph(labels["inKind"] if text(source.get("type"), "cash") == "in_kind" else labels["cash"], small),
            paragraph(money(source.get("amount")), small_right), paragraph(money(source.get("paid")), small_right),
            paragraph(localized_status(source.get("status"), labels), small), paragraph(display_date(source.get("paymentDate"), payload.get("language")), small),
            paragraph(source.get("receiptName") or "", small),
        ])
    if len(funding_rows) == 1:
        funding_rows.append([paragraph(labels["noContributors"], small), "", "", "", "", "", ""])
    funding_table = LongTable(funding_rows, colWidths=[47 * mm, 19 * mm, 24 * mm, 24 * mm, 26 * mm, 31 * mm, 27 * mm], repeatRows=1)
    funding_table.setStyle(base_table_style(len(funding_rows)))
    story.append(funding_table)

    story.append(PageBreak())
    heading(labels["weeklyTiming"], labels["cashFlow"], labels["cashFlowDescription"])
    periods = budget.get("periods") or []
    cash_totals = computed.get("scheduleCashTotals") or {}
    shoot_index = next((index for index, period in enumerate(periods) if period.get("id") == "shoot_1"), 0)
    shoot_start = iso_date(production_schedule.get("shootStartDate"))
    dated_expenses = []
    for expense in computed.get("expenseRows") or []:
        paid = iso_date(expense.get("paymentDate"))
        if paid and expense.get("fundingKind") != "in_kind":
            dated_expenses.append((paid, number(expense.get("amount"))))
    weekly_values = []
    for index, period in enumerate(periods):
        start = shoot_start + timedelta(days=(index - shoot_index) * 7) if shoot_start else None
        end = start + timedelta(days=6) if start else None
        actual = sum(amount for paid, amount in dated_expenses if start and start <= paid <= end)
        weekly_values.append({
            "period": period,
            "label": period_label(period, payload.get("language"), labels),
            "start": start,
            "end": end,
            "planned": number(cash_totals.get(period.get("id"))),
            "actual": actual,
        })
    peak = max(weekly_values, key=lambda week: week["planned"], default={"planned": 0, "period": {}, "label": labels["noScheduledWeek"]})
    over_scheduled = number(computed.get("overScheduledCashTotal"))
    unscheduled = over_scheduled if over_scheduled > 0.005 else number(computed.get("unscheduledCashTotal"))
    difference_label = labels["overScheduled"] if over_scheduled > 0.005 else labels["cashUnscheduled"]
    cash_expense_count = sum(1 for expense in computed.get("expenseRows") or [] if expense.get("fundingKind") != "in_kind")
    undated_cash_expense_count = max(0, cash_expense_count - len(dated_expenses))
    payment_note = (
        f"{len(dated_expenses)} {labels['datedNeedDates']} / {undated_cash_expense_count} {labels['datedNeedDates']}"
        if undated_cash_expense_count
        else f"{cash_expense_count} {labels['payment'] if cash_expense_count == 1 else labels['payments']}"
    )
    difference_note = (
        labels["rebalanceCostItems"]
        if over_scheduled > 0.005
        else labels["stillNeedsProductionWeek"]
        if unscheduled > 0.005
        else labels["everyCashCostHasWeek"]
    )
    cashflow_kpis = Table([
        [paragraph(labels["cashScheduled"], kpi_label), paragraph(difference_label, kpi_label), paragraph(labels["peakCashWeek"], kpi_label), paragraph(labels["actualCashSpend"], kpi_label)],
        [paragraph(money(computed.get("scheduledCashTotal")), kpi_value), paragraph(money(unscheduled), kpi_value), paragraph(money(peak["planned"]), kpi_value), paragraph(money(computed.get("cashSpent")), kpi_value)],
        [paragraph(labels["placedOnTimeline"], small), paragraph(difference_note, small), paragraph(text(peak.get("label"), labels["noScheduledWeek"]), small), paragraph(payment_note, small)],
    ], colWidths=[42 * mm] * 4)
    cashflow_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(cashflow_kpis)
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph(escape(labels["weeklyCashLedger"]), eyebrow))
    cashflow_rows = [[paragraph(value, table_head) for value in [labels["stage"], labels["week"], labels["dates"], labels["plannedCash"], labels["actual"], labels["variance"]]]]
    stage_names = {"prep": labels["preproduction"], "shoot": labels["productionStage"], "wrap": labels["wrap"], "post": labels["postproduction"]}
    stage_colors = {"prep": ACCENT, "shoot": GREEN, "wrap": PURPLE, "post": BLUE}
    for week in weekly_values:
        period = week["period"]
        variance = week["planned"] - week["actual"]
        cashflow_rows.append([
            paragraph(stage_names.get(period.get("stage"), labels["productionStage"]), small),
            paragraph(period_label(period, payload.get("language"), labels), small),
            paragraph(week_range(week["start"], week["end"], payload.get("language")), small),
            paragraph(money(week["planned"]), small_right),
            paragraph(money(week["actual"]) if shoot_start else "-", small_right),
            paragraph(money(variance) if shoot_start else "-", small_right),
        ])
    if len(cashflow_rows) == 1:
        cashflow_rows.append([paragraph(labels["noProductionWeeks"], small), "", "", paragraph(money(0), small_right), "", ""])
    cashflow_table = LongTable(cashflow_rows, colWidths=[26 * mm, 34 * mm, 40 * mm, 27 * mm, 23 * mm, 24 * mm], repeatRows=1)
    cashflow_table.setStyle(base_table_style(len(cashflow_rows), font_size=6.8))
    cashflow_table.setStyle(TableStyle([
        ("LINEBEFORE", (0, row_index), (0, row_index), 2, stage_colors.get(week["period"].get("stage"), HAIR))
        for row_index, week in enumerate(weekly_values, start=1)
    ]))
    story.append(cashflow_table)
    story.append(Spacer(1, 5 * mm))
    connection_copy = (
        f"{labels['connectedCopy']}: {int(number(production_schedule.get('shootDays')))} {labels['shootDays']} "
        f"across {int(number(production_schedule.get('shootWeeks')) or 1)} {labels['shootWeeks']}."
        if production_schedule.get("connected")
        else labels["addBreakdownCopy"]
    )
    date_copy = (
        f" {labels['calendarDatesStart']} {shoot_start.strftime('%d %b %Y') if str(payload.get('language') or '').lower().startswith('es') else shoot_start.strftime('%b %d, %Y')}."
        if shoot_start
        else f" {labels['relativeWeeks']}"
    )
    story.append(Paragraph(escape(f"{connection_copy}{date_copy} {labels['inkindExcluded']}"), small))

    story.append(PageBreak())
    heading(labels["actuals"], labels["expenseReport"], labels["expenseDescription"])
    over_line_count = int(number(computed.get("overBudgetLineCount")))
    unexpected_count = int(number(computed.get("unbudgetedCount")))
    expense_kpis = Table([
        [paragraph(labels["approvedBudget"], kpi_label), paragraph(labels["totalPaid"], kpi_label), paragraph(labels["overBudget"], kpi_label), paragraph(labels["unexpectedCosts"], kpi_label)],
        [paragraph(money(computed.get("total")), kpi_value), paragraph(money(computed.get("spent")), kpi_value), paragraph(money(computed.get("overBudgetSpent")), kpi_value), paragraph(money(computed.get("unbudgetedSpent")), kpi_value)],
        [paragraph(labels["budgetBreakdownTotal"], small), paragraph(f"{len(computed.get('expenseRows') or [])} {labels['payments']}", small), paragraph(f"{over_line_count} {labels['approvedLinesExceeded']}", small), paragraph(f"{unexpected_count} {labels['outsideApprovedPlan']}", small)],
    ], colWidths=[42 * mm] * 4)
    expense_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("BOX", (0, 0), (-1, -1), 0.6, HAIR),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, HAIR),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(expense_kpis)
    story.append(Spacer(1, 7 * mm))
    story.append(Paragraph(escape(labels["paymentLedger"]), eyebrow))
    expense_rows = [[paragraph(value, table_head) for value in [labels["payment"].title(), labels["date"], labels["budgetLine"], labels["vendorConcept"], labels["paid"], labels["lineBalance"], labels["receipt"]]]]
    expense_states = []
    for expense in computed.get("expenseRows") or []:
        unexpected = bool(expense.get("isUnbudgeted"))
        over_budget = bool(expense.get("isOverBudget"))
        budget_line = (
            f"{labels['unexpectedCost']} - {text(expense.get('lineItemCode'))} {text(expense.get('lineItemName'))}".strip(" -")
            if unexpected
            else f"{text(expense.get('lineItemCode'))} {text(expense.get('lineItemName'))}".strip()
        )
        vendor = text(expense.get("vendor"))
        concept = text(expense.get("concept"))
        vendor_concept = escape(vendor or concept)
        if vendor and concept and vendor != concept:
            vendor_concept = f"{escape(vendor)}<br/><font color='#77756E'>{escape(concept)}</font>"
        line_balance = -number(expense.get("amount")) if unexpected else number(expense.get("lineBalance"))
        expense_rows.append([
            paragraph(expense.get("paymentNumber"), small), paragraph(display_date(expense.get("paymentDate"), payload.get("language")), small),
            paragraph(budget_line, small),
            Paragraph(vendor_concept, small),
            paragraph(money(expense.get("amount")), small_right), paragraph(money(line_balance), small_right),
            paragraph(expense.get("receiptName") or "", small),
        ])
        expense_states.append("unbudgeted" if unexpected else "over" if over_budget else "within")
    if len(expense_rows) == 1:
        expense_rows.append([paragraph(labels["noExpenses"], small), "", "", "", paragraph(money(0), small_right), paragraph(money(computed.get("total")), small_right), ""])
    expense_rows.append(["", "", paragraph(labels["totalPaidLabel"], group_white), "", paragraph(money(computed.get("spent")), small_right_white), paragraph(money(computed.get("remaining")), small_right_white), ""])
    expense_table = LongTable(expense_rows, colWidths=[17 * mm, 24 * mm, 50 * mm, 36 * mm, 22 * mm, 23 * mm, 26 * mm], repeatRows=1)
    expense_table.setStyle(base_table_style(len(expense_rows)))
    expense_style = [
        ("BACKGROUND", (0, -1), (-1, -1), INK),
        ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
    ]
    for row_index, state in enumerate(expense_states, start=1):
        if state == "unbudgeted":
            expense_style.extend([
                ("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#FFF5DC")),
                ("LINEBEFORE", (0, row_index), (0, row_index), 2, ACCENT),
            ])
        elif state == "over":
            expense_style.extend([
                ("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#FBEDEC")),
                ("LINEBEFORE", (0, row_index), (0, row_index), 2, RED),
            ])
        else:
            expense_style.append(("LINEBEFORE", (0, row_index), (0, row_index), 2, GREEN))
    expense_table.setStyle(TableStyle(expense_style))
    story.append(expense_table)

    def footer(canvas, document):
        canvas.saveState()
        width, _ = A4
        canvas.setStrokeColor(HAIR)
        canvas.setLineWidth(0.5)
        canvas.line(16 * mm, 13 * mm, width - 16 * mm, 13 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 6.8)
        canvas.drawString(16 * mm, 8.5 * mm, labels["footerBudget"])
        canvas.drawCentredString(width / 2, 8.5 * mm, datetime.now(timezone.utc).strftime("%Y %m %d"))
        canvas.drawRightString(width - 16 * mm, 8.5 * mm, f"{labels['page']} {document.page}")
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
