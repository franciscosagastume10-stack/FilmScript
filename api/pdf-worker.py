#!/usr/bin/env python3
import hmac
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent.parent
WORKERS = {
    "extract": ("pdf_extract.py", "application/json; charset=utf-8"),
    "breakdown": ("breakdown_pdf.py", "application/pdf"),
    "stripboard": ("stripboard_pdf.py", "application/pdf"),
    "shotlist": ("shotlist_pdf.py", "application/pdf"),
    "budget": ("budget_pdf.py", "application/pdf"),
    "analysis": ("analysis_pdf.py", "application/pdf"),
    "canvas-quote": ("canvas_quote_pdf.py", "application/pdf"),
}
MAX_BODY_BYTES = 20 * 1024 * 1024


class handler(BaseHTTPRequestHandler):
    def _reply(self, status, body, content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        expected = os.environ.get("FILMSCRIPT_PDF_WORKER_SECRET", "")
        received = self.headers.get("X-FilmScript-Worker-Secret", "")
        if not expected or not hmac.compare_digest(expected, received):
            self._reply(401, b"Unauthorized")
            return

        kind = parse_qs(urlparse(self.path).query).get("kind", [""])[0]
        worker = WORKERS.get(kind)
        if not worker:
            self._reply(400, b"Unsupported FilmScript PDF operation")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            self._reply(413, b"Invalid or oversized request body")
            return

        payload = self.rfile.read(content_length)
        script_name, content_type = worker
        try:
            result = subprocess.run(
                [sys.executable, str(ROOT / script_name)],
                input=payload,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=str(ROOT),
                timeout=280,
                check=False,
            )
        except subprocess.TimeoutExpired:
            self._reply(504, b"FilmScript PDF operation timed out")
            return

        if result.returncode != 0:
            message = result.stderr[-1200:] or b"FilmScript PDF operation failed"
            self._reply(422 if kind == "extract" else 500, message)
            return

        self._reply(200, result.stdout, content_type)

    def do_GET(self):
        self._reply(405, b"Method not allowed")
