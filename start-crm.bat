@echo off
cd /d "%~dp0"

if not exist ".env" (
    echo No .env file found. Copy .env.example to .env and fill in your Google Sheets credentials first.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies, this only happens once...
    call npm install
)

start "" http://localhost:3000
node server/server.js

pause
