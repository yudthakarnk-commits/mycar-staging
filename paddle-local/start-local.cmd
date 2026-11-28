@echo off
cd /d "%~dp0dist"
where py >nul 2>nul
if errorlevel 1 (echo Python 3 launcher not found. Install Python 3 or use another local static server. & pause & exit /b 1)
echo Open http://127.0.0.1:8765 in Chrome or Edge.
py -3 -m http.server 8765 --bind 127.0.0.1
pause
