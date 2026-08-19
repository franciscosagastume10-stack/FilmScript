import io
import json
import os
import re
import sys

import pdfplumber


SCENE_PREFIX = r"(?:INT|EXT|INT/EXT|EXT/INT|I/E|I\.E\.)"


def clean_scene_heading(line):
    """Return a Scenarist-style heading, never a dialogue cue/number."""
    value = re.sub(r"^\s*\d+\s+(?=" + SCENE_PREFIX + r"[.\s/-])", "", line, flags=re.I)
    value = re.sub(r"\s+\d+\s*$", "", value).strip()
    # Keep this explicit expression alongside the extended Scenarist variants:
    # if re.match(r"^(INT|EXT|INT/EXT|I/E)[.\s-]", value, re.I)
    if re.match(r"^(INT|EXT|INT/EXT|I/E)[.\s-]", value, re.I) or re.match(r"^(EXT\.?/INT\.?|INT\.?/EXT\.?)[.\s-]", value, re.I):
        return value.upper()
    return ""


def clean_dialogue_counter(line):
    """Scenarist exports dialogue counters as 11:, 12:, etc. They are not script text."""
    value = line.strip()
    if re.fullmatch(r"\d{1,4}\s*:\s*", value):
        return ""
    return re.sub(r"\s+\d{1,4}\s*:\s*$", "", value).strip()


def collapse_repeated_page_headings(blocks):
    """Remove only headings repeated by pagination before any real scene content."""
    last_scene_index = None
    scene_has_content = False
    for index, block in enumerate(blocks):
        kind = block.get("type")
        if kind == "scene":
            if last_scene_index is not None and not scene_has_content and blocks[last_scene_index].get("text") == block.get("text"):
                blocks[last_scene_index]["type"] = "discard"
            last_scene_index = index
            scene_has_content = False
        elif kind not in {"pagebreak", "discard"} and last_scene_index is not None:
            scene_has_content = True
    return [block for block in blocks if block.get("type") != "discard"]


def main():
    data = sys.stdin.buffer.read()
    if not data.startswith(b"%PDF"):
        raise ValueError("Not a PDF")
    pages = []
    blocks = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        max_pages = max(1, int(os.environ.get("FILMSCRIPT_PDF_MAX_PAGES", "500")))
        if len(pdf.pages) > max_pages:
            raise ValueError(f"PDF has more than {max_pages} pages")
        for page_index, page in enumerate(pdf.pages):
            text = page.extract_text(layout=True, x_tolerance=2, y_tolerance=3) or ""
            if text.strip():
                pages.append(text)
            rows = []
            for word in page.extract_words(x_tolerance=2, y_tolerance=3, use_text_flow=True):
                y = round(word["top"] / 3) * 3
                if not rows or abs(rows[-1]["y"] - y) > 3:
                    rows.append({"y": y, "words": []})
                rows[-1]["words"].append(word)
            row_texts = [" ".join(word["text"] for word in row["words"]).strip() for row in rows]
            # Scenarist may put the cover information above the first scene on
            # page one. Detect that opening run independently from the rest of
            # the page; it belongs on the screenplay cover, never in scene 1.
            first_scene_row = next((index for index, row_text in enumerate(row_texts) if clean_scene_heading(row_text)), None)
            is_title_page = page_index == 0 and first_scene_row is None
            page_blocks = []
            title_line_number = 0
            for row_index, row in enumerate(rows):
                words = row["words"]
                x = min(word["x0"] for word in words)
                line = " ".join(word["text"] for word in words).strip()
                opening_cover_line = page_index == 0 and first_scene_row is not None and row_index < first_scene_row
                if not line or (not is_title_page and not opening_cover_line and (re.fullmatch(r"[\d.\s]+", line) or re.fullmatch(r"[ÁÉÍÓÚÜÑáéíóúüñ]", line))):
                    continue
                if is_title_page or opening_cover_line:
                    title_line_number += 1
                    if title_line_number == 1:
                        kind = "title"
                    elif re.fullmatch(r"(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4})", line):
                        kind = "title_date"
                    elif re.match(r"^(written|escrito|guion|gui[oó]n)\b", line, re.I):
                        kind = "title_credit"
                    else:
                        kind = "title_author"
                    page_blocks.append({"type": kind, "text": line, "last_y": row["y"]})
                    continue
                line = clean_dialogue_counter(line)
                if not line:
                    continue
                scene = clean_scene_heading(line)
                # Scene headings are the source of truth for the editor's
                # Scenes index. PDF exports often shift them horizontally,
                # so do not rely on the x-position to identify them.
                if scene:
                    kind, line = "scene", scene
                elif x >= 235 and line == line.upper() and re.search(r"[A-ZÁÉÍÓÚÑ]", line):
                    kind = "character"
                elif 160 <= x < 235 and line.startswith("("):
                    kind = "paren"
                elif 160 <= x < 235:
                    kind = "dialogue"
                elif line.upper().endswith("TO:") or line.upper() in {"FADE OUT.", "SMASH CUT:"}:
                    kind, line = "transition", line.upper()
                else:
                    kind = "action"
                previous = page_blocks[-1] if page_blocks else None
                gap = row["y"] - previous["last_y"] if previous else 999
                if previous and previous["type"] == kind and gap <= 15 and kind in {"action", "dialogue", "paren"}:
                    previous["text"] += " " + line
                    previous["last_y"] = row["y"]
                else:
                    page_blocks.append({"type": kind, "text": line, "last_y": row["y"]})
            blocks.extend({"type": block["type"], "text": block["text"]} for block in page_blocks)
            if page_index < len(pdf.pages) - 1 and page_blocks:
                blocks.append({"type": "pagebreak", "text": ""})
    output = "\n\n".join(pages).strip()
    if not output:
        raise ValueError("No readable text found in PDF")
    blocks = collapse_repeated_page_headings(blocks)
    sys.stdout.write(json.dumps({"text": output, "blocks": blocks}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
