@echo off
cd /d "%~dp0"
echo Checking for Node.js installation...

REM Try to find Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Please install Node.js from https://nodejs.org/
    echo Make sure to install the LTS version.
    pause
    exit /b 1
)

echo Node.js found. Installing dependencies...
call npm install

echo Starting Medical Outbound System V2...
call npm run start:medical
pause
