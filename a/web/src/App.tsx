import { useRef, useState } from "react";

// Una voce dello storico trasferimenti mostrato in fondo alla pagina
interface TransferLogEntry {
  id: number;
  fileName: string;
  status: "in corso" | "completato" | "errore";
  progress: number; // 0-100
}

// Se questa pagina è aperta direttamente dal server C (es. l'iPad è andato
// su http://192.168.1.25:5000/), il browser la carica da quello stesso
// indirizzo: possiamo leggerlo da window.location ed evitare di doverlo
// digitare a mano. Durante lo sviluppo con "npm run dev" (porta 5173),
// questo indirizzo non è quello giusto, quindi in quel caso si torna al
// valore di default e l'IP va scritto manualmente.
function guessServerIp(): string {
  const host = window.location.hostname;
  return host && host !== "localhost" && host !== "127.0.0.1" ? host : "192.168.1.25";
}

function guessServerPort(): string {
  const port = window.location.port;
  return port && port !== "5173" ? port : "5000";
}

export default function App() {
  // Indirizzo e porta del PC su cui gira server_http.exe.
  const [serverIp, setServerIp] = useState(guessServerIp);
  const [serverPort, setServerPort] = useState(guessServerPort);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [log, setLog] = useState<TransferLogEntry[]>([]);
  const nextId = useRef(1);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function updateEntry(id: number, changes: Partial<TransferLogEntry>) {
    setLog((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry))
    );
  }

  function uploadFile() {
    if (!selectedFile) return;

    const id = nextId.current++;
    const entry: TransferLogEntry = {
      id,
      fileName: selectedFile.name,
      status: "in corso",
      progress: 0
    };
    setLog((prev) => [entry, ...prev]);

    // Usiamo XMLHttpRequest invece di fetch perché espone l'evento
    // "progress" durante l'invio, che ci serve per la barra di avanzamento.
    // fetch con ReadableStream lo permetterebbe solo con più codice.
    const xhr = new XMLHttpRequest();
    const url = `http://${serverIp}:${serverPort}/upload`;

    xhr.open("POST", url);

    // Mandiamo il file "grezzo" nel corpo della richiesta (niente
    // multipart/form-data): il server in C legge Content-Length e poi
    // legge esattamente quel numero di byte. È più semplice da parsare
    // in C rispetto al formato multipart usato dai form HTML classici.
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(selectedFile.name));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        updateEntry(id, { progress: percent });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateEntry(id, { status: "completato", progress: 100 });
      } else {
        updateEntry(id, { status: "errore" });
      }
    };

    xhr.onerror = () => {
      // Scatta anche per un rifiuto di rete (server spento, IP sbagliato,
      // firewall che blocca la porta): il messaggio del browser non
      // distingue questi casi, quindi teniamo il messaggio generico.
      updateEntry(id, { status: "errore" });
    };

    xhr.send(selectedFile);
  }

  return (
    <div className="page">
      <h1>File Transfer</h1>

      <section className="card">
        <h2>Server</h2>
        <div className="row">
          <label htmlFor="ip">Indirizzo IP</label>
          <input
            id="ip"
            type="text"
            value={serverIp}
            onChange={(e) => setServerIp(e.target.value)}
            placeholder="192.168.1.25"
          />
        </div>
        <div className="row">
          <label htmlFor="port">Porta</label>
          <input
            id="port"
            type="text"
            value={serverPort}
            onChange={(e) => setServerPort(e.target.value)}
            placeholder="5000"
          />
        </div>
      </section>

      <section className="card">
        <h2>Invia un file</h2>
        <input type="file" onChange={handleFileChange} />
        <button onClick={uploadFile} disabled={!selectedFile}>
          Invia
        </button>
      </section>

      <section className="card">
        <h2>Trasferimenti</h2>
        {log.length === 0 && <p className="muted">Nessun trasferimento ancora.</p>}
        <ul className="transfer-list">
          {log.map((entry) => (
            <li key={entry.id}>
              <div className="transfer-name">{entry.fileName}</div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${entry.status}`}
                  style={{ width: `${entry.progress}%` }}
                />
              </div>
              <div className={`transfer-status ${entry.status}`}>
                {entry.status} {entry.status === "in corso" && `(${entry.progress}%)`}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
