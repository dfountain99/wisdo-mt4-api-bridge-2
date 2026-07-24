@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Python 3 is required.& exit /b 1)
py -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt
if not exist .env copy .env.example .env
powershell -NoProfile -Command "$a=New-ScheduledTaskAction -Execute '%CD%\.venv\Scripts\python.exe' -Argument '%CD%\agent.py' -WorkingDirectory '%CD%'; $t=New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName 'Wisdo Desktop Agent' -Action $a -Trigger $t -RunLevel Highest -Force"
echo Edit .env, run .venv\Scripts\python.exe enroll.py, then start the scheduled task.
endlocal
