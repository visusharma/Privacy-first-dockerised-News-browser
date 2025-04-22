@echo off
echo Starting Privacy Browser...

REM Navigate to the project directory
cd /d "%~dp0"

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo Docker is not running! Please start Docker Desktop first.
  echo Press any key to exit...
  pause >nul
  exit /b 1
)

REM Start Docker Compose if not already running
echo Starting Docker containers...
docker-compose up -d

REM Wait for the service to be ready
echo Waiting for the browser service to start...
timeout /t 5 /nobreak >nul

REM Open the browser
echo Opening browser...
start "" "http://localhost:3000"

echo Browser started! If the page doesn't load, please check Docker status
echo and visit http://localhost:3000 manually.
