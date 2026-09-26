# 첫돌필름 MVP

아기 사진으로 돌 영상을 만들어 주는 서비스의 첫 버전입니다. 고객은 템플릿을 고르거나 원하는 스타일을 적어서 신청하고, 사진을 올리고 결제합니다. 운영자는 관리자 화면에서 사진을 확인해 Google Flow로 영상을 만든 뒤 완성본을 올립니다.

## 기술 구성

| 역할 | 사용 |
|---|---|
| 화면과 서버 | Next.js 16 (App Router) |
| 호스팅, 자동 삭제 예약 작업 | Vercel (+ Vercel Cron) |
| DB, 로그인, 파일 저장 | Supabase (서울 리전 권장) |
| 로그인 | 카카오 (Supabase Auth) |
| 결제 | 토스페이먼츠 결제위젯 |
| 알림 | 카카오 알림톡 (솔라피, 선택) |

## 화면

| 주소 | 내용 |
|---|---|
| `/` | 홈, 템플릿 목록, 진행 중 주문 배너 |
| `/templates/[id]` | 템플릿 상세, 장면 구성 |
| `/order/new?template=…` | 신청 (나만의 스타일 → 사진 → 문구·연락처 → 동의) |
| `/order/[id]/pay` | 결제 |
| `/orders`, `/orders/[id]` | 내 주문, 진행 상황, 완성 영상, 공유, 수정 요청, 사진 즉시 삭제 |
| `/s/[token]` | 가족 공유 영상 (로그인 없이, 만료일 있음) |
| `/admin` | 관리자: 주문 목록, 사진 확인, Flow 프롬프트, 상태 변경, 완성본 납품 |

## 개인정보와 보안 설계

- **브라우저는 DB에 쓸 수 없음:** 모든 쓰기는 서버에서 로그인 사용자와 주문 소유자를 확인한 뒤 비밀 키로만 합니다. 사용자는 RLS로 자기 주문만 읽을 수 있습니다.
- **비공개 저장소:** `photos`와 `results` 버킷은 비공개입니다. 업로드는 서버가 경로를 정해 발급한 1회용 URL로만 가능하고, 열람은 만료되는 링크로만 합니다.
- **촬영 위치 정보 제거:** 사진은 올리기 전에 브라우저에서 다시 그려 저장하므로 EXIF(GPS 등)가 지워집니다. 긴 변은 2048px로 줄입니다.
- **결제 금액 검증:** 가격은 서버의 `src/lib/catalog.ts` 기준입니다. 결제 승인도 서버에서 하고, DB 금액과 토스 응답 금액을 모두 비교합니다.
- **자동 삭제:** 매일 03:00(KST)에 실행됩니다. 원본 사진은 납품 7일 뒤, 영상과 휴대폰 번호는 30일 뒤, 결제하지 않은 주문은 하루 뒤 삭제됩니다.
- **관리자:** 관리자가 아니면 `/admin`은 404로 응답합니다. 관리자가 사진을 볼 때마다 `admin_audit`에 기록이 남습니다.
- **공유 링크:** 192비트 무작위 토큰을 쓰고, 최대 7일 뒤 만료됩니다. 고객이 언제든 끌 수 있습니다.
- **보안 헤더:** HSTS, X-Frame-Options, Referrer-Policy 등을 적용했습니다.

## 설정 순서

### 1. Supabase
1. [supabase.com](https://supabase.com)에서 프로젝트를 만듭니다. 리전은 **Northeast Asia (Seoul)** 로 합니다.
2. SQL Editor에서 `supabase/migrations/0001_init.sql` 내용을 실행합니다.
3. Authentication → Sign In / Providers → **Kakao**를 켭니다. 카카오 개발자센터에서 만든 REST API 키와 Client Secret을 넣습니다.
4. Authentication → URL Configuration에 사이트 주소를 넣고, Redirect URL에 `https://내도메인/auth/callback`을 추가합니다.
5. 처음 로그인한 뒤, 내 계정을 관리자로 만듭니다.
   ```sql
   update public.profiles set is_admin = true where id = '내-user-id';
   ```
6. 관리자 계정은 **카카오 계정 2단계 인증**을 꼭 켭니다.

> Supabase 무료 플랜은 파일 하나가 최대 50MB입니다. 3분 1080p 영상은 약 2Mbps로 인코딩하면 50MB 안에 들어갑니다. 더 큰 파일은 Pro 플랜이 필요합니다.

### 2. 카카오 개발자센터
- 애플리케이션을 만들고 카카오 로그인을 켭니다.
- Redirect URI에 `https://<supabase-project>.supabase.co/auth/v1/callback`을 넣습니다.
- 동의항목은 **닉네임만** 받습니다 (최소 수집).

### 3. 토스페이먼츠
- 개발자센터에서 **결제위젯** 테스트 키(`test_gck_…`, `test_gsk_…`)를 받습니다.
- 실제 판매 전에 사업자 계약을 하고 라이브 키로 바꿉니다.

### 4. 환경변수와 실행
```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

### 5. 배포 (Vercel)
- GitHub 저장소를 Vercel에 연결하고, Root Directory를 `dol-film`으로 설정합니다.
- `.env.example`의 값을 Vercel 환경변수에 넣습니다. `CRON_SECRET`은 긴 무작위 문자열로 만듭니다.
- `vercel.json`의 Cron이 매일 자동 삭제를 실행합니다.

### 6. 알림톡 (선택)
- 카카오 비즈니스 채널을 만들고 솔라피에 연결합니다.
- "결제 완료", "영상 완성" 템플릿을 승인받습니다. 변수는 `#{애칭}`과 `#{스타일}`입니다.
- 승인받은 템플릿 ID를 `SOLAPI_*` 환경변수에 넣습니다. 비워 두면 알림을 보내지 않습니다.

## 출시 전에 할 일

- [ ] 홈 하단 사업자 정보 채우기 (`src/app/page.tsx`)
- [ ] 개인정보처리방침과 이용약관 확정 (`/privacy`, `/terms`), 가능하면 전문가 검토
- [ ] 템플릿 샘플 영상 만들어 넣기 (지금은 그라데이션 포스터)
- [ ] 토스페이먼츠 라이브 키로 교체
- [ ] Flow에서 아기 사진이 들어간 영상 생성이 막히지 않는지 실제로 확인
- [ ] 테스트 결제 → 관리자 납품 → 공유 → 수정 요청 → 사진 삭제까지 한 바퀴 돌려 보기

## 개발 명령

```bash
npm run dev     # 개발 서버
npm run lint    # 코드 검사
npm run build   # 배포용 빌드 (타입 검사 포함)
```
