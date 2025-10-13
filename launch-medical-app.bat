@echo off
cd /d "%~dp0"
echo =========================================
echo Medical Outbound Calling System Launcher
echo =========================================
echo.

REM Set Node.js path
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

echo Checking Node.js installation...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please run: winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

echo Node.js found: & node --version
echo.

echo Installing dependencies...
call "C:\Program Files\nodejs\npm.cmd" install

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo =========================================
echo IMPORTANT SETUP STEPS REQUIRED:
echo =========================================
echo.
echo 1. Install ngrok if not already installed:
echo    - Download from: https://ngrok.com/download
echo    - Sign up for a free account at: https://ngrok.com/
echo    - Authenticate ngrok: ngrok config add-authtoken ^<YOUR_AUTH_TOKEN^>
echo.
echo 2. Start ngrok tunnel on port 5051:
echo    ngrok http 5051
echo.
echo 3. Copy the https://XXXX.ngrok.app URL and update BASE_URL in .env
echo.
echo 4. Then run this command in a new terminal:
echo    npm run start:medical
echo.
echo 5. Open dashboard: http://localhost:5051/patient-dashboard-v2.html
echo.
echo =========================================

echo Press any key to continue with server startup (ngrok must be running first)...
pause

echo Starting Medical Outbound Calling System...
npm run start:medical

pause
