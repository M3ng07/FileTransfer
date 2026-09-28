@echo off
REM Da eseguire in "x64 Native Tools Command Prompt for VS" nella cartella del progetto
cl /nologo /W3 /Fe:server.exe server.c network.c transfer.c
if errorlevel 1 exit /b 1
cl /nologo /W3 /Fe:client.exe client.c network.c transfer.c
if errorlevel 1 exit /b 1
echo.
echo Compilazione completata: server.exe e client.exe
