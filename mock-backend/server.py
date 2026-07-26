#!/usr/bin/env python3
"""Mock backend for clockindle personal-fork development.
Conforms to docs/API.md. NOT for production.
Run: python3 mock-backend/server.py [port]
Default port: 8765
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "data.json")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
}


def load_data():
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def make_response(handler, status, body):
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    for k, v in CORS_HEADERS.items():
        handler.send_header(k, v)
    handler.end_headers()
    handler.wfile.write(payload)


def check_auth(handler, data):
    header = handler.headers.get("Authorization", "")
    return header == "Bearer " + data.get("token", "")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # quieter than default
        sys.stderr.write("[%s] %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/nas/devices":
            data = load_data()
            return make_response(self, 200, {
                "devices": data["nasDevices"],
                "intervalMs": 30000,
            })

        if parsed.path == "/api/todo":
            data = load_data()
            return make_response(self, 200, {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "items": data["todos"],
                "intervalMs": 600000,
            })

        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": parsed.path}})

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/todo/"):
            return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": parsed.path}})

        data = load_data()
        if not check_auth(self, data):
            return make_response(self, 401, {"error": {"code": "UNAUTHORIZED", "message": "bad token"}})

        todo_id = parsed.path[len("/api/todo/"):]
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return make_response(self, 400, {"error": {"code": "BAD_REQUEST", "message": "invalid json"}})

        if "done" not in body or not isinstance(body["done"], bool):
            return make_response(self, 400, {"error": {"code": "BAD_REQUEST", "message": "missing bool field 'done'"}})

        for item in data["todos"]:
            if item["id"] == todo_id:
                item["done"] = body["done"]
                save_data(data)
                return make_response(self, 200, item)

        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": todo_id}})

    # POST and DELETE are out of scope (mini-program only). Return 404 so it is obvious.
    def do_POST(self):
        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": "use mini-program, not mock"}})

    def do_DELETE(self):
        return make_response(self, 404, {"error": {"code": "NOT_FOUND", "message": "use mini-program, not mock"}})


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = HTTPServer(("0.0.0.0", port), Handler)
    print("mock-backend listening on http://localhost:%d  (data: %s)" % (port, DATA_FILE))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
