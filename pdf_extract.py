import io
import json
import re
import sys

import pdfplumber


def main():
    data = sys.stdin.buffer.read()
    if not data.startswith(b"%PDF"):
        raise ValueError("Not a PDF")
    pages = []
    blocks = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
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
            # A screenplay's first page can be a title page. It has no scene
            # heading and its text is intentionally centered on the sheet.
            is_title_page = page_index == 0 and not any(
                re.match(r"^\d*\s*(INT|EXT|INT/EXT|I/E)[.\s-]", line, re.I)
                for line in row_texts
            )
            page_blocks = []
            title_line_number = 0
            for row in rows:
                words = row["words"]
                x = min(word["x0"] for word in words)
                line = " ".join(word["text"] for word in words).strip()
                if not line or (not is_title_page and (re.fullmatch(r"[\d.\s]+", line) or re.fullmatch(r"[ÁÉÍÓÚÜÑáéíóúüñ]", line))):
                    continue
                if is_title_page:
                    title_line_number += 1
                    if title_line_number == 1:
                        kind = "title"
                    elif re.fullmatch(r"\d{1,2}[./-]\d{1,2}[./-]\d{2,4}", line):
                        kind = "title_date"
                    elif re.match(r"^(written|escrito)\b", line, re.I):
                        kind = "title_credit"
                    else:
                        kind = "title_author"
                    page_blocks.append({"type": kind, "text": line, "last_y": row["y"]})
                    continue
                scene = re.sub(r"^\d+\s+", "", line)
                scene = re.sub(r"\s+\d+$", "", scene)
                # Scene headings are the source of truth for the editor's
                # Scenes index. PDF exports often shift them horizontally,
                # so do not rely on the x-position to identify them.
                if re.match(r"^(INT|EXT|INT/EXT|I/E)[.\s-]", scene, re.I):
                    kind, line = "scene", scene.upper()
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
    sys.stdout.write(json.dumps({"text": output, "blocks": blocks}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
