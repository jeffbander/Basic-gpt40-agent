@echo off
REM Start all ngrok tunnels for multiple apps
echo =========================================
echo Starting ngrok tunnels for all apps...
echo =========================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>&1
if errorlevel 1 (
    echo ERROR: ngrok not found in PATH
    echo Please install ngrok from https://ngrok.com/download
    pause
    exit /b 1
)

REM Start ngrok with ALL tunnels from config file
echo Starting ngrok with config file: ngrok-config.yml
echo.
echo Starting tunnels:
echo   1. medical-app (port 5051) - Medical Outbound Calling System
echo   2. heartvoice-monitor (port 3004) - HeartVoice Monitor Platform
echo   3. heartvoice-websocket (port 8080) - HeartVoice WebSocket Server
echo.
echo After ngrok starts:
echo   1. Run: npm run update:all-ngrok
echo   2. Restart both applications
echo.

ngrok start medical-app heartvoice-monitor heartvoice-websocket --config=ngrok-config.yml --log=stdout

pause
