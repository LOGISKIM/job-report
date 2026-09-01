@echo off
rem 가계부 정적 페이지 발행: 렌더링 → 암호화 → git 푸시.
rem 작업 스케줄러에 등록해 매일 1회 실행한다.
cd /d %~dp0
git pull
python publish_static.py
if errorlevel 1 exit /b 1
git add index.html
git commit -m "ledger publish %date% %time:~0,5%"
git push
