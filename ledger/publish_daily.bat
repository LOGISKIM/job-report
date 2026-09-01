@echo off
rem 가계부 정적 페이지 발행: 렌더링 → 암호화 → git 푸시.
rem 작업 스케줄러에 등록해 매일 1회 실행한다.
cd /d %~dp0

echo [1/4] 최신 코드 받는 중...
git pull
if errorlevel 1 goto fail

echo [2/4] 대시보드 암호화 발행 중...
python publish_static.py
if errorlevel 1 goto fail

echo [3/4] 커밋 중...
git add index.html
git commit -m "ledger publish %date% %time:~0,5%"

echo [4/4] 푸시 중...
git push
if errorlevel 1 goto fail

echo.
echo ============================================
echo  발행 완료!
echo  https://logiskim.github.io/job-report/ledger/
echo ============================================
echo.
echo (자동 실행이 아니면 아무 키나 누르면 닫힙니다)
timeout /t 30
exit /b 0

:fail
echo.
echo !! 실패했습니다. 위 메시지를 확인하세요.
pause
exit /b 1
