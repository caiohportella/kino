#!/usr/bin/env python3
"""Kino Agent API client. Run as a temporary, self-contained Python 3 script."""
import argparse
import hashlib
from http.client import HTTPException
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

DEFAULT_ORIGIN = "https://kino.vercel.app"
TOKEN = re.compile(r"kino_v1_([a-f0-9]{24})_[A-Za-z0-9_-]{43}\Z")
KEY = re.compile(r"[A-Za-z0-9._:-]{1,128}\Z")
MAX_REQUEST = 8192
MAX_RESPONSE = 2_000_000
OPERATIONS = {
    "search-titles": ({"query"}, {"candidates": list, "ambiguous": bool}),
    "find-watchlist": (set(), {"matches": list}),
    "add-to-watchlist": ({"list_id", "title_id", "idempotency_key"}, {"status": str, "title": dict, "list": dict}),
    "create-watchlist": ({"name", "visibility", "idempotency_key"}, {"list": dict}),
    "log-watch": ({"title_id", "idempotency_key"}, {"entry": dict}),
    "mark-episodes": ({"series_id", "selector", "idempotency_key"}, {"series": dict, "resolved_episodes": list, "progress": dict}),
    "get-diary": (set(), {"entries": list, "total": int}),
    "get-taste-profile": (set(), {"top_rated": list, "recent": list, "counts": dict}),
    "get-candidates": (set(), {"candidates": list}),
}


class ClientError(Exception):
    def __init__(self, code, message, retryable=False, **fields):
        self.payload = {"error": {"code": code, "message": message,
                                  "candidates": [], "retryable": retryable, **fields}, "meta": {}}
        super().__init__(message)


class Parser(argparse.ArgumentParser):
    def error(self, _message):
        raise ClientError("validation_error", "Provide a command and one JSON object via --json or stdin.")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def configured_origin(env):
    value = env.get("KINO_AGENT_ORIGIN", DEFAULT_ORIGIN)
    try:
        url = urlsplit(value)
        host = url.hostname
        port = url.port
    except ValueError:
        host = None
    if (not host or not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", host)
            or url.username is not None or url.password is not None
            or url.path not in ("", "/") or url.query or url.fragment
            or any(char.isspace() for char in value)):
        raise ClientError("invalid_origin", "Set KINO_AGENT_ORIGIN to your trusted Kino deployment origin.")
    local = host == "localhost" and env.get("KINO_AGENT_ALLOW_LOCAL_HTTP") == "1"
    if url.scheme != "https" and not (local and url.scheme == "http"):
        raise ClientError("invalid_origin", "Kino requires HTTPS for agent connections.")
    default_port = 443 if url.scheme == "https" else 80
    suffix = f":{port}" if port and port != default_port else ""
    origin = f"{url.scheme}://{host}{suffix}"
    if value.rstrip("/") != origin:
        raise ClientError("invalid_origin", "Use the exact origin shown in Kino integration settings.")
    return origin


def parse_input(argv):
    parser = Parser(description=__doc__)
    parser.add_argument("operation", choices=list(OPERATIONS))
    parser.add_argument("--json", dest="body")
    args = parser.parse_args(argv)
    try:
        raw = args.body if args.body is not None else sys.stdin.read(MAX_REQUEST + 1)
        if len(raw.encode("utf-8")) > MAX_REQUEST:
            raise ValueError()
        body = json.loads(raw or "{}")
        required = OPERATIONS[args.operation][0]
        if not isinstance(body, dict) or not required.issubset(body):
            raise ValueError()
        for name in required - {"selector"}:
            if not isinstance(body[name], str) or not body[name].strip():
                raise ValueError()
        if "selector" in required and not isinstance(body["selector"], dict):
            raise ValueError()
        if "idempotency_key" in required and not KEY.fullmatch(body["idempotency_key"]):
            raise ValueError()
        encoded = json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        if len(encoded) > MAX_REQUEST:
            raise ValueError()
    except (ValueError, UnicodeError, RecursionError):
        raise ClientError("validation_error", "Provide the documented operation parameters as JSON.") from None
    return args.operation, encoded


