"""Exercise the shipped script over loopback HTTP with an isolated fixture."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "dev" / "kino.py"
META = {"request_id": "fixture", "today": "2026-11-17", "attribution": "TMDB",
        "user": {"locale": "pt-BR", "region": "BR", "timezone": "America/Sao_Paulo"}}


class AdapterTest(unittest.TestCase):
    def setUp(self):
        self.requests = []
        self.status = 200
        self.response = {"entries": [], "total": 0, "meta": META}
        self.redirect = None
        test = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                test.requests.append((self.path, self.headers.get("Authorization"),
                                      json.loads(self.rfile.read(int(self.headers["Content-Length"])))))
                self.send_response(test.status)
                self.send_header("Content-Type", "application/json")
                if test.redirect:
                    self.send_header("Location", test.redirect)
                self.end_headers()
                self.wfile.write(json.dumps(test.response).encode())

            def log_message(self, *_args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.origin = f"http://localhost:{self.server.server_port}"
        self.token = f"kino_v1_{hashlib.sha256(self.origin.encode()).hexdigest()[:24]}_{'A' * 43}"
        self.env = {**os.environ, "KINO_AGENT_ORIGIN": self.origin, "KINO_AGENT_TOKEN": self.token,
                    "KINO_AGENT_ALLOW_LOCAL_HTTP": "1"}
        self.thread = Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def run_script(self, *args, body="{}"):
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), *args],
                                input=body, encoding="utf-8", capture_output=True, env=self.env, timeout=5)
        self.assertNotIn(self.token, result.stdout + result.stderr)
        self.assertEqual(result.stderr, "")
        return result.returncode, json.loads(result.stdout)

    def test_posts_json_to_versioned_endpoint(self):
        status, payload = self.run_script("get-diary", body='{"limit":2}')
        self.assertEqual(status, 0)
        self.assertEqual(payload["meta"], META)
        self.assertEqual(self.requests, [("/api/agent/v1/get_diary", f"Bearer {self.token}", {"limit": 2})])

    def test_apostrophes_and_unicode_in_arguments(self):
        self.response = {"list": {"id": "fixture", "url": self.origin + "/watchlists/fixture",
                                  "item_count": 0}, "meta": META}
        body = {"name": "New Year's Visões", "visibility": "public", "idempotency_key": "fixture"}
        status, _ = self.run_script("create-watchlist", "--json", json.dumps(body, ensure_ascii=False))
        self.assertEqual(status, 0)
        self.assertEqual(self.requests[0][2], body)

    def test_invalid_arguments_fail_before_network(self):
        status, data = self.run_script("log-watch", body='{"title_id":"movie:123"}')
        self.assertEqual(status, 1)
        self.assertEqual(data["error"]["code"], "validation_error")
        self.assertEqual(self.requests, [])

    def test_missing_credentials_has_setup_link(self):
        del self.env["KINO_AGENT_TOKEN"]
        status, data = self.run_script("get-diary")
        self.assertEqual(status, 1)
        self.assertEqual(data["error"]["setup_url"], self.origin + "/settings/integrations")
        self.assertEqual(self.requests, [])

    def test_origin_is_verified_before_request(self):
        for origin in ("https://unrelated.example", f"{self.origin}/other", "http://kino.example",
                       "https://kino.example@unrelated.example", "//unrelated.example"):
            with self.subTest(origin=origin):
                self.env["KINO_AGENT_ORIGIN"] = origin
                status, data = self.run_script("get-diary")
                self.assertEqual(status, 1)
                self.assertEqual(data["error"]["code"], "invalid_origin")
        self.assertEqual(self.requests, [])

    def test_redirect_is_never_followed(self):
        self.status = 307
        self.redirect = self.origin + "/unexpected"
        status, data = self.run_script("get-diary")
        self.assertEqual(status, 1)
        self.assertEqual(data["error"]["code"], "invalid_response")
        self.assertEqual(len(self.requests), 1)

    def test_typed_http_errors_are_returned_and_redacted(self):
        self.status = 429
        self.response = {"error": {"code": "rate_limited", "message": self.token,
                                   "retryable": True, "retry_after": 20}, "meta": META}
        status, data = self.run_script("get-diary")
        self.assertEqual(status, 1)
        self.assertEqual(data["error"]["retry_after"], 20)
        self.assertEqual(data["error"]["message"], "[redacted]")

    def test_rejects_incomplete_success(self):
        self.response = {"meta": META}
        status, data = self.run_script("create-watchlist", body='{"name":"Test","visibility":"public","idempotency_key":"k"}')
        self.assertEqual(status, 1)
        self.assertEqual(data["error"]["code"], "invalid_response")

    def test_transport_failure_is_structured(self):
        self.server.shutdown()
        self.server.server_close()
        status, data = self.run_script("get-diary")
        self.assertEqual(status, 1)
        self.assertEqual(data["error"]["code"], "transport_error")
        self.assertTrue(data["error"]["retryable"])


if __name__ == "__main__":
    unittest.main()
