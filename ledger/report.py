"""지출 요약 리포트. 콘솔 출력이 기본, --kakao 옵션으로 '나에게 보내기' 발송.

사용:
  python report.py                # 오늘 요약
  python report.py --month        # 이번 달 요약
  python report.py --date 2026-08-31
  KAKAO_ACCESS_TOKEN=... python report.py --kakao   # 내 카톡으로 발송

카카오 발송에는 kakao developers 앱의 사용자 액세스 토큰이 필요하다
(talk_message 동의 항목 포함). 토큰 발급/갱신은 README 참고.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta

import db

KAKAO_MEMO_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send"


def build_summary(start: datetime, end: datetime, title: str) -> str:
    conn = db.connect()
    try:
        rows = db.fetch_between(conn, start, end)
    finally:
        conn.close()

    spent = sum(r["amount"] for r in rows if not r["canceled"])
    refunded = sum(r["amount"] for r in rows if r["canceled"])
    by_merchant: dict[str, int] = defaultdict(int)
    for r in rows:
        if not r["canceled"]:
            by_merchant[r["merchant"]] += r["amount"]

    lines = [f"💳 {title}", f"지출 {spent:,}원 ({len(rows)}건)"]
    if refunded:
        lines.append(f"취소/환불 {refunded:,}원")
    top = sorted(by_merchant.items(), key=lambda kv: kv[1], reverse=True)[:5]
    if top:
        lines.append("— 상위 지출 —")
        lines += [f"{name}: {amt:,}원" for name, amt in top]
    else:
        lines.append("기록된 지출이 없어요.")
    return "\n".join(lines)


def send_to_me(text: str) -> None:
    token = os.environ.get("KAKAO_ACCESS_TOKEN")
    if not token:
        sys.exit("KAKAO_ACCESS_TOKEN 환경변수가 필요합니다.")

    template = {
        "object_type": "text",
        "text": text,
        "link": {"web_url": "https://www.samsungcard.com"},
    }
    data = urllib.parse.urlencode({"template_object": json.dumps(template, ensure_ascii=False)}).encode()
    req = urllib.request.Request(
        KAKAO_MEMO_URL, data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as res:
        body = json.loads(res.read())
    if body.get("result_code") != 0:
        sys.exit(f"카카오 발송 실패: {body}")
    print("카카오톡 '나에게 보내기' 발송 완료")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="요약할 날짜 (YYYY-MM-DD, 기본: 오늘)")
    ap.add_argument("--month", action="store_true", help="해당 날짜가 속한 달 전체 요약")
    ap.add_argument("--kakao", action="store_true", help="카카오톡 나에게 보내기로 발송")
    args = ap.parse_args()

    base = datetime.strptime(args.date, "%Y-%m-%d") if args.date else datetime.now()
    if args.month:
        start = base.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=32)).replace(day=1)
        title = f"{start:%Y년 %m월} 지출 요약"
    else:
        start = base.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        title = f"{start:%m/%d} 지출 요약"

    summary = build_summary(start, end, title)
    print(summary)
    if args.kakao:
        send_to_me(summary)


if __name__ == "__main__":
    main()
