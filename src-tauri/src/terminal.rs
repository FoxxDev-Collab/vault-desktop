use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, State};

/// Represents an active terminal session
struct TerminalSession {
    pty_pair: PtyPair,
    writer: Box<dyn Write + Send>,
    pid: Option<u32>,
}

/// Manages all terminal sessions
pub struct TerminalManager {
    sessions: Mutex<HashMap<String, TerminalSession>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        TerminalManager {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Spawn a new shell process
#[tauri::command]
pub fn spawn_shell(
    app: AppHandle,
    state: State<Arc<TerminalManager>>,
    id: String,
    working_dir: Option<String>,
    shell_type: Option<String>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pty_pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine shell command based on shell_type or OS default
    let shell = if let Some(st) = shell_type {
        match st.as_str() {
            "powershell" => "powershell.exe".to_string(),
            "pwsh" => "pwsh.exe".to_string(), // PowerShell Core
            "cmd" => "cmd.exe".to_string(),
            "bash" => "bash.exe".to_string(), // Git Bash or WSL
            "wsl" => "wsl.exe".to_string(),
            _ => {
                #[cfg(target_os = "windows")]
                { std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()) }
                #[cfg(not(target_os = "windows"))]
                { std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string()) }
            }
        }
    } else {
        #[cfg(target_os = "windows")]
        { std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()) }
        #[cfg(not(target_os = "windows"))]
        { std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string()) }
    };

    let mut cmd = CommandBuilder::new(&shell);

    // Set working directory if provided
    if let Some(dir) = working_dir {
        cmd.cwd(dir);
    }

    // Spawn the child process
    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get the process ID
    let pid = child.process_id();

    // Get reader and writer
    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Store session
    {
        let mut sessions = state.sessions.lock();
        sessions.insert(
            id.clone(),
            TerminalSession {
                pty_pair,
                writer,
                pid,
            },
        );
    }

    // Spawn a thread to read output and emit events
    let terminal_id = id.clone();
    thread::spawn(move || {
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    // EOF - terminal closed
                    let _ = app.emit("terminal-output", serde_json::json!({
                        "id": terminal_id,
                        "data": "",
                        "closed": true
                    }));
                    break;
                }
                Ok(n) => {
                    // Convert to string (handle invalid UTF-8 gracefully)
                    let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = app.emit("terminal-output", serde_json::json!({
                        "id": terminal_id,
                        "data": data,
                        "closed": false
                    }));
                }
                Err(e) => {
                    log::error!("Terminal read error: {}", e);
                    let _ = app.emit("terminal-output", serde_json::json!({
                        "id": terminal_id,
                        "data": format!("\r\n[Error: {}]\r\n", e),
                        "closed": true
                    }));
                    break;
                }
            }
        }
    });

    Ok(())
}

/// Write data to a terminal
#[tauri::command]
pub fn write_shell(
    state: State<Arc<TerminalManager>>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| "Terminal session not found".to_string())?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to terminal: {}", e))?;

    session
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush terminal: {}", e))?;

    Ok(())
}

/// Resize a terminal
#[tauri::command]
pub fn resize_shell(
    state: State<Arc<TerminalManager>>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&id)
        .ok_or_else(|| "Terminal session not found".to_string())?;

    session
        .pty_pair
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize terminal: {}", e))?;

    Ok(())
}

/// Kill a terminal session
#[tauri::command]
pub fn kill_shell(state: State<Arc<TerminalManager>>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    if sessions.remove(&id).is_some() {
        // Session removed, PTY will be dropped and process killed
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

/// Get the PID for a terminal session
#[tauri::command]
pub fn get_shell_pid(state: State<Arc<TerminalManager>>, id: String) -> Result<Option<u32>, String> {
    let sessions = state.sessions.lock();
    match sessions.get(&id) {
        Some(session) => Ok(session.pid),
        None => Err("Terminal session not found".to_string()),
    }
}
