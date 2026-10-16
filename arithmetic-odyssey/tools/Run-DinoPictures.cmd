@echo off
rem Double-click this file to download the dinosaur pictures.
rem It runs Get-DinoPictures.ps1 (in PowerShell 7 if installed) without changing the execution
rem policy, keeps the window open at the end, and opens the downloaded-pictures folder.
rem Any options are passed on, e.g.:  Run-DinoPictures.cmd -Dinosaur Eoraptor -ListOnly

setlocal
set "RC=2"
cd /d "%~dp0"

if not exist "%~dp0Get-DinoPictures.ps1" (
    echo Get-DinoPictures.ps1 was not found next to this file in:
    echo   %~dp0
    goto :done
)

rem Use PowerShell 7 (pwsh.exe) when it is installed, else Windows PowerShell 5.1.
set "PS=powershell.exe"
where pwsh.exe >nul 2>nul && set "PS=pwsh.exe"
echo Running with %PS%
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Get-DinoPictures.ps1" %*
set "RC=%ERRORLEVEL%"

set "OUT=%~dp0..\themes\dino\downloaded-pictures"
if exist "%OUT%\" start "" explorer.exe "%OUT%"

echo.
if "%RC%"=="0" echo Finished. All pictures downloaded.
if "%RC%"=="1" echo Finished, but some pictures failed. See themes\dino\downloaded-pictures\download-log.csv.
if "%RC%"=="2" echo The script could not start. Read the message above.

:done
echo.
pause
exit /b %RC%
