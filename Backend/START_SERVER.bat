@echo off
echo ========================================
echo Starting Flask Backend Server
echo ========================================
echo.

REM Change to Backend directory
cd /d "%~dp0"

echo Current directory: %CD%
echo.

REM Check if model files exist
if not exist "random_forest_dyslexia_model.pkl" (
    echo ERROR: random_forest_dyslexia_model.pkl not found!
    echo Please ensure you're running this from the Backend directory.
    pause
    exit /b 1
)

if not exist "standard_scaler.pkl" (
    echo ERROR: standard_scaler.pkl not found!
    pause
    exit /b 1
)

if not exist "minmax_normalizer.pkl" (
    echo ERROR: minmax_normalizer.pkl not found!
    pause
    exit /b 1
)

echo All model files found!
echo.
echo Starting Flask server...
echo Server will be available at: http://localhost:5000
echo.
echo Press CTRL+C to stop the server
echo.

python app.py

