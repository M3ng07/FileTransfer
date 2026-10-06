@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Aggiorno la pagina web dell'iPad...
call sync-web.bat
if errorlevel 1 goto :error

echo.
echo [2/3] Installo le dipendenze del pannello desktop...
cd desktop
call npm install
if errorlevel 1 goto :error

echo.
echo [3/3] Creo il programma e gli installer Tauri...
call npm run tauri build
if errorlevel 1 goto :error

echo.
echo ================================================
echo BUILD COMPLETATO
echo.
echo EXE:     desktop\src-tauri\target\release\file-transfer-desktop.exe
echo NSIS:    desktop\src-tauri\target\release\bundle\nsis\
echo MSI:     desktop\src-tauri\target\release\bundle\msi\
echo ================================================
pause
exit /b 0

:error
echo.
echo BUILD FALLITO. Controlla gli errori mostrati sopra.
pause
exit /b 1