def reference(value):
    return (isinstance(value, dict) and isinstance(value.get("id"), str)
            and isinstance(value.get("url"), str))


def verify_response(operation, response, status):
    if not isinstance(response, dict) or not isinstance(response.get("meta"), dict):
        return False
    meta = response["meta"]
    if not isinstance(meta.get("request_id"), str):
        return False
    if 400 <= status <= 599:
        error = response.get("error")
        return (isinstance(error, dict) and isinstance(error.get("code"), str)
                and isinstance(error.get("message"), str) and isinstance(error.get("retryable"), bool))
    if status != 200 or "error" in response:
        return False
    user = meta.get("user")
    if (not isinstance(user, dict) or not all(isinstance(user.get(k), str) for k in ("locale", "timezone", "region"))
            or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(meta.get("today", "")))
            or not isinstance(meta.get("attribution"), str)):
        return False
    if not all(isinstance(response.get(key), kind) for key, kind in OPERATIONS[operation][1].items()):
        return False
    if operation in {"create-watchlist", "add-to-watchlist"}:
        watchlist = response["list"]
        if (not reference(watchlist) or type(watchlist.get("item_count")) is not int
                or watchlist["item_count"] < 0):
            return False
        if operation == "add-to-watchlist":
            return response["status"] in {"added", "already_present"} and reference(response["title"])
    if operation == "log-watch":
        entry = response["entry"]
        return (isinstance(entry.get("id"), str) and reference(entry.get("title"))
                and isinstance(entry.get("watched_on"), str))
    if operation == "mark-episodes":
        return (reference(response["series"]) and bool(response["resolved_episodes"])
                and isinstance(response.get("watched_on"), str))
    if operation == "search-titles":
        if not all(reference(candidate) for candidate in response["candidates"]):
            return False
        best = response.get("best_match_id")
        return best is None if response["ambiguous"] else any(
            candidate["id"] == best for candidate in response["candidates"])
    return True


def decode_response(response, operation, status):
    try:
        if response.headers.get_content_type() != "application/json":
            raise ValueError()
        raw = response.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            raise ValueError()
        payload = json.loads(raw)
        json.dumps(payload, allow_nan=False)
        if not verify_response(operation, payload, status):
            raise ValueError()
        return payload
    except (ValueError, UnicodeError, RecursionError, HTTPException, OSError):
        raise ClientError("invalid_response", "Kino returned an unverifiable response. Reuse the original key to check a write.",
                          retryable=True) from None


def execute(operation, body, env):
    origin = configured_origin(env)
    token = env.get("KINO_AGENT_TOKEN", "")
    setup_url = origin + "/settings/integrations"
    match = TOKEN.fullmatch(token)
    if not match:
        raise ClientError("unauthorized", "Set the Kino integration token in your host's secret settings.",
                          setup_url=setup_url)
    if match[1] != hashlib.sha256(origin.encode("ascii")).hexdigest()[:24]:
        raise ClientError("invalid_origin", "The configured origin does not match the token's issuing deployment.",
                          setup_url=setup_url)

    url = f"{origin}/api/agent/v1/{operation.replace('-', '_')}"
    request = Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json",
    })
    opener = build_opener(ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=60) as response:
            return decode_response(response, operation, response.status), 0
    except HTTPError as error:
        with error:
            payload = decode_response(error, operation, error.code)
        if error.code == 401:
            payload["error"]["setup_url"] = setup_url
        return payload, 1
    except (URLError, HTTPException, OSError):
        raise ClientError("transport_error", "Kino could not be reached. Reuse the original key if retrying a write.",
                          retryable=True) from None


def main(argv=None):
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        operation, body = parse_input(argv)
        payload, status = execute(operation, body, os.environ)
    except ClientError as error:
        payload, status = error.payload, 1
    token = os.environ.get("KINO_AGENT_TOKEN", "")
    output = json.dumps(payload, ensure_ascii=False)
    if TOKEN.fullmatch(token):
        output = output.replace(token, "[redacted]")
    print(output)
    return status


if __name__ == "__main__":
    sys.exit(main())
