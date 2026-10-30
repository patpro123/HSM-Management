@echo off
rem Double-click wrapper for server-restart.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server-restart.ps1"
if "%1"=="" pause
