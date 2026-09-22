@echo off
setlocal
cd /d "%~dp0server"

echo Checking if CRM is already running...
curl -s http://localhost:3000/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo CRM is already running.
    start http://localhost:3000
    exit /b 0
)

echo Starting Node backend...
start "ScaleWithLakshya CRM Backend" /MIN npm run dev

echo Waiting for CRM to be ready...
set retry=0
:waitloop
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000/api/health | findstr /C:"\"ready\":true" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo CRM is ready! Opening browser...
    start http://localhost:3000
    exit /b 0
)
set /a retry+=1
if %retry% LSS 20 (
    goto waitloop
)
echo Error: CRM failed to start within 40 seconds.
pause
exit /b 1
