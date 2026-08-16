@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv311\Scripts\python.exe" (
  echo WISDO is not installed. Run install-windows.ps1 first.
  exit /b 1
)
".venv311\Scripts\python.exe" enroll.py
if errorlevel 1 exit /b %errorlevel%
echo WISDO Windows device enrollment complete.
