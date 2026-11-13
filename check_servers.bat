@echo off
echo ========================================
echo Checking Server Status
echo ========================================
echo.

echo Checking Flask Backend (port 5000)...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000/health' -TimeoutSec 2 -UseBasicParsing; Write-Host '✓ Backend is RUNNING' -ForegroundColor Green; Write-Host $response.Content } catch { Write-Host '✗ Backend is NOT running' -ForegroundColor Red }"

echo.
echo Checking React Frontend (port 5173)...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 2 -UseBasicParsing; Write-Host '✓ Frontend is RUNNING' -ForegroundColor Green } catch { Write-Host '✗ Frontend is NOT running' -ForegroundColor Red }"

echo.
echo ========================================
pause

