@echo off
rem Opens the Smart Clock Panel window. Paths are relative, so the folder can be moved.
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launcher\SmartClockPanel.ps1"
