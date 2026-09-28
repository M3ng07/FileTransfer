#ifndef _CRT_SECURE_NO_WARNINGS
#define _CRT_SECURE_NO_WARNINGS
#endif
#ifndef _WINSOCK_DEPRECATED_NO_WARNINGS
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#endif

#include "transfer.h"
#include "network.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <direct.h>

/*
 * PROTOCOLLO (tutti i numeri in big-endian):
 *   [2 byte]  lunghezza nome file (N, 1..255)
 *   [N byte]  nome file (senza percorso)
 *   [8 byte]  dimensione del file in byte
 *   [dati]    contenuto del file
 * Risposta del ricevente:
 *   [1 byte]  1 = ricevuto ok, 0 = errore
 */

#define CHUNK 65536
#define MAX_NAME 255

static const char *base_name(const char *path) {
    const char *a = strrchr(path, '\\');
    const char *b = strrchr(path, '/');
    const char *p = a > b ? a : b;
    return p ? p + 1 : path;
}

/* Rifiuta nomi che potrebbero uscire dalla cartella di destinazione */
static int name_is_safe(const char *name) {
    if (name[0] == '\0') return 0;
    if (strstr(name, "..")) return 0;
    if (strpbrk(name, "\\/:*?\"<>|")) return 0;
    return 1;
}

int send_file(SOCKET s, const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) { perror("fopen"); return -1; }

    _fseeki64(f, 0, SEEK_END);
    uint64_t size = (uint64_t)_ftelli64(f);
    _fseeki64(f, 0, SEEK_SET);

    const char *name = base_name(path);
    size_t nlen = strlen(name);
    if (nlen == 0 || nlen > MAX_NAME) {
        fprintf(stderr, "Nome file non valido\n");
        fclose(f);
        return -1;
    }

    uint8_t nl[2] = { (uint8_t)(nlen >> 8), (uint8_t)(nlen & 0xFF) };
    uint64_t size_be = to_be64(size);

    if (send_all(s, nl, 2) || send_all(s, name, nlen) || send_all(s, &size_be, 8)) {
        fprintf(stderr, "Errore invio header\n");
        fclose(f);
        return -1;
    }

    char *buf = malloc(CHUNK);
    if (!buf) { fclose(f); return -1; }

    uint64_t sent = 0;
    while (sent < size) {
        size_t want = (size - sent) > CHUNK ? CHUNK : (size_t)(size - sent);
        size_t got = fread(buf, 1, want, f);
        if (got == 0 || send_all(s, buf, got)) {
            fprintf(stderr, "\nErrore durante l'invio\n");
            free(buf); fclose(f);
            return -1;
        }
        sent += got;
        printf("\rInviati %llu / %llu byte", (unsigned long long)sent, (unsigned long long)size);
        fflush(stdout);
    }
    printf("\n");
    free(buf);
    fclose(f);

    uint8_t ack = 0;
    if (recv_all(s, &ack, 1) || ack != 1) {
        fprintf(stderr, "Il ricevente ha segnalato un errore\n");
        return -1;
    }
    printf("Trasferimento completato.\n");
    return 0;
}

int receive_file(SOCKET s, const char *out_dir) {
    uint8_t nl[2];
    if (recv_all(s, nl, 2)) return -1;
    size_t nlen = ((size_t)nl[0] << 8) | nl[1];
    if (nlen == 0 || nlen > MAX_NAME) return -1;

    char name[MAX_NAME + 1];
    if (recv_all(s, name, nlen)) return -1;
    name[nlen] = '\0';

    uint64_t size_be;
    if (recv_all(s, &size_be, 8)) return -1;
    uint64_t size = from_be64(size_be);

    uint8_t ok = 1;
    FILE *f = NULL;

    if (!name_is_safe(name)) {
        fprintf(stderr, "Nome file rifiutato: %s\n", name);
        ok = 0;
    } else {
        _mkdir(out_dir);
        char path[512];
        snprintf(path, sizeof(path), "%s\\%s", out_dir, name);
        f = fopen(path, "wb");
        if (!f) { perror("fopen"); ok = 0; }
        else printf("Ricevo '%s' (%llu byte)\n", name, (unsigned long long)size);
    }

    char *buf = malloc(CHUNK);
    if (!buf) return -1;

    /* Leggiamo comunque tutti i byte, anche in caso di errore, per non lasciare il socket a meta' */
    uint64_t recvd = 0;
    while (recvd < size) {
        size_t want = (size - recvd) > CHUNK ? CHUNK : (size_t)(size - recvd);
        if (recv_all(s, buf, want)) { ok = 0; break; }
        if (f && fwrite(buf, 1, want, f) != want) ok = 0;
        recvd += want;
    }
    free(buf);
    if (f) fclose(f);

    send_all(s, &ok, 1);
    return ok ? 0 : -1;
}
