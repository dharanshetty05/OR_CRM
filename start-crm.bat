@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo.
echo ==========================================
echo      ScaleWithLakshya MyCRM
echo ==========================================
echo.

REM ==================================================
REM Check Node.js
REM ==================================================

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js was not found on PATH.
    echo Please install Node.js and try again.
    pause
    exit /b 1
)

REM ==================================================
REM Check npm
REM ==================================================

where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm was not found on PATH.
    echo Please reinstall Node.js and try again.
    pause
    exit /b 1
)

REM ==================================================
REM Move to backend folder
REM ==================================================

cd /d "%~dp0server"

REM ==================================================
REM Install dependencies if needed
REM ==================================================

if not exist "node_modules\" (
    echo Installing backend dependencies...
    echo.

    call npm install

    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed.
        echo.
        pause
        exit /b 1
    )
)

REM ==================================================
REM Check whether CRM is already running
REM (Reachability only - the dashboard renders instantly even
REM  while Google Sheets is still loading in the background,
REM  so we don't wait for the full "ready" state here.)
REM ==================================================

echo Checking whether MyCRM is already running...

set "UP="

for /f "delims=" %%A in ('powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 2 | Out-Null; 'TRUE' } catch { 'FALSE' }"') do (
    set "UP=%%A"
)

if /I "%UP%"=="TRUE" (
    echo MyCRM is already running.
    echo Opening MyCRM...
    explorer.exe "http://localhost:3000"
    exit /b 0
)

REM ==================================================
REM Start backend
REM ==================================================

echo Starting MyCRM backend...

start "ScaleWithLakshya MyCRM Backend" /MIN cmd /c "npm start"

REM ==================================================
REM Wait for the server to accept connections.
REM The dashboard shell loads instantly once Express is up;
REM Google Sheets data fills in afterward in the background,
REM so we open the browser as soon as the server responds.
REM ==================================================

echo Waiting for MyCRM to start...

set /a RETRY=0

:WAIT_LOOP

timeout /t 1 /nobreak >nul

set "UP="

for /f "delims=" %%A in ('powershell -NoProfile -Command "try { Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 2 | Out-Null; 'TRUE' } catch { 'FALSE' }"') do (
    set "UP=%%A"
)

if /I "%UP%"=="TRUE" (
    echo.
    echo ==========================================
    echo      MyCRM is up! Opening dashboard...
    echo ==========================================
    echo.

    explorer.exe "http://localhost:3000"

    exit /b 0
)

set /a RETRY+=1

if %RETRY% LSS 20 (
    goto WAIT_LOOP
)

REM ==================================================
REM Startup failed
REM ==================================================

echo.
echo ==========================================
echo      ERROR: MyCRM did not start
echo ==========================================
echo.
echo Check the "ScaleWithLakshya MyCRM Backend" window for the
echo actual error message. Common causes:
echo   - Port 3000 is already used by another application.
echo     Close it, or set a different PORT in server\.env
echo   - Google credentials are missing/invalid in server\.env
echo     (the dashboard can still start without them - this
echo     error means the server itself failed to launch).
echo.
echo Expected URL:
echo http://localhost:3000
echo.

pause
exit /b 1