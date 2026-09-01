@echo off
rem Publish the ledger dashboard: render -> encrypt -> git push.
rem Messages are in English on purpose: the Windows console (CP949) garbles
rem UTF-8 Korean in .bat files.
setlocal
cd /d %~dp0

echo [1/5] Checking git identity...
git config user.email >nul 2>&1
if errorlevel 1 (
    echo.
    echo !! Git identity is not set. Run these once, then try again:
    echo    git config --global user.email "your@email.com"
    echo    git config --global user.name "Your Name"
    goto fail
)

echo [2/5] Pulling latest code...
git pull
if errorlevel 1 goto fail

echo [3/5] Rendering and encrypting dashboard...
python publish_static.py
if errorlevel 1 goto fail

echo [4/5] Committing...
git add index.html
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "ledger publish %date% %time:~0,5%"
    if errorlevel 1 goto fail
) else (
    echo      No change since last publish - nothing to commit.
)

echo [5/5] Pushing...
git push
if errorlevel 1 goto fail

echo.
echo ============================================
echo  PUBLISHED
echo  https://logiskim.github.io/job-report/ledger/
echo ============================================
timeout /t 20
exit /b 0

:fail
echo.
echo !! FAILED - see the message above.
pause
exit /b 1
