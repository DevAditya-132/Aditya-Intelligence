@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
set "ELECTRON=%ROOT%.runtime\electron\electron.exe"
set "APP=%ROOT%src\main.js"
set "SERVER=%ROOT%.runtime\llama\llama-server.exe"
set "MODEL=%ROOT%.runtime\models\qwen2.5-1.5b-instruct-q4_k_m.gguf"
if not exist "%ELECTRON%" (
  echo Electron is missing. Run setup.cmd first and wait for "Setup complete."
  pause
  exit /b 1
)
if not exist "%SERVER%" (
  echo llama-server.exe is missing: "%SERVER%"
  pause
  exit /b 1
)
if not exist "%MODEL%" (
  echo The language model is missing: "%MODEL%"
  pause
  exit /b 1
)
if not exist "%APP%" (
  echo The application entry file is missing: "%APP%"
  pause
  exit /b 1
)
"%ELECTRON%" "%APP%"
set "APP_EXIT=%ERRORLEVEL%"
if not "%APP_EXIT%"=="0" (
  echo.
  echo Electron exited with code %APP_EXIT%.
  pause
)
exit /b %APP_EXIT%
