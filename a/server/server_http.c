#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#ifndef _WINSOCK_DEPRECATED_NO_WARNINGS
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#endif

// Versione da terminale: stessa logica della versione con interfaccia
// grafica (gui.c), ma qui il server gira finche' non premi Ctrl+C.
// Utile per vedere i log (printf) mentre impari o fai debug.

#include "network.h"
#include "httpserver.h"

#include <windows.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    int port = argc > 1 ? atoi(argv[1]) : 5000;

    if (http_server_start(port) != 0) {
        fprintf(stderr, "Impossibile avviare il server (porta %d occupata?)\n", port);
        return 1;
    }

    printf("Server HTTP in ascolto sulla porta %d (Ctrl+C per uscire)\n", port);
    printf("Pagina: metti la build di React dentro la cartella 'public'\n");
    printf("File ricevuti in: 'received'\n");

    // L'accept-loop vero gira in un thread dentro httpserver.c; qui il
    // thread principale non deve far altro che restare vivo.
    for (;;) Sleep(1000);

    return 0;
}
