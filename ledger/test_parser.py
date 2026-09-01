"""parser.py 단위 테스트. 실행: python test_parser.py (또는 pytest)."""

from datetime import datetime

from parser import parse_notification

REF = datetime(2026, 9, 1, 12, 0)


def test_multiline_sms():
    text = "[Web발신]\n삼성카드승인\n홍*동님\n5,500원 일시불\n08/30 12:34\n스타벅스"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.amount == 5500
    assert tx.merchant == "스타벅스"
    assert tx.installment == "일시불"
    assert tx.ts == datetime(2026, 8, 30, 12, 34)
    assert not tx.canceled


def test_single_line_with_cumulative():
    text = "삼성카드(1234)승인 홍*동 12,000원 일시불 08/30 12:34 김밥천국 누적1,234,567원"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.amount == 12000
    assert tx.merchant == "김밥천국"


def test_cancel():
    text = "[Web발신]\n삼성카드승인취소\n홍*동님\n5,500원 일시불\n08/30 12:34\n스타벅스"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.canceled
    assert tx.amount == 5500


def test_installment_months():
    text = "삼성카드승인 홍*동 450,000원 3개월 08/15 19:02 하이마트"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.installment == "3개월"
    assert tx.merchant == "하이마트"
    assert tx.amount == 450000


def test_year_rollover():
    # 1월 초에 12/31 문자를 받으면 작년으로 해석해야 한다
    text = "삼성카드승인 홍*동 9,900원 일시불 12/31 23:50 GS25"
    tx = parse_notification(text, reference=datetime(2026, 1, 1, 0, 10))
    assert tx is not None
    assert tx.ts.year == 2025


def test_unparseable_returns_none():
    assert parse_notification("점심 뭐먹지", reference=REF) is None


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL {name}: {e}")
    raise SystemExit(1 if failures else 0)
