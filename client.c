#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#ifndef _WINSOCK_DEPRECATED_NO_WARNINGS
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#endif

#include "network.h"
#include "transfer.h"

#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    if (argc < 4) {
        printf("Uso: %s <ip-server> <porta> <file>\n", argv[0]);
        return 1;
    }
    const char *ip = argv[1];
    int port = atoi(argv[2]);
    const char *path = argv[3];

    if (net_init() != 0) { fprintf(stderr, "WSAStartup fallita\n"); return 1; }

    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (s == INVALID_SOCKET) { fprintf(stderr, "socket: %d\n", WSAGetLastError()); return 1; }

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_port = htons((u_short)port);
    addr.sin_addr.s_addr = inet_addr(ip);
    if (addr.sin_addr.s_addr == INADDR_NONE) {
        fprintf(stderr, "Indirizzo IP non valido: %s\n", ip);
        return 1;
    }

    if (connect(s, (struct sockaddr *)&addr, sizeof(addr)) == SOCKET_ERROR) {
        fprintf(stderr, "connect: %d\n", WSAGetLastError());
        return 1;
    }

    int rc = send_file(s, path);

    closesocket(s);
    net_cleanup();
    return rc == 0 ? 0 : 1;
}
