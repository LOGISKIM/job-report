# 첫돌필름 MVP

아기 사진으로 돌 영상을 만들어 주는 서비스의 첫 버전입니다. 고객은 템플릿을 고르거나 원하는 스타일을 적어서 신청하고, 사진을 올리고 결제합니다. 운영자는 관리자 화면에서 사진을 확인해 Google Flow로 영상을 만든 뒤 완성본을 올립니다.

## 기술 구성

| 역할 | 사용 |
|---|---|
| 화면과 서버 | Next.js 16 (App Router) |
| 호스팅, 자동 삭제 예약 작업 | Vercel (+ Vercel Cron) |
| DB, 로그인 | Supabase (서울 리전 권장, 무료 플랜으로 시작) |
| 사진·영상·DB 백업 | Google Cloud Storage (서울, Google AI Pro 구독의 월 $10 Cloud 크레딧 안에서) |
| 로그인 | 카카오 (Supabase Auth) |
| 결제 | 토스페이먼츠 결제위젯 |
| 알림 | 카카오 알림톡 (솔라피, 선택) |
| 글꼴 | Pretendard (SIL OFL, 화면에 쓰인 글자 조각만 내려받는 dynamic subset) |

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
- **비공개 저장소:** Google Cloud Storage 버킷은 공개 접근이 원천 차단돼 있습니다. 업로드는 서버가 경로, 형식, 최대 크기를 정해 발급한 15분짜리 권한으로만 가능하고(사진 JPEG 10MB, 영상 MP4 1GB), 열람은 만료되는 링크로만 합니다.
- **백업:** 매일 DB를 JSON으로 버킷에 저장하고, 14일 뒤 자동 삭제합니다. 버킷 수명 규칙이 사진 45일, 영상 60일이 지나면 한 번 더 지우는 안전장치 역할을 합니다.
- **촬영 위치 정보 제거:** 사진은 올리기 전에 브라우저에서 다시 그려 저장하므로 EXIF(GPS 등)가 지워집니다. 긴 변은 2048px로 줄입니다.
- **결제 금액 검증:** 가격은 서버의 `src/lib/catalog.ts` 기준입니다. 결제 승인도 서버에서 하고, DB 금액과 토스 응답 금액을 모두 비교합니다.
- **자동 삭제:** 매일 03:00(KST)에 실행됩니다. 원본 사진은 납품 7일 뒤, 영상과 휴대폰 번호는 30일 뒤, 결제하지 않은 주문은 이틀 뒤 삭제됩니다. 결제 후 30일이 지나도록 납품하지 않은 주문은 로그로 경고합니다.
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

### 1-1. Google Cloud Storage (파일 보관)
Google AI Pro 구독에 포함된 월 $10 Cloud 크레딧으로 운영합니다.
1. [console.cloud.google.com](https://console.cloud.google.com)에서 프로젝트를 만들고, 결제(Billing) → 크레딧에서 AI Pro 크레딧이 적용됐는지 확인합니다.
2. **결제 → 예산 및 알림**에서 월 $10 예산을 만들고 50%/90%/100% 알림을 켭니다 (크레딧을 넘으면 카드로 청구되므로).
3. Cloud Storage → 버킷 만들기
   - 이름: 예) `dolfilm-files` (전 세계에서 유일해야 함)
   - 위치: **Region → asia-northeast3 (서울)**
   - 스토리지 클래스: Standard
   - **공개 액세스 방지 적용**, 액세스 제어는 **균일(Uniform)**
4. IAM → 서비스 계정 만들기 (예: `dolfilm-storage`). 역할은 주지 말고 만든 뒤, **버킷의 권한 탭에서 이 계정에만 "스토리지 객체 관리자"** 를 줍니다 (다른 버킷은 못 건드리게).
5. 서비스 계정 → 키 → JSON 키 만들기. 받은 파일을 `base64 -w0 key.json` 으로 바꿔 `GCP_SERVICE_ACCOUNT_KEY`에 넣고, **원본 JSON 파일은 지웁니다**.
   (조직 정책 때문에 키 생성이 막혀 있으면 IAM → 조직 정책에서 `iam.disableServiceAccountKeyCreation`을 이 프로젝트만 해제합니다.)
6. 버킷 보안 설정(공개 차단, CORS, 자동 삭제 안전장치)을 한 번에 적용합니다.
   ```bash
   GCS_BUCKET=dolfilm-files GCP_SERVICE_ACCOUNT_KEY=... node scripts/setup-gcs.mjs https://내도메인
   ```

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
- `.env.example`의 값을 Vercel 환경변수에 넣습니다 (Google Cloud 값 2개 포함). `CRON_SECRET`은 긴 무작위 문자열로 만듭니다.
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
