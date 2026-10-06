import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App";

interface FileEntry {
  name: string;
  size: number;
  modified: number;
}

type Preview =
  | { kind: "text"; content: string; truncated: boolean }
  | { kind: "image"; mime: string; base64: string }
  | { kind: "unsupported"; extension: string; size: number };

const PORT = 5000;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toUpperCase() : "FILE";
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    refreshFiles();
    invoke<boolean>("server_status")
      .then((value) => setRunning(value))
      .catch(() => setRunning(false));
  }, []);

  useEffect(() => {
    if (running) {
      pollRef.current = window.setInterval(refreshFiles, 2000);
    }

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [running]);

  async function refreshFiles() {
    try {
      const list = await invoke<FileEntry[]>("list_received_files");
      setFiles(list);
    } catch (e) {
      setError(String(e));
    }
  }

  async function startServer() {
    setBusy(true);
    setError(null);

    try {
      const result = await invoke<string>("start_server", { port: PORT });
      setAddress(result);
      setRunning(true);
      await refreshFiles();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopServer() {
    setBusy(true);
    setError(null);

    try {
      await invoke("stop_server");
      setRunning(false);
      setAddress(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(name: string) {
    setSelected(name);
    setPreview(null);
    setPreviewLoading(true);
    setError(null);

    try {
      const result = await invoke<Preview>("read_preview", { name });
      setPreview(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  const handleApriCartella = async () => {
    try {
      // Il backend sa già quale cartella aprire, quindi non passiamo argomenti
      await invoke('apri_cartella');
    } catch (error) {
      console.error("Errore durante l'apertura della cartella:", error);
    }
  };

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">DESKTOP SERVER</div>
          <h1>File Transfer</h1>
          <p className="subtitle">Gestisci il server e i file ricevuti dal tuo PC.</p>
        </div>
        <div className={`server-badge ${running ? "online" : "offline"}`}>
          <span className="dot" />
          {running ? "Online" : "Offline"}
        </div>
      </header>

      <section className="server-card">
        <div className="server-main">
          <div className="section-label">SERVER HTTP</div>
          <h2>{running ? "Server attivo" : "Server fermo"}</h2>
          <p>
            {running
              ? "Il server è pronto a ricevere connessioni dalla rete locale."
              : "Avvia il server per permettere all'iPad di collegarsi."}
          </p>

          {running && address && (
            <div className="address-box">
              <span>INDIRIZZO DA APRIRE SU IPAD</span>
              <code>http://{address}</code>
            </div>
          )}

          <div className="button-row">
            <button className="primary" onClick={startServer} disabled={busy || running}>
              {busy && !running ? "Avvio..." : "Avvia server"}
            </button>
            <button className="danger" onClick={stopServer} disabled={busy || !running}>
              Ferma server
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </div>

        <div className="server-info">
          <div className="info-item">
            <span>PORTA</span>
            <strong>{PORT}</strong>
          </div>
          <div className="info-item">
            <span>PROTOCOLLO</span>
            <strong>HTTP</strong>
          </div>
          <div className="info-item">
            <span>FILE</span>
            <strong>{files.length}</strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="card files-card">
          <div className="card-heading">
            <div>
              <div className="section-label">ARCHIVIO</div>
              <h2>File ricevuti</h2>
            </div>
            <button className="secondary small" onClick={refreshFiles} disabled={busy}>
              Aggiorna
            </button>
            <button onClick={handleApriCartella} className="secondary small">
              Apri cartella file
            </button>
          </div>

          {files.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">↧</div>
              <strong>Nessun file ricevuto</strong>
              <span>I file inviati dall'iPad appariranno qui.</span>
            </div>
          ) : (
            <ul className="file-list">
              {files.map((file) => (
                <li
                  key={file.name}
                  className={file.name === selected ? "selected" : ""}
                  onClick={() => openPreview(file.name)}
                >
                  <div className="file-icon">{extensionOf(file.name).slice(0, 4)}</div>
                  <div className="file-details">
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      {formatSize(file.size)} · {formatDate(file.modified)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card preview-card">
          <div className="card-heading">
            <div>
              <div className="section-label">VISUALIZZATORE</div>
              <h2>Anteprima</h2>
            </div>
            {selected && <span className="preview-name">{selected}</span>}
          </div>

          {!selected && (
            <div className="empty-state preview-empty">
              <div className="empty-icon">□</div>
              <strong>Nessun file selezionato</strong>
              <span>Seleziona un file per visualizzarne l'anteprima.</span>
            </div>
          )}

          {selected && previewLoading && <div className="loading">Caricamento anteprima...</div>}

          {selected && preview?.kind === "text" && (
            <>
              <pre className="preview-text">{preview.content}</pre>
              {preview.truncated && <p className="muted">Anteprima limitata ai primi 50 KB.</p>}
            </>
          )}

          {selected && preview?.kind === "image" && (
            <div className="image-frame">
              <img
                className="preview-image"
                src={`data:${preview.mime};base64,${preview.base64}`}
                alt={selected}
              />
            </div>
          )}

          {selected && preview?.kind === "unsupported" && (
            <div className="unsupported">
              <div className="unsupported-icon">{extensionOf(selected)}</div>
              <strong>Anteprima non disponibile</strong>
              <span>
                File {preview.extension || "senza estensione"} · {formatSize(preview.size)}
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
