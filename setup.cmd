@echo off
rem One-time setup of the Smart Clock control panel on this PC. Safe to run again.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0control-panel\launcher\Setup.ps1"
echo.
pause
