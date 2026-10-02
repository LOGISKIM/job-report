# macro-brief

인스타그램 글로벌 매크로 브리프용 도구예요. 무료 공개 리포트를 모아 주제별 후보를 추리고, 공공 데이터로 차트를 다시 그려요.
캐러셀 양식은 [`templates/FORMAT.md`](templates/FORMAT.md)에 있어요.

## 설치

```bash
cd macro-brief
pip install -r requirements.txt
```

## 매주 할 일

```bash
python -m macrobrief weekly            # 수집 + 후보 정리 + FRED 데이터 팩
```

결과는 `out/<오늘 날짜>/`에 생겨요.

| 파일 | 내용 |
|---|---|
| `digest.md` | 주제별 후보 목록 (출처 수집 상태 포함). 여기서 이번 주 주제를 골라요 |
| `items.json` | 수집한 글 전체 (제목, 링크, 날짜, 요약, 주제 태그) |
| `texts/` | 본문 전문: 블랙록 주간 PDF, 모건스탠리 팟캐스트 스크립트, 수동 입력 파일 |
| `data/*.csv` | FRED 데이터 팩 14개 시계열 (금리, 물가, 고용, 달러, 원/달러, 유가, 스프레드) |

주제를 고른 뒤 `texts/`의 원문과 `data/`의 CSV를 Claude에게 주면 10장 초안을 만들 수 있어요.

## 출처

`sources.yaml`에서 켜고 끄거나 추가해요.

| 출처 | 방식 | 비고 |
|---|---|---|
| BlackRock BII 주간 코멘터리 | 페이지 → PDF 본문 추출 | 매주 월 |
| Morgan Stanley Thoughts on the Market | RSS | 스크립트 전문 저장 |
| Morgan Stanley Insights, Goldman Sachs Insights | 목록 페이지 | |
| Apollo Academy | WordPress API | |
| J.P. Morgan Guide to the Markets | 페이지 → PDF 링크 | 자료집이라 링크만 기록 |
| PIMCO, Vanguard, Schwab | 목록 페이지 | 날짜가 없는 글도 있어요 |
| 연준 보도자료·연설·FEDS Notes, 뉴욕 연은, FRED Blog, ECB, BIS, EIA | RSS | |
| IMF | 수동 | 자동 접근이 막혀 있어요. `inbox/manual/`에 PDF를 넣어요 |

## 데이터 명령

```bash
python -m macrobrief data fred DGS10 DGS30 --start 2000-01-01          # FRED (키 불필요)
python -m macrobrief data treasury 2026                                # 재무부 일별 수익률 곡선
python -m macrobrief data fiscal v2/accounting/od/avg_interest_rates   # 재무부 Fiscal Data
python -m macrobrief data bls CUUR0000SA0 --start 2020                 # BLS (BLS_API_KEY 권장)
python -m macrobrief data ecos 722Y001 M 202401 202609 0101000         # 한국은행 기준금리 (ECOS_API_KEY 필요)
python -m macrobrief data worldbank KR NY.GDP.MKTP.KD.ZG               # World Bank
python -m macrobrief data oecd "OECD.SDD.STES,DSD_STES@DF_CLI,4.1" "USA+KOR.M.LI...AA...H" --start 2024-01
python -m macrobrief data sec 320193                                   # SEC 기업 재무 (CIK)
```

## 차트

카드와 같은 스타일의 SVG를 만들어요.

```bash
python -m macrobrief chart --series DGS10,DGS30 --names 10년물,30년물 --monthly \
  --ref-date 2002-05 --ref-value 5.29 --ref-label "2002년 이후 최고" --out out/yields.svg
```

## API 키 (모두 무료, 환경변수로 설정)

| 변수 | 발급처 | 없으면 |
|---|---|---|
| `ECOS_API_KEY` | https://ecos.bok.or.kr/api/ | 샘플 키로 10건까지만 |
| `BLS_API_KEY` | https://data.bls.gov/registrationEngine/ | 하루 요청 한도가 작아서 자주 막혀요 |
| `SEC_USER_AGENT` | 없음. `이름 이메일` 형식 | SEC가 요청을 거부할 수 있어요 |

## 저작권 원칙

- 공공(public) 출처: 중앙은행·국제기구. 인용이 자유로운 편이에요.
- 민간(private) 출처: 요약 + 출처 + 원문 링크까지만. 원본 차트는 캡처하지 않고 공공 데이터로 다시 그려요.
- 유료·고객 전용 리서치나 유출본 PDF는 넣지 않아요.

## 테스트

```bash
python -m unittest discover -s tests
```
