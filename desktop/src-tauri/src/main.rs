#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use serde::Serialize;
use std::io;
use std::net::UdpSocket;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;
use std::process::Command;

#[cfg(target_os = "windows")]
unsafe extern "C" {
    fn http_server_start_with_dirs(
        port: i32,
        web_dir: *const std::ffi::c_char,
        upload_dir: *const std::ffi::c_char,
    ) -> i32;
    fn http_server_stop();
}

struct AppState(Mutex<bool>);

#[derive(Serialize)]
struct FileEntry {
    name: String,
    size: u64,
    modified: u64,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Preview {
    Text { content: String, truncated: bool },
    Image { mime: String, base64: String },
    Unsupported { extension: String, size: u64 },
}

const PORT: u16 = 5000;
const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "md", "json", "csv", "log", "c", "h", "js", "ts", "tsx", "jsx", "html", "css",
    "xml", "ini", "cfg", "yaml", "yml",
];
const IMAGE_EXTENSIONS: &[(&str, &str)] = &[
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
    ("bmp", "image/bmp"),
    ("svg", "image/svg+xml"),
];
const MAX_TEXT_PREVIEW_BYTES: usize = 50_000;
const MAX_IMAGE_PREVIEW_BYTES: u64 = 12 * 1024 * 1024;
#[tauri::command]
fn apri_cartella(app: tauri::AppHandle) -> Result<(), String> {
    // 1. Otteniamo il percorso dinamico usando la tua funzione web_dir
    let cartella = web_dir(&app)?; 
    let percorso = cartella.to_string_lossy().to_string();

    // 2. Apriamo il file manager in base al sistema operativo
    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(&percorso)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&percorso)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&percorso)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn get_local_ip() -> io::Result<String> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.connect("8.8.8.8:80")?;
    Ok(socket.local_addr()?.ip().to_string())
}

fn received_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Impossibile ottenere la cartella dati dell'app: {e}"))?
        .join("received");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Impossibile creare received: {e}"))?;
    Ok(dir)
}

fn web_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)]
    {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("server")
            .join("public");
        if !dir.is_dir() {
            return Err(format!("Cartella web non trovata: {}", dir.display()));
        }
        return Ok(dir);
    }

    #[cfg(not(debug_assertions))]
    {
        let dir = app
            .path()
            .resolve("public", BaseDirectory::Resource)
            .map_err(|e| format!("Impossibile trovare le risorse web: {e}"))?;
        if !dir.is_dir() {
            return Err(format!("Risorse web non trovate: {}", dir.display()));
        }
        Ok(dir)
    }
}

fn make_c_string(path: &PathBuf) -> Result<std::ffi::CString, String> {
    std::ffi::CString::new(path.to_string_lossy().as_bytes())
        .map_err(|_| format!("Percorso non valido: {}", path.display()))
}

#[tauri::command]
fn start_server(app: AppHandle, state: tauri::State<AppState>, port: Option<u16>) -> Result<String, String> {
    let port = port.unwrap_or(PORT);
    let mut running = state.0.lock().map_err(|e| e.to_string())?;

    if *running {
        return Err("Il server è già in esecuzione.".into());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = port;
        return Err("Il server C integrato è attualmente supportato da questa applicazione su Windows.".into());
    }

    #[cfg(target_os = "windows")]
    {
        let web = web_dir(&app)?;
        let upload = received_dir(&app)?;
        let web_c = make_c_string(&web)?;
        let upload_c = make_c_string(&upload)?;

        let result = unsafe {
            http_server_start_with_dirs(port as i32, web_c.as_ptr(), upload_c.as_ptr())
        };

        if result != 0 {
            return Err(format!("Impossibile avviare il server sulla porta {port}. La porta potrebbe essere già occupata."));
        }

        *running = true;
        let ip = get_local_ip().unwrap_or_else(|_| "127.0.0.1".to_string());
        Ok(format!("{ip}:{port}"))
    }
}

#[tauri::command]
fn stop_server(state: tauri::State<AppState>) -> Result<(), String> {
    let mut running = state.0.lock().map_err(|e| e.to_string())?;

    if !*running {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    unsafe {
        http_server_stop();
    }

    *running = false;
    Ok(())
}

#[tauri::command]
fn server_status(state: tauri::State<AppState>) -> Result<bool, String> {
    Ok(*state.0.lock().map_err(|e| e.to_string())?)
}

#[tauri::command]
fn list_received_files(app: AppHandle) -> Result<Vec<FileEntry>, String> {
    let dir = received_dir(&app)?;
    let mut entries = Vec::new();

    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let metadata = match entry.metadata() {
            Ok(m) if m.is_file() => m,
            _ => continue,
        };

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

#[tauri::command]
fn read_preview(app: AppHandle, name: String) -> Result<Preview, String> {
    if name.is_empty() || name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("Nome file non valido".into());
    }

    let path = received_dir(&app)?.join(&name);
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("Il percorso indicato non è un file".into());
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if TEXT_EXTENSIONS.contains(&extension.as_str()) {
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        let truncated = bytes.len() > MAX_TEXT_PREVIEW_BYTES;
        let content = String::from_utf8_lossy(&bytes[..bytes.len().min(MAX_TEXT_PREVIEW_BYTES)]).into_owned();
        return Ok(Preview::Text { content, truncated });
    }

    if let Some((_, mime)) = IMAGE_EXTENSIONS.iter().find(|(ext, _)| *ext == extension) {
        if metadata.len() > MAX_IMAGE_PREVIEW_BYTES {
            return Ok(Preview::Unsupported {
                extension,
                size: metadata.len(),
            });
        }
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        return Ok(Preview::Image {
            mime: mime.to_string(),
            base64: encoded,
        });
    }

    Ok(Preview::Unsupported {
        extension,
        size: metadata.len(),
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState(Mutex::new(false)))
        .invoke_handler(tauri::generate_handler![
            start_server,
            stop_server,
            server_status,
            list_received_files,
            read_preview,
            apri_cartella
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>();
                if let Ok(mut running) = state.0.lock() {
                    if *running {
                        #[cfg(target_os = "windows")]
                        unsafe {
                            http_server_stop();
                        }
                        *running = false;
                    }
                };
            }
        })
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione Tauri");
}
