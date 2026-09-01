"""삼성카드 승인 알림(SMS/앱 푸시) 텍스트 파서.

지원 형식 예:
    [Web발신]
    삼성카드승인
    홍*동님
    5,500원 일시불
    08/30 12:34
    스타벅스

    삼성카드(1234)승인 홍*동 12,000원 일시불 08/30 12:34 김밥천국 누적1,234,567원

승인취소 문자는 canceled=True, 금액은 양수 그대로 둔다.
연도가 없는 MM/DD 형식은 기준일(reference) 기준으로 미래가 되지 않는 가장 가까운 연도를 붙인다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

AMOUNT_RE = re.compile(r"(?P<sign>-?)\s*(?P<amount>\d{1,3}(?:,\d{3})*|\d+)\s*원")
DATETIME_RE = re.compile(r"(?P<mm>\d{2})/(?P<dd>\d{2})\s+(?P<hh>\d{2}):(?P<mi>\d{2})")
INSTALLMENT_RE = re.compile(r"(일시불|\d+\s*개월)")
CANCEL_RE = re.compile(r"취소")
# 파싱에서 제외할 라인(안내 문구, 발신 표시, 카드사명, 누적 금액 등)
NOISE_RE = re.compile(r"Web발신|삼성카드|국민카드|KB\s?Pay|승인|취소|누적|님$|^\[.*\]$", re.IGNORECASE)
# 가맹점명 뒤에 붙는 결제 문구 (라인 전체가 아니라 해당 문구만 제거)
PAY_PHRASE_RE = re.compile(r"결제\s*완료|결제\s*되었습니다|정상\s*승인|해외\s*승인|출금")


@dataclass
class Transaction:
    ts: datetime
    merchant: str
    amount: int
    installment: str = "일시불"
    canceled: bool = False
    raw: str = field(default="", repr=False)

    def key(self) -> tuple:
        """중복 판정용 키 (같은 시각·가맹점·금액·취소여부는 동일 건으로 본다)."""
        return (self.ts.isoformat(), self.merchant, self.amount, self.canceled)


def _resolve_year(mm: int, dd: int, hh: int, mi: int, reference: datetime) -> datetime:
    """연도 없는 MM/DD를 기준일보다 미래가 되지 않는 가장 가까운 연도로 해석한다."""
    for year in (reference.year, reference.year - 1):
        try:
            candidate = datetime(year, mm, dd, hh, mi)
        except ValueError:
            continue
        if candidate <= reference:
            return candidate
    # 둘 다 미래(연초에 12/31 문자 등 경계)면 작년으로 강제
    return datetime(reference.year - 1, mm, dd, hh, mi)


def parse_notification(text: str, reference: Optional[datetime] = None) -> Optional[Transaction]:
    """승인 알림 텍스트 한 건을 Transaction으로 변환. 파싱 불가면 None."""
    reference = reference or datetime.now()

    amount_m = AMOUNT_RE.search(text)
    if not amount_m:
        return None

    dt_m = DATETIME_RE.search(text)
    if dt_m:
        ts = _resolve_year(
            int(dt_m.group("mm")), int(dt_m.group("dd")),
            int(dt_m.group("hh")), int(dt_m.group("mi")),
            reference,
        )
    elif re.search(r"승인|취소|결제|출금|사용", text):
        # KB Pay 등 날짜 없는 짧은 알림: 수신 시각으로 기록
        ts = reference.replace(second=0, microsecond=0)
    else:
        return None

    amount = int(amount_m.group("amount").replace(",", ""))

    installment_m = INSTALLMENT_RE.search(text)
    installment = installment_m.group(1).replace(" ", "") if installment_m else "일시불"
    # '취소' 문구 또는 음수 금액(-3,580원) 둘 중 하나면 취소 건으로 본다
    canceled = bool(CANCEL_RE.search(text)) or amount_m.group("sign") == "-"

    merchant = _extract_merchant(text, amount_m, dt_m)
    if not merchant:
        merchant = "(가맹점 미상)"

    return Transaction(
        ts=ts,
        merchant=merchant,
        amount=amount,
        installment=installment,
        canceled=canceled,
        raw=text.strip(),
    )


def _extract_merchant(text: str, amount_m: re.Match, dt_m: re.Match | None) -> str:
    """금액/일시/안내 문구를 걷어내고 남는 텍스트에서 가맹점명을 고른다."""
    # 날짜·금액 매치 구간과 노이즈를 지운 뒤 남은 토큰 중 가장 그럴듯한 것을 선택
    cleaned = text
    matches = [m for m in (amount_m, dt_m) if m]
    for m in sorted(matches, key=lambda x: x.start(), reverse=True):
        cleaned = cleaned[: m.start()] + "\n" + cleaned[m.end():]
    cleaned = INSTALLMENT_RE.sub("\n", cleaned)
    cleaned = PAY_PHRASE_RE.sub("\n", cleaned)
    cleaned = re.sub(r"누적\s*[\d,]+\s*원?", "\n", cleaned)

    candidates = []
    for line in re.split(r"[\n\r]+", cleaned):
        token = line.strip()
        # 토큰 전체를 감싼 괄호만 벗긴다 ('쿠팡(쿠페이)'처럼 이름 일부인 괄호는 유지)
        if len(token) >= 2 and token[0] in "[(" and token[-1] in "])":
            token = token[1:-1].strip()
        if not token or NOISE_RE.search(token):
            continue
        candidates.append(token)

    if not candidates:
        return ""
    # 여러 후보가 남으면 날짜 매치 이후(대개 마지막)에 등장한 것을 우선
    return candidates[-1]
