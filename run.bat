@echo off
title ICE Voting System
color 0a

echo.
echo ========================================
echo    ICE VOTING SYSTEM
echo ========================================
echo.

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)

REM Install localtunnel if needed
npm list -g localtunnel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing localtunnel for public access...
    npm install -g localtunnel
    echo.
)

echo ========================================
echo Starting ICE Voting Server...
echo ========================================
echo.

REM Determine local IP (for LAN access)
for /f "tokens=2 delims=[]" %%a in ('ping -4 -n 1 %COMPUTERNAME% ^| findstr /r "^\[.*\]$"') do set IP=%%a
if "%IP%"=="" set IP=localhost
echo Local machine IP address: %IP%
echo.

REM Start server
start "ICE Voting Server" cmd /k "node server.js"

REM Wait for server to start
timeout /t 3 /nobreak >nul

echo.
echo Starting PUBLIC TUNNEL for access from ANY network...
echo.
echo A PUBLIC URL will appear in a new window.
echo SHARE THAT URL with voters on ANY network (different Wi-Fi, mobile data, etc.)
echo.

REM Start localtunnel for public access
start "ICE Voting Public Tunnel" cmd /k "npx localtunnel --port 3000"

echo.
echo Opening voting site in your browser...
timeout /t 2 /nobreak >nul

start http://localhost:3000
start http://%IP%:3000  
echo.
echo You can also share the network address above (http://%IP%:3000) with other machines on the same LAN.
echo If you need global access, use the public tunnel URL that appears in the separate window.

