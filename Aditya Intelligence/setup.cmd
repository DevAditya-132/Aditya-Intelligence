@echo off
setlocal
cd /d "%~dp0"
title Aditya Intelligence Setup
powershell.exe -NoLogo -NoExit -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
