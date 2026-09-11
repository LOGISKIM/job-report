# job-report
## tools/nuscale_news_kakao.py

뉴스케일파워(NuScale Power) 관련 뉴스 중 최근 2시간 안에 나온 것을 카카오톡
'나에게 보내기'로 보낸다. 카카오 전송은 `sudo-zip/notify_kakao.py`를 그대로
쓰므로, 부동산 자동화가 돌아가는 PC에서 실행한다.

```
python tools\nuscale_news_kakao.py          # 최근 2시간, 카카오 전송
python tools\nuscale_news_kakao.py --dry    # 보내지 않고 화면에만
python tools\nuscale_news_kakao.py --hours 6
tools\run_nuscale_news.bat                  # 작업 스케줄러용 (매시간 걸어도 됨)
```

`sudo-zip` 폴더가 이 저장소 옆에 없으면 `NOTIFY_KAKAO_DIR` 환경변수로 위치를
알려준다. 한 번 보낸 기사는 `data/nuscale_sent.json`에 적어 두고 다시 보내지 않는다.
