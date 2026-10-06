import { useEffect, useRef, useState } from "react";

// Una voce dello storico trasferimenti mostrato in fondo alla pagina
interface TransferLogEntry {
  id: number;
  fileName: string;
  status: "in corso" | "completato" | "errore";
  progress: number; // 0-100
}

type Theme = "light" | "dark";

// Se questa pagina è aperta direttamente dal server C (es. l'iPad è andato
// su http://192.168.1.25:5000/), il browser la carica da quello stesso
// indirizzo: possiamo leggerlo da window.location ed evitare di doverlo
// digitare a mano. Durante lo sviluppo con "npm run dev" (porta 5173),
// questo indirizzo non è quello giusto, quindi in quel caso si torna al
// valore di default e l'IP va scritto manualmente.
function guessServerIp(): string {
  const host = window.location.hostname;
  return host && host !== "localhost" && host !== "127.0.0.1"
    ? host
    : "192.168.1.25";
}

function guessServerPort(): string {
  const port = window.location.port;
  return port && port !== "5173" ? port : "5000";
}

function guessTheme(): Theme {
  const saved = localStorage.getItem("file-transfer-theme");

  if (saved === "dark" || saved === "light") {
    return saved;
  }

  return "light";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function App() {
  // Indirizzo e porta del PC su cui gira server_http.exe.
  const [serverIp, setServerIp] = useState(guessServerIp);
  const [serverPort, setServerPort] = useState(guessServerPort);

  // Ora possiamo selezionare più file nello stesso momento.
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [log, setLog] = useState<TransferLogEntry[]>([]);
  const [theme, setTheme] = useState<Theme>(guessTheme);

  const nextId = useRef(1);

  useEffect(() => {
    localStorage.setItem("file-transfer-theme", theme);
  }, [theme]);

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const newFiles = Array.from(e.target.files ?? []);

    setSelectedFiles(newFiles);

    // Permette di scegliere di nuovo lo stesso file dopo averlo rimosso.
    e.currentTarget.value = "";
  }

  function removeSelectedFile(indexToRemove: number) {
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);
  }

  function updateEntry(
    id: number,
    changes: Partial<TransferLogEntry>
  ) {
    setLog((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, ...changes }
          : entry
      )
    );
  }

  function uploadFile(file: File, id: number) {
    // Usiamo XMLHttpRequest invece di fetch perché espone l'evento
    // "progress" durante l'invio, che ci serve per la barra di avanzamento.
    const xhr = new XMLHttpRequest();

    const url = `http://${serverIp}:${serverPort}/upload`;

    xhr.open("POST", url);

    // Mandiamo il file "grezzo" nel corpo della richiesta (niente
    // multipart/form-data): il server in C legge Content-Length e poi
    // legge esattamente quel numero di byte.
    xhr.setRequestHeader(
      "Content-Type",
      "application/octet-stream"
    );

    xhr.setRequestHeader(
      "X-File-Name",
      encodeURIComponent(file.name)
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round(
          (event.loaded / event.total) * 100
        );

        updateEntry(id, {
          progress: percent,
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateEntry(id, {
          status: "completato",
          progress: 100,
        });
      } else {
        updateEntry(id, {
          status: "errore",
        });
      }
    };

    xhr.onerror = () => {
      // Scatta anche per un rifiuto di rete (server spento, IP sbagliato,
      // firewall che blocca la porta): il messaggio del browser non
      // distingue questi casi, quindi teniamo il messaggio generico.
      updateEntry(id, {
        status: "errore",
      });
    };

    xhr.send(file);
  }

  function uploadFiles() {
    if (selectedFiles.length === 0) {
      return;
    }

    const entries = selectedFiles.map((file) => ({
      id: nextId.current++,
      fileName: file.name,
      status: "in corso" as const,
      progress: 0,
    }));

    // Inseriamo tutte le righe prima di avviare gli upload, così l'utente
    // vede immediatamente l'intera coda.
    setLog((prev) => [
      ...entries.slice().reverse(),
      ...prev,
    ]);

    const filesToSend = [...selectedFiles];

    setSelectedFiles([]);

    // Le richieste partono senza attendere la precedente: i file vengono
    // quindi trasferiti contemporaneamente e ognuno ha la propria progress bar.
    entries.forEach((entry, index) => {
      uploadFile(filesToSend[index], entry.id);
    });
  }

  const transferButtonLabel =
    selectedFiles.length === 0
      ? "Seleziona i file"
      : selectedFiles.length === 1
        ? "Invia 1 file"
        : `Invia ${selectedFiles.length} file`;

  return (
    <div className={`app ${theme}`}>
      <div className="page">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              FILE TRANSFER
            </div>

            <h1>Invia file</h1>

            <p className="subtitle">
              Trasferisci uno o più file direttamente al tuo PC.
            </p>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() =>
              setTheme((current) =>
                current === "light"
                  ? "dark"
                  : "light"
              )
            }
            aria-label={`Passa al tema ${
              theme === "light"
                ? "scuro"
                : "chiaro"
            }`}
            title={`Tema ${
              theme === "light"
                ? "scuro"
                : "chiaro"
            }`}
          >
            <span
              className="theme-icon"
              aria-hidden="true"
            >
              {theme === "light" ? "☾" : "☀"}
            </span>

            <span>
              {theme === "light"
                ? "Scuro"
                : "Chiaro"}
            </span>
          </button>
        </header>

        <section className="card server-card">
          <div className="card-heading">
            <div>
              <div className="section-label">
                CONNESSIONE
              </div>

              <h2>Server</h2>
            </div>

            <span className="server-dot" />
          </div>

          <div className="row">
            <label htmlFor="ip">
              Indirizzo IP
            </label>

            <input
              id="ip"
              type="text"
              value={serverIp}
              onChange={(e) =>
                setServerIp(e.target.value)
              }
              placeholder="192.168.1.25"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="row">
            <label htmlFor="port">
              Porta
            </label>

            <input
              id="port"
              type="text"
              inputMode="numeric"
              value={serverPort}
              onChange={(e) =>
                setServerPort(e.target.value)
              }
              placeholder="5000"
              autoComplete="off"
            />
          </div>
        </section>

        <section className="card upload-card">
          <div className="card-heading">
            <div>
              <div className="section-label">
                TRASFERIMENTO
              </div>

              <h2>Invia file</h2>
            </div>

            {selectedFiles.length > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={clearSelectedFiles}
              >
                Svuota
              </button>
            )}
          </div>

          <label className="file-picker">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
            />

            <span
              className="file-picker-icon"
              aria-hidden="true"
            >
              ＋
            </span>

            <span>
              <strong>Scegli file</strong>

              <small>
                Puoi selezionarne più di uno
                contemporaneamente
              </small>
            </span>
          </label>

          {selectedFiles.length > 0 && (
            <div className="selected-files">
              <div className="selected-header">
                <span>
                  {selectedFiles.length}{" "}
                  {selectedFiles.length === 1
                    ? "file selezionato"
                    : "file selezionati"}
                </span>

                <span className="selected-size">
                  {formatFileSize(
                    selectedFiles.reduce(
                      (total, file) =>
                        total + file.size,
                      0
                    )
                  )}
                </span>
              </div>

              <ul className="selected-list">
                {selectedFiles.map(
                  (file, index) => (
                    <li
                      key={`${file.name}-${file.lastModified}-${index}`}
                    >
                      <div className="selected-file-info">
                        <span className="selected-file-name">
                          {file.name}
                        </span>

                        <span className="selected-file-size">
                          {formatFileSize(
                            file.size
                          )}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="remove-button"
                        onClick={() =>
                          removeSelectedFile(index)
                        }
                        aria-label={`Rimuovi ${file.name}`}
                      >
                        ×
                      </button>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="send-button"
            onClick={uploadFiles}
            disabled={selectedFiles.length === 0}
          >
            {transferButtonLabel}
          </button>
        </section>

        <section className="card">
          <div className="card-heading">
            <div>
              <div className="section-label">
                ATTIVITÀ
              </div>

              <h2>Trasferimenti</h2>
            </div>

            {log.length > 0 && (
              <span className="transfer-count">
                {log.length}
              </span>
            )}
          </div>

          {log.length === 0 && (
            <p className="muted">
              Nessun trasferimento ancora.
            </p>
          )}

          {log.length > 0 && (
            <ul className="transfer-list">
              {log.map((entry) => (
                <li key={entry.id}>
                  <div className="transfer-topline">
                    <div className="transfer-name">
                      {entry.fileName}
                    </div>

                    <div
                      className={`transfer-status ${entry.status.replace(
                        " ",
                        "-"
                      )}`}
                    >
                      {entry.status ===
                        "in corso" &&
                        `${entry.progress}%`}

                      {entry.status ===
                        "completato" &&
                        "Completato"}

                      {entry.status ===
                        "errore" &&
                        "Errore"}
                    </div>
                  </div>

                  <div
                    className="progress-bar"
                    aria-hidden="true"
                  >
                    <div
                      className={`progress-fill ${entry.status.replace(
                        " ",
                        "-"
                      )}`}
                      style={{
                        width: `${entry.progress}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}