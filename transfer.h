#ifndef TRANSFER_H
#define TRANSFER_H

#include <winsock2.h>

/* Invia un file al peer. 0 = ok, -1 = errore */
int send_file(SOCKET s, const char *path);

/* Riceve un file e lo salva in out_dir. 0 = ok, -1 = errore */
int receive_file(SOCKET s, const char *out_dir);

#endif
