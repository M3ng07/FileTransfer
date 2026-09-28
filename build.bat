@echo off
REM MinGW-w64 (gcc):
gcc -Wall -Wextra -o server.exe server.c network.c transfer.c -lws2_32
gcc -Wall -Wextra -o client.exe client.c network.c transfer.c -lws2_32
