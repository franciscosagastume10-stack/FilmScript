#!/usr/bin/env python3
import io
import json
import sys
import unicodedata
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


PAGE_W, PAGE_H = A4
INK = HexColor("#242421")
MUTED = HexColor("#77746C")
LINE = HexColor("#D7D1C7")
SOFT = HexColor("#F3EEE6")
SURFACE = HexColor("#FFFDF8")
ACCENT = HexColor("#BA7517")


def safe(value):
    text = unicodedata.normalize("NFC", str(value if value is not None else ""))
    replacements = {
        "\u2013": "-", "\u2014": "-", "\u2011": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u00b7": "/",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text.encode("cp1252", "replace").decode("cp1252")


def ptext(value):
    return escape(safe(value)).replace("\n", "<br/>")


def runtime_label(seconds):
    seconds = max(0, int(seconds or 0))
    hours, remaining = divmod(seconds, 3600)
    minutes, secs = divmod(remaining, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def export_date(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%B %d, %Y")
    except Exception:
        return safe(value)


styles = getSampleStyleSheet()
TITLE = ParagraphStyle("AnalysisTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=INK, spaceAfter=5)
SUBTITLE = ParagraphStyle("AnalysisSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED)
SECTION = ParagraphStyle("AnalysisSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=INK, spaceBefore=12, spaceAfter=7)
BODY = ParagraphStyle("AnalysisBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.8, leading=12.5, textColor=INK)
SMALL = ParagraphStyle("AnalysisSmall", parent=BODY, fontSize=7.5, leading=10.5, textColor=MUTED)
METRIC_VALUE = ParagraphStyle("MetricValue", parent=BODY, fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=INK)
METRIC_LABEL = ParagraphStyle("MetricLabel", parent=SMALL, fontName="Helvetica-Bold", fontSize=6.8, leading=9, textColor=MUTED)


def para(value, style=BODY):
    return Paragraph(ptext(value), style)


def section(title):
    return KeepTogether([
        Paragraph(ptext(title), SECTION),
        HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=7),
    ])


def metric_cell(label, value):
    return [Paragraph(ptext(value), METRIC_VALUE), Paragraph(ptext(label), METRIC_LABEL)]


def grid_metrics(metrics):
    items = [
        ("Pages", metrics.get("pages", 0)),
        ("Scenes", metrics.get("scenes", 0)),
        ("Words", f"{int(metrics.get('words', 0)):,}"),
        ("Estimated Runtime", runtime_label(metrics.get("estimatedRuntimeSeconds", 0))),
        ("Interior Scenes", metrics.get("interiorScenes", 0)),
        ("Exterior Scenes", metrics.get("exteriorScenes", 0)),
        ("Day Scenes", metrics.get("dayScenes", 0)),
        ("Night Scenes", metrics.get("nightScenes", 0)),
    ]
    data = [[metric_cell(label, value) for label, value in items[:4]], [metric_cell(label, value) for label, value in items[4:]]]
    table = Table(data, colWidths=[42.5 * mm] * 4, rowHeights=[25 * mm, 25 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def data_table(headers, rows, widths=None):
    header = [Paragraph(ptext(value), METRIC_LABEL) for value in headers]
    body = [[Paragraph(ptext(value), BODY if index else ParagraphStyle("CellStrong", parent=BODY, fontName="Helvetica-Bold")) for index, value in enumerate(row)] for row in rows]
    table = Table([header] + body, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SOFT),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def on_page(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.45)
    canvas.line(20 * mm, 15 * mm, PAGE_W - 20 * mm, 15 * mm)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(HexColor("#A39E94"))
    canvas.drawCentredString(PAGE_W / 2, 9.5 * mm, "FILMSCRIPT")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - 20 * mm, 9.5 * mm, f"Page {document.page}")
    canvas.restoreState()


def build_story(payload):
    metrics = payload.get("metrics") or {}
    deep = payload.get("deep") or None
    story = [
        Paragraph(ptext(payload.get("title") or "Untitled Screenplay"), TITLE),
        Paragraph(ptext("ANALYSIS  /  A LUMIERE SCREENPLAY READING"), SUBTITLE),
        Spacer(1, 4),
        Paragraph(ptext(f"Exported {export_date(payload.get('exportedAt'))}  /  Script version {payload.get('scriptVersion') or payload.get('contentHash') or 'Current'}"), SMALL),
        Spacer(1, 13),
    ]
    if payload.get("stale"):
        story.append(para("This report preserves the last available Lumiere reading from an earlier screenplay version.", SMALL))
        story.append(Spacer(1, 7))

    def scene_label(item):
        number = item.get("sceneNumber") or "-"
        page = item.get("page") or "-"
        return f"Scene {number} / Page {page}"

    def insight_rows(items, explanation_key="explanation"):
        return [[
            item.get("title") or item.get("label") or "Observation",
            item.get(explanation_key) or item.get("reason") or item.get("text") or "",
            scene_label(item),
            item.get("referenceText") or "",
        ] for item in items]

    if deep:
        status = deep.get("statusSummary") or {}
        status_table = Table([[
            Paragraph(ptext(status.get("label") or "Developing"), ParagraphStyle("Status", parent=BODY, fontName="Helvetica-Bold", fontSize=11, textColor=ACCENT)),
            Paragraph(ptext(status.get("reason") or "Current screenplay reading"), SMALL),
        ]], colWidths=[42 * mm, 128 * mm])
        status_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), SOFT),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(status_table)
        story.append(Spacer(1, 9))

        overview = deep.get("overview") or {}
        legacy_moments = [item for item in (deep.get("moments") or []) if item.get("status") != "dismissed"]
        legacy_suggestions = deep.get("suggestions") or []
        groups = [
            ("What's Working", overview.get("working") or legacy_moments[:3]),
            ("Needs Attention", overview.get("needsAttention") or legacy_suggestions[:3]),
            ("Production Impact", overview.get("productionImpact") or []),
        ]
        for title, items in groups:
            if not items:
                continue
            story.append(section(title))
            story.append(data_table(["Insight", "Why it matters", "Affected scene", "Evidence"], insight_rows(items), [34 * mm, 67 * mm, 27 * mm, 42 * mm]))

        clarity = deep.get("storyClarity") or {}
        clarity_points = clarity.get("points") or []
        if clarity_points:
            story.append(CondPageBreak(72 * mm))
            story.append(section("Story Clarity"))
            if clarity.get("summary"):
                story.append(para(clarity.get("summary"), SMALL))
                story.append(Spacer(1, 6))
            story.append(data_table(
                ["Story point", "What happens", "Why it matters", "Scene"],
                [[item.get("stage"), item.get("title"), item.get("explanation"), scene_label(item)] for item in clarity_points],
                [28 * mm, 45 * mm, 70 * mm, 27 * mm],
            ))

        flow = deep.get("storyFlow") or {}
        flow_points = flow.get("points") or deep.get("emotionalArc") or deep.get("pacing") or []
        if flow_points:
            story.append(CondPageBreak(78 * mm))
            story.append(section("Story Flow"))
            takeaway = flow.get("takeaway") or {}
            if takeaway:
                story.append(para(f"Lumiere's read: {takeaway.get('title', '')}. {takeaway.get('explanation', '')}", BODY))
                story.append(Spacer(1, 6))
            story.append(data_table(
                ["Scene", "Flow", "Marker", "Lumiere's reading"],
                [[scene_label(item), item.get("label"), item.get("marker") or "", item.get("explanation")] for item in flow_points],
                [31 * mm, 34 * mm, 28 * mm, 77 * mm],
            ))

        issues = deep.get("sceneIssues") or []
        if issues:
            story.append(section("Scenes That Need Attention"))
            story.append(data_table(["Issue", "Why it matters", "Scene", "Evidence"], insight_rows(issues), [34 * mm, 67 * mm, 27 * mm, 42 * mm]))

        key_moments = deep.get("keyMoments") or legacy_moments
        if key_moments:
            story.append(section("Key Moments"))
            story.append(data_table(["Moment", "Narrative impact", "Scene", "Evidence"], insight_rows(key_moments), [34 * mm, 67 * mm, 27 * mm, 42 * mm]))

        production = deep.get("productionOverview") or {}
        if production:
            story.append(CondPageBreak(72 * mm))
            story.append(section("Production Overview"))
            production_items = [
                ("Locations", (production.get("locations") or {}).get("count", 0)),
                ("Characters", (production.get("characters") or {}).get("count", 0)),
                ("Night scenes", (production.get("nightScenes") or {}).get("count", 0)),
                ("Complex scenes", len(production.get("complexScenes") or [])),
            ]
            production_grid = Table([[metric_cell(label, value) for label, value in production_items]], colWidths=[42.5 * mm] * 4, rowHeights=[23 * mm])
            production_grid.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ]))
            story.append(production_grid)
            complex_scenes = production.get("complexScenes") or []
            if complex_scenes:
                story.append(Spacer(1, 8))
                story.append(data_table(["High-complexity scene", "Why it is complex", "Scene", "Evidence"], insight_rows(complex_scenes), [38 * mm, 63 * mm, 27 * mm, 42 * mm]))

    scenes = payload.get("scenes") or []
    if scenes:
        story.append(PageBreak())
        story.append(section("Scene Index"))
        story.append(data_table(
            ["#", "Page", "Heading", "INT./EXT.", "Time"],
            [[scene.get("sceneNumber"), scene.get("page"), scene.get("heading"), scene.get("intExt"), scene.get("dayNight")] for scene in scenes],
            [12 * mm, 15 * mm, 92 * mm, 24 * mm, 27 * mm],
        ))
    return story


def main():
    payload = json.load(sys.stdin)
    output = io.BytesIO()
    document = BaseDocTemplate(
        output,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=21 * mm,
        title=safe(f"{payload.get('title') or 'FilmScript'} Analysis"),
        author="FilmScript",
    )
    frame = Frame(document.leftMargin, document.bottomMargin, document.width, document.height, id="analysis-frame", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    document.addPageTemplates(PageTemplate(id="analysis", frames=[frame], onPage=on_page))
    document.build(build_story(payload))
    sys.stdout.buffer.write(output.getvalue())


if __name__ == "__main__":
    main()
