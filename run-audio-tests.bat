@echo off
REM Twilio Audio Test Runner
REM Comprehensive test suite for Twilio + OpenAI audio pipeline

echo ========================================
echo   Twilio Audio Pipeline Test Suite
echo ========================================
echo.

:menu
echo Select test suite to run:
echo.
echo   1. Full Audio Integration Tests
echo   2. Audio Utils Unit Tests
echo   3. End-to-End Call Flow Tests
echo   4. Edge Cases and Error Handling
echo   5. Run ALL Audio Tests
echo   6. Medical Call Test (existing)
echo   7. Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto audio-full
if "%choice%"=="2" goto audio-utils
if "%choice%"=="3" goto e2e-calls
if "%choice%"=="4" goto edge-cases
if "%choice%"=="5" goto all-tests
if "%choice%"=="6" goto medical-call
if "%choice%"=="7" goto end

echo Invalid choice. Please try again.
echo.
goto menu

:audio-full
echo.
echo Running Full Audio Integration Tests...
echo ========================================
call npm run test:audio-full
goto show-results

:audio-utils
echo.
echo Running Audio Utils Unit Tests...
echo ========================================
call npm run test:audio-utils
goto show-results

:e2e-calls
echo.
echo Running End-to-End Call Flow Tests...
echo ========================================
call npm run test:e2e-calls
goto show-results

:edge-cases
echo.
echo Running Edge Cases and Error Handling Tests...
echo ========================================
call npm run test:edge-cases
goto show-results

:all-tests
echo.
echo Running ALL Audio Tests...
echo ========================================
echo This will run all audio test suites sequentially.
echo.
call npm run test:audio-all
goto show-results

:medical-call
echo.
echo Running Medical Call Test...
echo ========================================
call npm run test:call
goto show-results

:show-results
echo.
echo ========================================
echo   Test Execution Complete
echo ========================================
echo.
echo Would you like to:
echo   1. View HTML report
echo   2. Run another test suite
echo   3. Exit
echo.
set /p action="Enter your choice (1-3): "

if "%action%"=="1" goto show-report
if "%action%"=="2" goto menu
if "%action%"=="3" goto end

goto show-results

:show-report
echo.
echo Opening test report...
call npx playwright show-report
goto menu

:end
echo.
echo Thank you for using the Twilio Audio Test Suite!
echo.
pause
