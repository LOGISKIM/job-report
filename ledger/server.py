"""가계부 웹훅 수신 서버 (표준 라이브러리 http.server 기반 — 의존성 0개).

엔드포인트:
  POST /kakao   카카오 i 오픈빌더 스킬(폴백 블록) 웹훅.
                userRequest.utterance의 승인 문자를 파싱해 저장하고
                오픈빌더 응답 포맷(simpleText)으로 결과를 돌려준다.
  POST /ingest  Macrodroid/Tasker/단축어 등 범용 수신.
                {"text": "...승인 문자 원문..."} 또는 raw body 텍스트를 받는다.
  GET  /health  헬스체크.

실행:
  python server.py            # 0.0.0.0:8288
  LEDGER_TOKEN=비밀값 python server.py   # /ingest에 X-Ledger-Token 헤더 요구

외부 공개는 cloudflared tunnel 등으로:
  cloudflared tunnel --url http://localhost:8288
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import db
from parser import parse_notification

PORT = int(os.environ.get("LEDGER_PORT", "8288"))
TOKEN = os.environ.get("LEDGER_TOKEN", "")


def handle_text(text: str, source: str) -> str:
    """승인 문자 한 건을 파싱·저장하고 사용자에게 보여줄 한 줄 응답을 만든다."""
    tx = parse_notification(text)
    if tx is None:
        return "인식 못 한 형식이에요. 승인 문자 원문을 그대로 보내주세요."

    conn = db.connect()
    try:
        added = db.insert(conn, tx, source=source)
    finally:
        conn.close()

    verb = "취소 기록" if tx.canceled else "기록 완료"
    if not added:
        return f"이미 기록된 건이에요: {tx.merchant} {tx.amount:,}원"
    return f"{verb} ✅ {tx.ts:%m/%d %H:%M} {tx.merchant} {tx.amount:,}원 {tx.installment}"


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    def do_GET(self) -> None:  # noqa: N802 (http.server 규약)
        if self.path == "/health":
            self._send_json(200, {"ok": True, "time": datetime.now().isoformat()})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/kakao":
            self._handle_kakao()
        elif self.path == "/ingest":
            self._handle_ingest()
        else:
            self._send_json(404, {"error": "not found"})

    def _handle_kakao(self) -> None:
        try:
            payload = json.loads(self._read_body())
            utterance = payload["userRequest"]["utterance"]
        except (json.JSONDecodeError, KeyError):
            self._send_json(400, {"error": "invalid openbuilder payload"})
            return

        message = handle_text(utterance, source="kakao")
        # 카카오 i 오픈빌더 스킬 응답 포맷
        self._send_json(200, {
            "version": "2.0",
            "template": {"outputs": [{"simpleText": {"text": message}}]},
        })

    def _handle_ingest(self) -> None:
        if TOKEN and self.headers.get("X-Ledger-Token") != TOKEN:
            self._send_json(401, {"error": "bad token"})
            return

        raw = self._read_body().decode("utf-8", errors="replace")
        text = raw
        try:
            data = json.loads(raw)
            if isinstance(data, dict) and "text" in data:
                text = str(data["text"])
        except json.JSONDecodeError:
            pass  # raw body를 문자 원문으로 취급

        message = handle_text(text, source="ingest")
        self._send_json(200, {"result": message})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{datetime.now():%H:%M:%S}] {self.address_string()} {fmt % args}")


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"ledger webhook server on :{PORT} (token={'on' if TOKEN else 'off'})")
    server.serve_forever()


if __name__ == "__main__":
    main()
