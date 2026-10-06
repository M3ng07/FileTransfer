@echo off
REM Doppio click: compila e avvia il server da terminale.
REM Per l'interfaccia grafica vera e propria, vedi la cartella "desktop".
cd /d "%~dp0"

call build.bat
if errorlevel 1 (
    echo.
    echo Compilazione fallita, vedi errori sopra.
    pause
    exit /b 1
)

server_http.exe 5000
pause
