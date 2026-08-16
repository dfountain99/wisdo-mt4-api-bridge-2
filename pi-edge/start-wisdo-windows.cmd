@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv311\Scripts\python.exe" (
  echo WISDO is not installed. Right-click install-windows.ps1 and choose Run with PowerShell.
  pause
  exit /b 1
)
".venv311\Scripts\python.exe" wisdo_edge.py
set WISDO_EXIT=%errorlevel%
if not "%WISDO_EXIT%"=="0" pause
exit /b %WISDO_EXIT%
