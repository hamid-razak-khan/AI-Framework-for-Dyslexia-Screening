@echo off
echo ========================================
echo Installing Python Dependencies
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python found!
python --version
echo.

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip
echo.

REM Install Python dependencies
echo Installing Python packages from requirements.txt...
python -m pip install -r requirements.txt
echo.

echo ========================================
echo Python Dependencies Installed!
echo ========================================
echo.
echo NOTE: You also need to install Tesseract OCR for pytesseract to work.
echo.
echo For Windows:
echo 1. Download Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki
echo 2. Install it (default location: C:\Program Files\Tesseract-OCR)
echo 3. Add to PATH or set TESSDATA_PREFIX environment variable
echo.
echo For Linux: sudo apt-get install tesseract-ocr
echo For Mac: brew install tesseract
echo.
pause

