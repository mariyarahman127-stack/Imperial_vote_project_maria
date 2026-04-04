@echo off
title ICE Voting Server
color 0a

echo.
echo ========================================
echo    ICE VOTING SYSTEM - SERVER
echo ========================================
echo.

REM Get IP Address
for /f "tokens=2 delims=[]" %%a in ('ping -4 -n 1 %COMPUTERNAME% ^| findstr /r "^\[.*\]$"') do set IP=%%a
if "%IP%"=="" set IP=localhost

echo Starting server...
echo.

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)

REM Install localtunnel if not exists
where npx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing localtunnel...
    npm install -g localtunnel
)

echo.
echo ========================================
echo Starting ICE Voting Server...
echo ========================================
echo.

REM Start the server in a new window
start "ICE Voting Server" cmd /k "node server.js"

REM Wait for server to start
timeout /t 3 /nobreak >nul

echo.
echo Starting public tunnel (this may take a moment)...
echo.
echo A PUBLIC URL will be generated below.
echo SHARE THIS URL with voters on ANY network (different Wi-Fi, mobile data, etc.)
echo.

REM Start localtunnel to create public URL
start "ICE Voting Public Tunnel" cmd /k "npx localtunnel --port 3000"

echo.
echo Press any key to open the voting site in your browser...
pause >nul

start http://localhost:3000
