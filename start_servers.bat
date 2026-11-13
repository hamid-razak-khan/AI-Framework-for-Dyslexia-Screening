@echo off
echo ========================================
echo Starting CognitiveLens Servers
echo ========================================
echo.

echo [1/2] Starting Flask Backend Server...
start "Flask Backend" cmd /k "cd Backend && python app.py"
timeout /t 3 /nobreak > nul

echo [2/2] Starting React Frontend Server...
start "React Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo ========================================
echo Servers Starting...
echo ========================================
echo.
echo Flask Backend:  http://localhost:5000
echo React Frontend: http://localhost:5173
echo.
echo Both servers are starting in separate windows.
echo Check the windows for any errors.
echo.
echo Press any key to exit this window...
pause > nul

