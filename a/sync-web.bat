@echo off
REM Compila la pagina React (cartella "web") e la copia dentro "server\public".
REM Da eseguire dalla cartella principale del progetto. Richiede Node.js.

cd web
call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
cd ..

if exist server\public rmdir /s /q server\public
mkdir server\public
xcopy /e /i /y web\dist\* server\public\ >nul

echo.
echo Fatto: server\public aggiornata con l'ultima build della pagina.
