@echo off
REM Prima volta: installa le dipendenze, poi apre l'app in modalita' sviluppo
REM (si ricompila da sola se modifichi i file). Serve Node.js e Rust installati.
cd /d "%~dp0"
call npm install
if errorlevel 1 (
    pause
    exit /b 1
)
call npm run tauri dev
pause
