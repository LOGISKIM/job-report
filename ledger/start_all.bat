@echo off
rem One-click start after a reboot: ledger server + cloudflare tunnel.
rem Messages are in English: the Windows console (CP949) garbles UTF-8 Korean.
rem
rem Put a shortcut to this file in the Startup folder (Win+R -> shell:startup)
rem to have it run automatically on every boot.
rem
rem Add PUBLISH as an argument (start_all.bat PUBLISH) to push the tunnel URL
rem to GitHub so the phone can pick it up automatically.
setlocal
cd /d %~dp0

if not exist token.txt (
    echo.
    echo !! token.txt is missing. Create it in this folder with your token on one line.
    pause
    exit /b 1
)

echo [1/2] Starting ledger server...
start "ledger server" cmd /c start_ledger.bat

echo [2/2] Starting cloudflare tunnel...
if /i "%~1"=="PUBLISH" (
    start "ledger tunnel" cmd /k python tunnel.py --publish
) else (
    start "ledger tunnel" cmd /k python tunnel.py
)

echo.
echo Two windows opened. Keep them running.
echo The tunnel window shows the URL to put into Macrodroid.
timeout /t 15
