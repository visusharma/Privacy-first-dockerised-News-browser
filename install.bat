@echo off
echo Setting up Privacy Browser...

REM Navigate to the script directory
cd /d "%~dp0"

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
  echo Docker is not installed or not in PATH
  echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
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

REM Create desktop shortcut directly with VBScript
echo Creating desktop shortcut...
(
echo Set WshShell = WScript.CreateObject^("WScript.Shell"^)
echo strDesktop = WshShell.SpecialFolders^("Desktop"^)
echo Set oShellLink = WshShell.CreateShortcut^(strDesktop ^& "\Privacy Browser.lnk"^)
echo oShellLink.TargetPath = "%~dp0start-browser.bat"
echo oShellLink.WorkingDirectory = "%~dp0"
echo oShellLink.Description = "Privacy-First Browser"
echo oShellLink.Save
) > "%TEMP%\create_shortcut.vbs"

cscript //nologo "%TEMP%\create_shortcut.vbs"
del "%TEMP%\create_shortcut.vbs"

echo Setup complete!
echo You can now start the Privacy Browser using the desktop shortcut
echo or by running start-browser.bat
pause 