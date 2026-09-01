@echo off
rem 가계부 서버 시작 스크립트.
rem 같은 폴더의 token.txt 에서 LEDGER_TOKEN을 읽는다 (token.txt는 git에 올라가지 않음).
cd /d %~dp0
if not exist token.txt (
    echo token.txt 파일이 없습니다. 이 폴더에 token.txt를 만들고 토큰값 한 줄만 넣어주세요.
    pause
    exit /b 1
)
set /p LEDGER_TOKEN=<token.txt
python server.py
pause
