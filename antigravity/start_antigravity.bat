@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Antigravityを起動しています...
npm run electron:dev
pause
