@echo off
chcp 65001 >nul
REM ---------------------------------------------------------------
REM  NuScale Power news -> KakaoTalk (send to me).
REM  Picks up articles from the last 2 hours and sends the ones not
REM  sent yet, so this is safe to run every hour from Task Scheduler.
REM
REM  Needs notify_kakao.py from the sudo-zip repo. If sudo-zip is not
REM  next to this repo, set NOTIFY_KAKAO_DIR to its folder first.
REM  Comments are ASCII on purpose (cmd.exe reads .bat in ANSI).
REM ---------------------------------------------------------------
set "PYTHONIOENCODING=utf-8"
set "PY=C:\Program Files\Python313\python.exe"
if not exist "%PY%" set "PY=python"

cd /d "%~dp0\.."
if not exist "data" mkdir "data"
echo ===== %date% %time% ===== >> "data\nuscale_news.log"
"%PY%" tools\nuscale_news_kakao.py %* >> "data\nuscale_news.log" 2>&1
echo [exit=%errorlevel%] >> "data\nuscale_news.log"
