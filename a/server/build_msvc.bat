@echo off
REM Da eseguire in "x64 Native Tools Command Prompt for VS" nella cartella del progetto
cl /nologo /W3 /Fe:server_http.exe server_http.c httpserver.c http.c network.c
