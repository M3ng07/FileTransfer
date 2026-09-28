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
    int port = argc > 1 ? atoi(argv[1]) : 5000;

    if (net_init() != 0) { fprintf(stderr, "WSAStartup fallita\n"); return 1; }

    SOCKET srv = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (srv == INVALID_SOCKET) { fprintf(stderr, "socket: %d\n", WSAGetLastError()); return 1; }

    BOOL yes = TRUE;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, (const char *)&yes, sizeof(yes));

    struct sockaddr_in addr = {0};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons((u_short)port);

    if (bind(srv, (struct sockaddr *)&addr, sizeof(addr)) == SOCKET_ERROR) {
        fprintf(stderr, "bind: %d\n", WSAGetLastError());
        return 1;
    }
    if (listen(srv, 5) == SOCKET_ERROR) {
        fprintf(stderr, "listen: %d\n", WSAGetLastError());
        return 1;
    }

    printf("In ascolto sulla porta %d... (Ctrl+C per uscire)\n", port);

    for (;;) {
        struct sockaddr_in cli;
        int len = sizeof(cli);
        SOCKET c = accept(srv, (struct sockaddr *)&cli, &len);
        if (c == INVALID_SOCKET) { fprintf(stderr, "accept: %d\n", WSAGetLastError()); continue; }

        printf("Connessione da %s\n", inet_ntoa(cli.sin_addr));
        if (receive_file(c, "received") != 0)
            fprintf(stderr, "Ricezione fallita\n");
        closesocket(c);
    }

    closesocket(srv);
    net_cleanup();
    return 0;
}
