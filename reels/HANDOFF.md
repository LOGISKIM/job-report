# 다음 세션에 넘길 것 — 릴스 B 내레이션(타입캐스트)

작성 2026-09-19 · 브랜치 `claude/instagram-reels-strategy-903350` (저장소 `logiskim/job-report`)

---

## 한 줄

**영상은 다 만들었고, 타입캐스트 키만 넣으면 목소리가 붙어요.** 클라우드 세션에는 키가 없어서 거기까지만 했어요.

---

## 지금 상태

| 파일 | 무엇 | 쓸 수 있나 |
|---|---|---|
| `reels/reel_B2_budget_scroll.mp4` | **소리 없는 완성본 (20.8초)** | 지금 바로 올려도 돼요 (인스타 음악만 얹으면 됨) |
| `reels/reel_B2_voice_preview.mp4` | 내레이션 붙은 미리듣기 (22.3초) | **올리지 마세요** — 목소리가 edge-tts 대체본이에요. 타이밍 확인용 |
| `reels/render_b2_voice.py` | 내레이션 판을 굽는 스크립트 | 키 넣고 PC에서 돌리면 됨 |
| `reels/assets_b2/` | 화면(사이트 캡처·자막·카드) + `manifest.json`(대본) | 크롬·사이트 없이 ffmpeg만으로 돌아요 |
| `reels/reel_B_budget5eok_caption.txt` | 발행용 캡션 | 그대로 쓰면 돼요 |

---

## 왜 클라우드에서 못 했나

`tts.py`가 읽는 환경변수 두 개가 클라우드 세션에 없어요. 키는 PC 환경변수에만 두고 저장소에는 안 넣는 게 맞으니, 이건 고장이 아니라 원래 그런 거예요.

```
TYPECAST_API_KEY     ← studio.typecast.ai/developers/api 에서 발급
TYPECAST_VOICE_ID    ← 같은 곳 /voices 에서 고른 tc_… 로 시작하는 값
```

---

## PC에서 할 일

### 1. 키가 살아 있는지 · 크레딧이 남았는지 먼저 봐요

```bat
python -c "import os,json,urllib.request as u; r=u.urlopen(u.Request('https://api.typecast.ai/v1/users/me/subscription', headers={'X-API-KEY': os.environ['TYPECAST_API_KEY']})); d=json.load(r); c=d['credits']; print(f\"플랜 {d['plan']} · 총 {c['plan_credits']:,} · 사용 {c['used_credits']:,} · 남음 {c['plan_credits']-c['used_credits']:,}\")"
```

- **API 요금제와 스튜디오(웹) 요금제는 별개예요.** 웹에서 결제했어도 여기 `plan`이 `free`로 나오면 API는 그대로 무료 15,000 크레딧이에요.
- 1크레딧 = 1글자. **이 릴스 대본은 156자 = 156크레딧**이에요. 무료 15,000이면 95편, Lite(200,000)면 1,273편 분량이에요.
- 예전 Starter 키는 403이 나요. 그러면 새로 발급받아야 해요.

### 2. 목소리를 붙여 다시 구워요

```bat
git pull
cd reels
set PYTHONIOENCODING=utf-8
set SUDO_ZIP_DIR=C:\Users\tnals\OneDrive\바탕 화면\클로드
python render_b2_voice.py
```

→ `reels/out/reel_B2_voice.mp4`

- `tts.py`를 그대로 불러 쓰니까 **쓰던 설정 그대로** 나와요 — ssfm-v30 · 감정 toneup 0.7 · 템포 1.1 · 피치 +1 · −14 LUFS.
- 키가 없거나 크레딧이 떨어지면 조용히 edge-tts로 내려가요. 어느 쪽으로 갔는지 실행 중에 `소리: typecast` / `소리: edge`로 찍혀요.
- `--edge` 를 붙이면 키가 있어도 edge로 돌아요(크레딧 안 씀). `--say` 는 읽을 말만 보여주고 끝나요.

### 3. 올려요 — **볼륨을 뒤집어야 해요**

```bat
python -c "import io,publish_story as ps; ps.publish_reel(r'reels\out\reel_B2_voice.mp4', io.open(r'reels\reel_B_budget5eok_caption.txt',encoding='utf-8').read(), audio_id='1574238607820475', audio_volume=10, video_volume=100)"
```

기본값은 소리 없는 표 릴스용이라 반대로(곡 100, 영상 0) 잡혀 있어요. 내레이션이 있으면 **영상 100, 곡 10** 으로 줘야 말이 살아요. 먼저 `--dry`로 확인하고 올리는 게 안전해요.

올린 직후 **고정 댓글**을 꼭 달아주세요. 이게 없으면 이 릴스의 CTA가 작동하지 않아요.

> 댓글에 '코드'라고 남겨 주시면 DM으로 입장코드 보내드려요 💬 (팔로워만)

발행 시각은 **16~19시**를 권해요. 1천 회 넘긴 8편이 전부 그 시간대였어요.

---

## 대본 (해요체, 156자)

| # | 읽는 말 | 화면 자막 |
|---|---|---|
| 1 | 아직도 오억으로 서울에서 국민평형을 살 수 있을까요? | (썸네일) 아직도 5억으로 서울에 84㎡를 살 수 있다고? |
| 2 | 예산에 오억만 넣으면 | 예산에 **5억**만 넣으면 |
| 3 | 수도권 백팔십육 곳이 바로 나와요. | 수도권 **186곳**이 바로 나와요 |
| 4 | 그런데 서울만 보면 | 그런데 **서울**만 보면 |
| 5 | 딱 다섯 곳이에요. 도봉 셋, 양천 하나, 노원 하나. | 딱 **5곳**이에요 |
| 6 | 칠억으로 올리면 | **7억**으로 올리면 |
| 7 | 여든한 곳으로 늘어나요. | **81곳**으로 늘어요 |
| 8 | 댓글에 코드 남기고 팔로우하면, 디엠으로 입장코드를 보내드려요. | (CTA 카드) |

문장을 고치려면 `assets_b2/manifest.json` 의 `say` 만 바꾸면 돼요. 화면은 건드릴 필요 없어요 — **소리 길이에 맞춰 화면 길이가 다시 계산돼요.** 말이 길어지면 그만큼 천천히 훑어요.

---

## 알아두면 좋은 것

- **합성기가 문장 끝에 0.5~1초 무음을 붙여 보내요.** 그대로 이으면 릴스가 30초로 늘어지고, 늘어짐이 완주율을 깎아요. 그래서 `render_b2_voice.py`가 앞뒤 무음을 잘라내고(`trim`), 쉬는 틈은 `PAD = 0.25`로 우리가 정해요. 37.7초 → 22.3초가 그렇게 나온 거예요.
- **숫자는 한글로 적어야 제대로 읽어요.** "186곳"이라고 쓰면 엉뚱하게 읽을 수 있어서 "백팔십육 곳"으로 적어 뒀어요. 화면 자막은 숫자 그대로 두고요.
- 화면 자료는 2026-09-19 기준이에요. 나중에 다시 찍으려면 `build_reel_b2.py`(크롬 필요)로 `assets_b2/` 를 새로 만들면 돼요.
- 5위 수락파크(3억5,000)는 3월 거래 1건 기준이라 화면에 "최근거래 3/9"로 적혀 있어요. 날짜가 지나면 목록이 바뀔 수 있으니 발행 전에 한 번 보세요.
