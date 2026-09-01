# 삼성카드 가계부 파이프라인

삼성카드 승인 알림(문자/앱 푸시)을 웹훅으로 받아 SQLite에 쌓고, 요약 리포트를 카카오톡으로 받아보는 개인 가계부.

```
[결제] → 승인 문자/푸시
           ├─ Macrodroid/Tasker 자동 전달 → POST /ingest ─┐
           └─ 카카오톡 내 챗봇방에 붙여넣기 → POST /kakao ─┤→ ledger.db
[월 1회 보정] 삼성카드 홈페이지 엑셀 → excel_import.py ───┘
                                        ↓
                     report.py → 콘솔 / 카카오톡 "나에게 보내기"
```

의존성: 파이썬 3.10+ 표준 라이브러리만 사용. 엑셀 임포트만 `pip install openpyxl` 필요.

## 1. 서버 실행

```bash
cd ledger
LEDGER_TOKEN=아무비밀문자열 python server.py   # 기본 포트 8288
```

외부에서 접근할 공개 URL이 필요하면 (무료):

```bash
cloudflared tunnel --url http://localhost:8288
# → https://xxxx.trycloudflare.com 발급됨
```

| 엔드포인트 | 용도 |
|---|---|
| `POST /kakao` | 카카오 i 오픈빌더 스킬 웹훅 (챗봇방에 승인 문자 붙여넣기) |
| `POST /ingest` | Macrodroid/Tasker/단축어 범용 수신. `{"text": "..."}` 또는 원문 그대로 |
| `GET /health` | 헬스체크 |

`LEDGER_TOKEN`을 설정하면 `/ingest`는 `X-Ledger-Token` 헤더가 일치해야 받는다.

## 2. 수집 경로 설정 (하나만 해도 됨)

### A. 안드로이드 자동 수집 (추천 — 완전 자동)

Macrodroid 기준:

1. 트리거: **알림 수신** → 앱 = 삼성카드(또는 메시지 앱), 텍스트에 "승인" 포함
2. 액션: **HTTP 요청** POST
   - URL: `https://xxxx.trycloudflare.com/ingest`
   - 헤더: `X-Ledger-Token: 아무비밀문자열`
   - Content-Type: `application/json`
   - Body: `{"text": "[notification]"}` (알림 본문 매직 변수)

결제하면 몇 초 안에 자동 기록된다.

### B. 카카오톡 챗봇방 (반자동)

1. [카카오톡 채널](https://center-pf.kakao.com) 개설 (무료)
2. [카카오 i 오픈빌더](https://i.kakao.com)에서 봇 생성 → 채널 연결
3. **폴백 블록** → 스킬 연결 → 스킬 URL에 `https://xxxx.trycloudflare.com/kakao` 등록 → 배포
4. 승인 문자가 오면 챗봇방에 복사-붙여넣기 → "기록 완료 ✅" 응답 확인

### C. 엑셀 보정 (월 1회 — 자동 수집이 놓친 건 잡기)

삼성카드 홈페이지 → 이용내역 조회 → 엑셀 다운로드 후:

```bash
pip install openpyxl
python excel_import.py 이용내역.xlsx
```

중복은 (일시, 가맹점, 금액) 기준으로 자동 스킵되므로 그냥 통째로 넣으면 된다.
컬럼명이 달라 헤더를 못 찾으면 `excel_import.py`의 `KEYWORDS`를 파일에 맞게 수정.

## 3. 리포트

```bash
python report.py                  # 오늘 요약
python report.py --month          # 이번 달 요약
python report.py --month --kakao  # 내 카톡으로 발송
```

카카오 발송은 [kakao developers](https://developers.kakao.com)에서 앱을 만들고
**카카오톡 메시지 > 나에게 보내기**(talk_message) 동의를 받은 사용자 액세스 토큰이 필요:

```bash
export KAKAO_ACCESS_TOKEN=발급받은_토큰
```

액세스 토큰은 몇 시간이면 만료되므로 상시 운용하려면 리프레시 토큰으로 갱신하는 크론을 함께 두는 것이 좋다.

매일 밤 자동 발송하려면:

```cron
55 23 * * * cd /path/to/ledger && KAKAO_ACCESS_TOKEN=... python report.py --kakao
```

## 테스트

```bash
python test_parser.py   # 또는 pytest
```

## 파일 구성

- `parser.py` — 삼성카드 승인 문자/푸시 텍스트 파서 (금액·일시·가맹점·할부·취소)
- `db.py` — SQLite 저장 (중복 자동 스킵)
- `server.py` — 웹훅 서버 (`/kakao`, `/ingest`)
- `excel_import.py` — 홈페이지 엑셀 임포트
- `report.py` — 일간/월간 요약 + 카카오톡 나에게 보내기
