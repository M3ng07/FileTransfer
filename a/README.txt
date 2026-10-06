PROGETTO FILE TRANSFER

STRUTTURA
  server/     codice C del server HTTP e pagina web compilata
  web/        React + TypeScript per l'interfaccia iPad
  desktop/    Tauri + React/TypeScript per il pannello Windows
  sync-web.bat  compila web e aggiorna server/public

ARCHITETTURA
  iPad -> HTTP -> server C -> received
                  ^
                  |
            Tauri/Rust
                  ^
                  |
             React desktop

Il desktop NON avvia piu' server_http.exe. Il codice C viene compilato
nel backend Tauri e chiamato direttamente da Rust.

SVILUPPO
  1. Se modifichi web/src, esegui sync-web.bat dalla cartella principale.
  2. Se modifichi il C, prova il server standalone con server/avvia.bat.
  3. Per il pannello Windows:
       cd desktop
       npm install
       npm run tauri dev

BUILD WINDOWS
  cd desktop
  npm install
  npm run tauri build

Il binario e gli installer si trovano sotto:
  desktop/src-tauri/target/release/
  desktop/src-tauri/target/release/bundle/nsis/
  desktop/src-tauri/target/release/bundle/msi/

DATI
  La pagina web compilata viene inclusa nel bundle Tauri come risorsa.
  I file ricevuti vengono salvati nella cartella dati dell'app, non nella
  directory di installazione.
