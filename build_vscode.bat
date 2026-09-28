@echo off
setlocal
REM Trova da solo Visual Studio (qualunque versione/edizione) e carica l'ambiente di compilazione C++
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" echo vswhere non trovato: Visual Studio non risulta installato & exit /b 1

for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSPATH=%%i"
if not defined VSPATH echo Strumenti C++ non trovati: dal Visual Studio Installer aggiungi il carico di lavoro "Sviluppo di applicazioni desktop con C++" & exit /b 1

call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1

cl /nologo /W3 /Fe:server.exe server.c network.c transfer.c
if errorlevel 1 exit /b 1
cl /nologo /W3 /Fe:client.exe client.c network.c transfer.c
if errorlevel 1 exit /b 1

echo.
echo Compilazione completata: server.exe e client.exe
