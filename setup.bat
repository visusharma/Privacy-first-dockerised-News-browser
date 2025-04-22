@echo off
echo Setting up Privacy Browser...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
  echo Docker is not installed or not in PATH
  echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
  pause
  exit /b 1
)

REM Check for Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js is required for setup but not found
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

REM Create the launcher batch file
echo Creating launcher script...
(
echo @echo off
echo echo Starting Privacy Browser...
echo.
echo REM Navigate to the project directory
echo cd /d "%%~dp0"
echo.
echo REM Check if Docker is running
echo docker info ^>nul 2^>^&1
echo if %%errorlevel%% neq 0 ^(
echo   echo Docker is not running^! Please start Docker Desktop first.
echo   echo Press any key to exit...
echo   pause ^>nul
echo   exit /b 1
echo ^)
echo.
echo REM Start Docker Compose if not already running
echo echo Starting Docker containers...
echo docker-compose up -d
echo.
echo REM Wait for the service to be ready
echo echo Waiting for the browser service to start...
echo timeout /t 5 /nobreak ^>nul
echo.
echo REM Open the browser
echo echo Opening browser...
echo start "" "http://localhost:3000"
echo.
echo echo Browser started^! If the page doesn't load, please check Docker status
echo echo and visit http://localhost:3000 manually.
) > start-browser.bat

REM Create desktop shortcut
echo Creating desktop shortcut...
node create-shortcut.js

echo Setup complete!
echo You can now start the Privacy Browser using the desktop shortcut
echo or by running start-browser.bat
pause 