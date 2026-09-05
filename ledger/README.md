# 삼성카드 가계부 파이프라인

삼성카드 승인 알림(문자/앱 푸시)을 웹훅으로 받아 SQLite에 쌓고, 요약 리포트를 카카오톡으로 받아보는 개인 가계부.

```
[결제] → 승인/취소 알림 (카톡 알림톡, KB Pay 푸시)
           ├─ Macrodroid 자동 전달 → POST /ingest ─┐
           └─ 카카오톡 챗봇방에 붙여넣기 → POST /kakao ─┤→ ledger.db
[월 1회 보정] 카드사 홈페이지 엑셀 → excel_import.py ────┘
                          ↓                        ↓
        localhost:8288/dashboard        publish_static.py (매일 1회)
             (실시간 확인)            → 암호화된 index.html → GitHub Pages
                                          (가족이 폰으로 확인)
```

의존성: 파이썬 3.10+ 표준 라이브러리 위주. 엑셀 임포트는 `openpyxl`,
정적 발행은 `cryptography` 필요.

## 1. 서버 실행

```bash
cd ledger
LEDGER_TOKEN=아무비밀문자열 python server.py   # 기본 포트 8288
```

윈도우에서는 `token.txt`에 토큰을 넣고 **`start_all.bat`** 실행 —
서버와 cloudflared 터널을 한 번에 띄우고, 새로 발급된 터널 주소를
창에 크게 보여주며 `tunnel_url.txt`에도 기록한다.
부팅 시 자동 시작하려면 `Win+R` → `shell:startup` 폴더에 이 배치 파일의
바로가기를 넣는다. (서버만 띄우려면 `start_ledger.bat`)

임시 터널은 재시작마다 주소가 바뀌므로, 재부팅 후에는 Macrodroid의 URL을
새 주소로 바꿔야 한다. 이걸 자동화하려면 `start_all.bat PUBLISH` 로 실행한다:
바뀐 주소가 깃허브에 올라가고, 폰은 아래 주소에서 그 값을 읽어
자기 변수에 저장한 뒤 요청에 사용한다.

```
https://raw.githubusercontent.com/LOGISKIM/job-report/claude/samsung-card-usage-api-pzm0rk/ledger/tunnel_url.txt
```

단, 이 방식은 터널 주소가 공개 저장소에 노출된다(엔드포인트는 토큰으로
보호되지만 주소 자체는 누구나 볼 수 있다). 주소 고정이 목적이라면
아래 Tailscale 쪽이 더 깔끔하고 안전하다.

### 폰에서 접근할 고정 주소 (Tailscale)

폰의 Macrodroid가 서버로 POST하려면 고정 주소가 필요하다.
`cloudflared tunnel --url`(임시 터널)은 재시작마다 주소가 바뀌고,
Cloudflare 고정 터널은 자기 도메인이 있어야 하며,
ngrok 무료는 세션이 2시간 제한이라 상시 운영에 맞지 않는다.

[Tailscale](https://tailscale.com)은 무료(6명, 기기 무제한)이고 주소가 영구 고정이며,
공개 인터넷에 노출되지 않고 내 기기끼리만 연결된다.

1. PC와 폰에 Tailscale 설치 후 같은 계정으로 로그인
2. PC 호스트명 확인 (예: `desktop-abc123`)
3. Macrodroid HTTP 요청 URL을 `http://desktop-abc123:8288/ingest`로 설정
   (호스트명이 안 되면 Tailscale이 보여주는 `100.x.x.x` IP를 써도 된다)

이 구성에서는 cloudflared가 필요 없다.

| 엔드포인트 | 용도 |
|---|---|
| `POST /kakao` | 카카오 i 오픈빌더 스킬 웹훅 (챗봇방에 승인 문자 붙여넣기) |
| `POST /ingest` | Macrodroid/Tasker/단축어 범용 수신. `{"text": "..."}` 또는 원문 그대로 |
| `GET /health` | 헬스체크 |

`LEDGER_TOKEN`을 설정하면 `/ingest`는 `X-Ledger-Token` 헤더가 일치해야 받는다.

## 2. 수집 경로 설정 (하나만 해도 됨)

### A. 안드로이드 자동 수집 (추천 — 완전 자동)

Macrodroid 기준:

1. 트리거 2개 (OR 조건이라 하나만 걸려도 실행):
   - 알림 수신 → 앱 = 카카오톡/KB Pay 등 알림이 오는 앱, 텍스트에 `승인` 포함
   - 같은 조건에 텍스트 `취소` 포함 (취소 알림에는 '승인'이라는 단어가 없다)
2. 액션: **HTTP 요청** POST
   - URL: `http://<tailscale-호스트명>:8288/ingest`
   - 헤더: `X-Ledger-Token: 아무비밀문자열`
   - Body: 매직 텍스트로 알림 제목 + 알림 본문 (직접 타이핑 대신 `...` 버튼 사용)

결제하면 몇 초 안에 자동 기록된다.
배터리 최적화가 매크로를 재우지 않도록 설정 → 앱 → Macrodroid → 배터리 → 제한 없음.

### B. 카카오톡 챗봇방 (반자동)

1. [카카오톡 채널](https://center-pf.kakao.com) 개설 (무료)
2. [카카오 i 오픈빌더](https://i.kakao.com)에서 봇 생성 → 채널 연결
3. **폴백 블록** → 스킬 연결 → 스킬 URL 등록 (공개 URL 필요) → 배포
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
- `dashboard.py` — 대시보드 HTML 생성 (KPI, 일별/카테고리별/가맹점별, 전체 내역)
- `categories.py` — 가맹점명 키워드 기반 카테고리 분류
- `publish_static.py` — 대시보드를 암호화해 정적 페이지로 발행
- `tunnel.py` — cloudflared 터널 실행 + 발급 주소 기록/공개
- `start_all.bat` / `start_ledger.bat` / `publish_daily.bat` — 윈도우 실행 스크립트
