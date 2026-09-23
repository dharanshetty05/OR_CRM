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
REM ==================================================

echo Checking whether MyCRM is already running...

set "READY="

for /f "delims=" %%A in ('powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 2; if ($r.ready -eq $true) { 'TRUE' } else { 'FALSE' } } catch { 'FALSE' }"') do (
    set "READY=%%A"
)

if /I "%READY%"=="TRUE" (
    echo MyCRM is already running.
    echo Opening MyCRM...
    timeout /t 1 /nobreak >nul
    explorer.exe "http://localhost:3000"
    exit /b 0
)

REM ==================================================
REM Start backend
REM ==================================================

echo Starting MyCRM backend...

start "ScaleWithLakshya MyCRM Backend" /MIN cmd /c "npm start"

REM ==================================================
REM Wait for backend to become ready
REM ==================================================

echo Waiting for MyCRM to become ready...

set /a RETRY=0

:WAIT_LOOP

timeout /t 1 /nobreak >nul

set "READY="

for /f "delims=" %%A in ('powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -TimeoutSec 2; if ($r.ready -eq $true) { 'TRUE' } else { 'FALSE' } } catch { 'FALSE' }"') do (
    set "READY=%%A"
)

if /I "%READY%"=="TRUE" (
    echo.
    echo ==========================================
    echo      MyCRM is ready!
    echo      Opening dashboard...
    echo ==========================================
    echo.

    timeout /t 1 /nobreak >nul

    explorer.exe "http://localhost:3000"

    exit /b 0
)

set /a RETRY+=1

if %RETRY% LSS 30 (
    goto WAIT_LOOP
)

REM ==================================================
REM Startup failed
REM ==================================================

echo.
echo ==========================================
echo      ERROR: MyCRM did not become ready
echo ==========================================
echo.
echo Check the MyCRM backend window for the error.
echo.
echo Expected URL:
echo http://localhost:3000
echo.

pause
exit /b 1