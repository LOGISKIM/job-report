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


def test_cancel_with_negative_amount():
    # 취소 알림이 음수 금액으로 오는 형식
    text = "삼성9238승인취소 김*민\n-3,580원 일시불\n08/31 17:40 이마트에브리데이"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.canceled
    assert tx.amount == 3580  # 저장은 양수, 합계에서 음수로 차감
    assert tx.merchant == "이마트에브리데이"


def test_cancel_without_word_seungin():
    # 실제 카톡 취소 알림: '승인'이 '취소'로 바뀌어 와서 '승인'이란 단어가 없음
    text = "삼성9238취소 김*민\n-3,580원 일시불\n08/31 17:40 이마트에브리데이"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.canceled
    assert tx.amount == 3580
    assert tx.merchant == "이마트에브리데이"


def test_negative_amount_alone_means_cancel():
    # '취소' 단어 없이 음수 금액만 와도 취소로 처리
    text = "삼성9238승인 김*민\n-12,000원 일시불\n08/31 17:40 쿠팡"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.canceled


def test_categories():
    from categories import classify
    assert classify("스타벅스") == "카페/간식"
    assert classify("GS25 역삼점") == "편의점"
    assert classify("이마트24") == "편의점"       # 이마트(마트)보다 먼저 매치
    assert classify("이마트에브리데이") == "마트/생활"
    assert classify("배달의민족") == "식비"
    assert classify("처음보는가게") == "기타"


def test_kbpay_short_format_without_datetime():
    # KB Pay처럼 날짜/시간 없이 오는 짧은 푸시: 수신 시각으로 기록
    text = "KB Pay\n스타벅스 5,500원 결제 완료"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.amount == 5500
    assert tx.merchant == "스타벅스"
    assert tx.ts == REF  # 수신 시각
    assert not tx.canceled


def test_kb_real_cancel_format():
    # 사용자 실제 KB국민카드 취소 알림 형식 (가맹점명에 괄호 포함)
    text = "KB국민카드1068취소\n김*민님\n13,040원 일시불\n09/01 21:23\n쿠팡(쿠페이)\n누적489,977원"
    tx = parse_notification(text, reference=datetime(2026, 9, 1, 22, 0))
    assert tx is not None
    assert tx.canceled
    assert tx.amount == 13040
    assert tx.merchant == "쿠팡(쿠페이)"
    assert tx.ts == datetime(2026, 9, 1, 21, 23)


def test_kb_sms_format():
    text = "[Web발신]\nKB국민카드1234승인\n김*민\n12,000원 일시불\n08/30 12:34\n김밥천국"
    tx = parse_notification(text, reference=REF)
    assert tx is not None
    assert tx.merchant == "김밥천국"
    assert tx.amount == 12000


def test_unparseable_returns_none():
    assert parse_notification("점심 뭐먹지", reference=REF) is None
    # 금액이 있어도 결제 관련 단어와 날짜가 모두 없으면 버린다
    assert parse_notification("5000원만 빌려줘", reference=REF) is None


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
