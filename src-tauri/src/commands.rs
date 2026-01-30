use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use walkdir::WalkDir;

use crate::database::{Database, Note, FileEntry, SearchResult as DbSearchResult, QueryResult, Task, Project};

// ============================================================================
// Security Helpers
// ============================================================================

/// Validate that a relative path doesn't escape the base directory (path traversal protection)
fn validate_relative_path(relative_path: &str) -> Result<(), String> {
    // Check for obvious path traversal attempts
    if relative_path.contains("..") {
        return Err("Invalid path: path traversal not allowed".to_string());
    }
    // Check for absolute paths on various platforms
    if relative_path.starts_with('/') || relative_path.starts_with('\\') {
        return Err("Invalid path: absolute paths not allowed".to_string());
    }
    // Windows drive letters
    if relative_path.len() >= 2 && relative_path.chars().nth(1) == Some(':') {
        return Err("Invalid path: absolute paths not allowed".to_string());
    }
    Ok(())
}

/// Validate that a resolved path is still within the vault directory
fn validate_path_within_vault(vault_path: &Path, full_path: &Path) -> Result<(), String> {
    let canonical_vault = vault_path.canonicalize()
        .map_err(|_| "Invalid vault path".to_string())?;

    // For new files that don't exist yet, check the parent directory
    let path_to_check = if full_path.exists() {
        full_path.canonicalize()
            .map_err(|_| "Invalid file path".to_string())?
    } else if let Some(parent) = full_path.parent() {
        if parent.exists() {
            let canonical_parent = parent.canonicalize()
                .map_err(|_| "Invalid parent path".to_string())?;
            canonical_parent.join(full_path.file_name().unwrap_or_default())
        } else {
            // Parent doesn't exist either, validate the relative components
            return Ok(()); // Will be created, rely on relative path validation
        }
    } else {
        return Err("Invalid path structure".to_string());
    };

    if !path_to_check.starts_with(&canonical_vault) {
        return Err("Access denied: path outside vault".to_string());
    }

    Ok(())
}

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: DateTime<Utc>,
    pub last_opened: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub extension: Option<String>,
    pub children: Option<Vec<FileNode>>,
    pub modified: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub name: String,
    #[serde(rename = "match")]
    pub match_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub vaults: Vec<Vault>,
    pub active_vault_id: Option<String>,
    pub settings: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub content: Option<String>,
    pub binary: bool,
    pub data: Option<String>,
    pub path: String,
}

// ============================================================================
// State Management
// ============================================================================

pub struct AppState {
    config: Mutex<AppConfig>,
    config_path: PathBuf,
    database: Mutex<Option<Database>>,
}

impl AppState {
    pub fn new() -> Self {
        let config_path = get_config_path();
        let config = load_config(&config_path).unwrap_or_default();
        AppState {
            config: Mutex::new(config),
            config_path,
            database: Mutex::new(None),
        }
    }

    fn save(&self) -> Result<(), String> {
        let config = self.config.lock().map_err(|e| e.to_string())?;
        save_config(&self.config_path, &config)
    }

    fn get_db(&self) -> Result<std::sync::MutexGuard<Option<Database>>, String> {
        self.database.lock().map_err(|e| e.to_string())
    }
}

fn get_config_path() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("com", "foxxcyber", "vault") {
        let config_dir = proj_dirs.config_dir();
        fs::create_dir_all(config_dir).ok();
        config_dir.join("config.json")
    } else {
        PathBuf::from("vault_config.json")
    }
}

fn load_config(path: &Path) -> Result<AppConfig, String> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_config(path: &Path, config: &AppConfig) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

// ============================================================================
// Vault Management Commands
// ============================================================================

#[tauri::command]
pub fn get_vaults(state: State<AppState>) -> Result<Vec<Vault>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.vaults.clone())
}

#[tauri::command]
pub fn get_active_vault(state: State<AppState>) -> Result<Option<Vault>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(ref active_id) = config.active_vault_id {
        Ok(config.vaults.iter().find(|v| &v.id == active_id).cloned())
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn add_vault(state: State<AppState>, name: String, path: String) -> Result<Vault, String> {
    if !Path::new(&path).exists() {
        return Err("Path does not exist".to_string());
    }

    let vault = Vault {
        id: uuid_v4(),
        name,
        path,
        created_at: Utc::now(),
        last_opened: None,
    };

    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.vaults.push(vault.clone());
        if config.active_vault_id.is_none() {
            config.active_vault_id = Some(vault.id.clone());
        }
    }

    state.save()?;
    Ok(vault)
}

#[tauri::command]
pub fn remove_vault(state: State<AppState>, vault_id: String) -> Result<(), String> {
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.vaults.retain(|v| v.id != vault_id);
        if config.active_vault_id.as_ref() == Some(&vault_id) {
            config.active_vault_id = config.vaults.first().map(|v| v.id.clone());
        }
    }
    state.save()
}

#[tauri::command]
pub fn set_active_vault(state: State<AppState>, vault_id: String) -> Result<Vault, String> {
    let vault = {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        let vault_idx = config.vaults.iter()
            .position(|v| v.id == vault_id)
            .ok_or("Vault not found")?;
        config.vaults[vault_idx].last_opened = Some(Utc::now());
        config.active_vault_id = Some(vault_id);
        config.vaults[vault_idx].clone()
    };
    state.save()?;
    Ok(vault)
}

#[tauri::command]
pub fn update_vault(state: State<AppState>, vault_id: String, name: String) -> Result<Vault, String> {
    let vault = {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        let vault_idx = config.vaults.iter()
            .position(|v| v.id == vault_id)
            .ok_or("Vault not found")?;
        config.vaults[vault_idx].name = name;
        config.vaults[vault_idx].clone()
    };
    state.save()?;
    Ok(vault)
}

// ============================================================================
// File Tree Commands
// ============================================================================

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "md", "txt", "json", "yaml", "yml", "csv", "xlsx", "xls", "docx", "doc", "pdf",
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "tif", "svg",
    "mp4", "webm", "ogv", "mov", "avi", "mkv",
    "mp3", "wav", "ogg", "oga", "flac", "aac", "m4a",
    "js", "jsx", "ts", "tsx", "mjs", "cjs",
    "html", "htm", "css", "scss", "less", "sass", "vue", "svelte", "astro",
    "py", "rb", "go", "rs", "java", "kt", "scala", "c", "cpp", "h", "hpp", "cs", "php", "swift",
    "sql", "graphql", "gql", "prisma", "toml", "ini", "conf", "env", "xml",
    "sh", "bash", "zsh", "ps1", "bat", "cmd",
    "dockerfile", "makefile", "gitignore", "editorconfig",
    "mermaid", "mmd", "excalidraw",
];

const BINARY_EXTENSIONS: &[&str] = &[
    "xlsx", "xls", "docx", "doc", "pdf",
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "tiff", "tif",
    "mp4", "webm", "ogv", "mov", "avi", "mkv",
    "mp3", "wav", "ogg", "oga", "flac", "aac", "m4a",
];

#[tauri::command]
pub fn get_file_tree(state: State<AppState>) -> Result<(Vec<FileNode>, String), String> {
    let vault_path = get_vault_path(&state)?;
    let tree = build_file_tree(&vault_path, &vault_path)?;
    Ok((tree, vault_path))
}

fn build_file_tree(vault_path: &str, current_path: &str) -> Result<Vec<FileNode>, String> {
    let mut nodes: Vec<FileNode> = Vec::new();
    let entries = fs::read_dir(current_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files, node_modules, and Windows reserved device names
        let lower_name = name.to_lowercase();
        let base_name = lower_name.split('.').next().unwrap_or(&lower_name);
        let reserved_names = ["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4",
                              "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2",
                              "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"];

        if name.starts_with('.') || name == "node_modules" || name == "bun"
           || reserved_names.contains(&base_name) {
            continue;
        }

        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        let relative_path = path.strip_prefix(vault_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if metadata.is_dir() {
            let children = build_file_tree(vault_path, path.to_str().unwrap_or(""))?;
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                relative_path,
                node_type: "folder".to_string(),
                extension: None,
                children: Some(children),
                modified: Some(format_system_time(metadata.modified().ok())),
                size: None,
            });
        } else {
            let ext = path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            if SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
                nodes.push(FileNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    relative_path,
                    node_type: "file".to_string(),
                    extension: Some(ext),
                    children: None,
                    modified: Some(format_system_time(metadata.modified().ok())),
                    size: Some(metadata.len()),
                });
            }
        }
    }

    nodes.sort_by(|a, b| {
        if a.node_type != b.node_type {
            if a.node_type == "folder" { std::cmp::Ordering::Less }
            else { std::cmp::Ordering::Greater }
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(nodes)
}

fn format_system_time(time: Option<std::time::SystemTime>) -> String {
    time.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| {
            DateTime::from_timestamp(d.as_secs() as i64, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        })
        .unwrap_or_default()
}

// ============================================================================
// File Operations Commands
// ============================================================================

#[tauri::command]
pub fn read_file(path: String) -> Result<FileContent, String> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err("File not found".to_string());
    }

    let ext = path_obj.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let is_binary = BINARY_EXTENSIONS.contains(&ext.as_str());

    if is_binary {
        let mut file = File::open(&path).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        Ok(FileContent {
            content: None,
            binary: true,
            data: Some(BASE64.encode(&buffer)),
            path,
        })
    } else {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(FileContent {
            content: Some(content),
            binary: false,
            data: None,
            path,
        })
    }
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    if let Some(parent) = path_obj.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(state: State<AppState>, relative_path: String, content: Option<String>) -> Result<String, String> {
    // Validate path for security
    validate_relative_path(&relative_path)?;

    let vault_path = get_vault_path(&state)?;
    let vault_path_obj = Path::new(&vault_path);
    let full_path = vault_path_obj.join(&relative_path);

    // Validate the resolved path is within vault
    validate_path_within_vault(vault_path_obj, &full_path)?;

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut final_path = full_path.clone();
    let mut counter = 1;
    while final_path.exists() {
        let stem = full_path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let ext = full_path.extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();
        let parent = full_path.parent().unwrap_or(Path::new(""));
        final_path = parent.join(format!("{} {}{}", stem, counter, ext));
        counter += 1;
    }

    fs::write(&final_path, content.unwrap_or_default()).map_err(|e| e.to_string())?;
    Ok(final_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_folder(state: State<AppState>, relative_path: String) -> Result<String, String> {
    // Validate path for security
    validate_relative_path(&relative_path)?;

    let vault_path = get_vault_path(&state)?;
    let vault_path_obj = Path::new(&vault_path);
    let full_path = vault_path_obj.join(&relative_path);

    // Validate the resolved path is within vault
    validate_path_within_vault(vault_path_obj, &full_path)?;

    let mut final_path = full_path.clone();
    let mut counter = 1;
    while final_path.exists() {
        final_path = PathBuf::from(format!("{} {}", full_path.display(), counter));
        counter += 1;
    }

    fs::create_dir_all(&final_path).map_err(|e| e.to_string())?;
    Ok(final_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_item(path: String) -> Result<(), String> {
    let path_obj = Path::new(&path);
    if path_obj.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn move_item(old_path: String, new_path: String) -> Result<(), String> {
    let new_path_obj = Path::new(&new_path);
    if let Some(parent) = new_path_obj.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

// ============================================================================
// Search Command
// ============================================================================

#[tauri::command]
pub fn search_vault(state: State<AppState>, query: String, search_content: bool) -> Result<Vec<SearchResult>, String> {
    let vault_path = get_vault_path(&state)?;
    let lower_query = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') || name == "node_modules" {
            continue;
        }

        let relative_path = path.strip_prefix(&vault_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if path.is_dir() {
            if name.to_lowercase().contains(&lower_query) {
                results.push(SearchResult {
                    path: path.to_string_lossy().to_string(),
                    relative_path,
                    name,
                    match_text: None,
                });
            }
            continue;
        }

        let ext = path.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        if BINARY_EXTENSIONS.contains(&ext.as_str()) || !SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        if name.to_lowercase().contains(&lower_query) {
            results.push(SearchResult {
                path: path.to_string_lossy().to_string(),
                relative_path,
                name,
                match_text: None,
            });
        } else if search_content {
            if let Ok(content) = fs::read_to_string(path) {
                let lower_content = content.to_lowercase();
                if let Some(idx) = lower_content.find(&lower_query) {
                    let start = idx.saturating_sub(40);
                    let end = (idx + query.len() + 40).min(content.len());
                    let mut match_text = content[start..end].replace('\n', " ");
                    if start > 0 { match_text = format!("...{}", match_text); }
                    if end < content.len() { match_text = format!("{}...", match_text); }
                    results.push(SearchResult {
                        path: path.to_string_lossy().to_string(),
                        relative_path,
                        name,
                        match_text: Some(match_text),
                    });
                }
            }
        }

        if results.len() >= 50 { break; }
    }

    Ok(results)
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<HashMap<String, serde_json::Value>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.settings.clone())
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: HashMap<String, serde_json::Value>) -> Result<(), String> {
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.settings = settings;
    }
    state.save()
}

// ============================================================================
// Helpers
// ============================================================================

fn get_vault_path(state: &State<AppState>) -> Result<String, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let active_id = config.active_vault_id.as_ref().ok_or("No active vault")?;
    let vault = config.vaults.iter()
        .find(|v| &v.id == active_id)
        .ok_or("Active vault not found")?;
    Ok(vault.path.clone())
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let timestamp = duration.as_nanos();
    format!("{:032x}", timestamp)
}

// ============================================================================
// Database Commands
// ============================================================================

/// Initialize the database for the current vault
#[tauri::command]
pub fn db_init(state: State<AppState>) -> Result<(), String> {
    let vault_path = get_vault_path(&state)?;
    let db_path = Path::new(&vault_path).join(".vault.db");

    let db = Database::open(&db_path)?;

    let mut db_lock = state.get_db()?;
    *db_lock = Some(db);

    Ok(())
}

/// Determine file type from extension
fn get_file_type_from_ext(ext: &str) -> &'static str {
    match ext {
        "md" | "txt" | "rtf" => "document",
        "json" | "yaml" | "yml" | "toml" | "xml" => "data",
        "js" | "jsx" | "ts" | "tsx" | "py" | "rs" | "go" | "java" | "c" | "cpp" | "h" | "cs" | "rb" | "php" | "sh" | "bash" | "ps1" | "sql" => "code",
        "html" | "htm" | "css" | "scss" | "less" | "vue" | "svelte" => "web",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" => "image",
        "mp4" | "webm" | "avi" | "mov" | "mkv" | "wmv" => "video",
        "mp3" | "wav" | "ogg" | "flac" | "aac" | "m4a" => "audio",
        "pdf" => "pdf",
        "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp" => "office",
        "zip" | "rar" | "7z" | "tar" | "gz" => "archive",
        _ => "other",
    }
}

/// Index all files in the vault
#[tauri::command]
pub fn db_index_vault(state: State<AppState>) -> Result<HashMap<String, i32>, String> {
    let vault_path = get_vault_path(&state)?;
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;

    let mut counts: HashMap<String, i32> = HashMap::new();
    counts.insert("files".to_string(), 0);
    counts.insert("notes".to_string(), 0);

    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') || name == "node_modules" || name == "bun" {
            continue;
        }

        // Skip Windows reserved names
        let lower_name = name.to_lowercase();
        let base_name = lower_name.split('.').next().unwrap_or(&lower_name);
        let reserved_names = ["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4",
                             "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2",
                             "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"];
        if reserved_names.contains(&base_name) {
            continue;
        }

        if !path.is_file() {
            continue;
        }

        let ext = path.extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let file_type = get_file_type_from_ext(&ext);

        // Get file metadata
        let metadata = fs::metadata(path).ok();
        let size_bytes = metadata.as_ref().map(|m| m.len() as i64).unwrap_or(0);
        let modified = metadata.as_ref()
            .and_then(|m| m.modified().ok())
            .map(|t| chrono::DateTime::<Utc>::from(t).to_rfc3339())
            .unwrap_or_else(|| Utc::now().to_rfc3339());
        let created = metadata.as_ref()
            .and_then(|m| m.created().ok())
            .map(|t| chrono::DateTime::<Utc>::from(t).to_rfc3339())
            .unwrap_or_else(|| Utc::now().to_rfc3339());

        // Index file metadata
        let ext_opt = if ext.is_empty() { None } else { Some(ext.as_str()) };
        if db.index_file(
            &path.to_string_lossy(),
            &name,
            ext_opt,
            file_type,
            size_bytes,
            &created,
            &modified,
        ).is_ok() {
            *counts.get_mut("files").unwrap() += 1;
        }

        // For markdown files, also index content for FTS
        if ext == "md" {
            if let Ok(content) = fs::read_to_string(path) {
                if db.index_note(
                    &path.to_string_lossy(),
                    &name,
                    &content,
                    &modified,
                ).is_ok() {
                    *counts.get_mut("notes").unwrap() += 1;
                }
            }
        }
    }

    Ok(counts)
}

/// Full-text search using the database
#[tauri::command]
pub fn db_search(state: State<AppState>, query: String, limit: Option<i32>) -> Result<Vec<DbSearchResult>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.search(&query, limit.unwrap_or(20))
}

/// Get all notes with optional filtering
#[tauri::command]
pub fn db_get_notes(
    state: State<AppState>,
    filter: Option<String>,
    sort: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<Note>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_notes(filter.as_deref(), sort.as_deref(), limit)
}

/// Get notes by tag
#[tauri::command]
pub fn db_get_notes_by_tag(state: State<AppState>, tag: String) -> Result<Vec<Note>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_notes_by_tag(&tag)
}

/// Get all tags with counts
#[tauri::command]
pub fn db_get_tags(state: State<AppState>) -> Result<Vec<(String, i64)>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_tags()
}

/// Get backlinks for a note
#[tauri::command]
pub fn db_get_backlinks(state: State<AppState>, note_name: String) -> Result<Vec<Note>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_backlinks(&note_name)
}

/// Toggle favorite status for a note
#[tauri::command]
pub fn db_toggle_favorite(state: State<AppState>, path: String) -> Result<bool, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.toggle_favorite(&path)
}

/// Get all favorites
#[tauri::command]
pub fn db_get_favorites(state: State<AppState>) -> Result<Vec<String>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_favorites()
}

/// Add a file to recent files
#[tauri::command]
pub fn db_add_recent(state: State<AppState>, path: String, name: String) -> Result<(), String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.add_recent(&path, &name)
}

/// Get recent files
#[tauri::command]
pub fn db_get_recent(state: State<AppState>, limit: Option<i32>) -> Result<Vec<(String, String, String)>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_recent(limit.unwrap_or(10))
}

/// Execute a custom SQL query (SELECT only)
#[tauri::command]
pub fn db_query(state: State<AppState>, sql: String) -> Result<QueryResult, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.query(&sql)
}

/// Get database statistics
#[tauri::command]
pub fn db_get_stats(state: State<AppState>) -> Result<HashMap<String, i64>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_stats()
}

// ============================================================================
// File Metadata Commands
// ============================================================================

/// Get a file entry by path
#[tauri::command]
pub fn db_get_file(state: State<AppState>, path: String) -> Result<Option<FileEntry>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_file(&path)
}

/// Get files with optional filtering
#[tauri::command]
pub fn db_get_files(
    state: State<AppState>,
    file_type: Option<String>,
    extension: Option<String>,
    is_favorite: Option<bool>,
    sort: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<FileEntry>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_files(
        file_type.as_deref(),
        extension.as_deref(),
        is_favorite,
        sort.as_deref(),
        limit,
    )
}

/// Set custom metadata on a file
#[tauri::command]
pub fn db_set_file_metadata(
    state: State<AppState>,
    path: String,
    metadata: serde_json::Value,
) -> Result<(), String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.set_file_metadata(&path, &metadata)
}

/// Get custom metadata for a file
#[tauri::command]
pub fn db_get_file_metadata(state: State<AppState>, path: String) -> Result<Option<serde_json::Value>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_file_metadata(&path)
}

/// Add a tag to a file
#[tauri::command]
pub fn db_add_file_tag(state: State<AppState>, path: String, tag: String) -> Result<(), String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.add_file_tag(&path, &tag)
}

/// Remove a tag from a file
#[tauri::command]
pub fn db_remove_file_tag(state: State<AppState>, path: String, tag: String) -> Result<(), String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.remove_file_tag(&path, &tag)
}

/// Get tags for a file
#[tauri::command]
pub fn db_get_file_tags(state: State<AppState>, path: String) -> Result<Vec<String>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_file_tags(&path)
}

/// Get files by tag
#[tauri::command]
pub fn db_get_files_by_tag(state: State<AppState>, tag: String) -> Result<Vec<FileEntry>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_files_by_tag(&tag)
}

// ============================================================================
// Task Commands
// ============================================================================

/// Parse task frontmatter from .task.md content
fn parse_task_frontmatter(content: &str) -> HashMap<String, String> {
    let mut result = HashMap::new();

    if !content.starts_with("---") {
        return result;
    }

    if let Some(end_idx) = content[3..].find("---") {
        let yaml_str = &content[3..end_idx + 3];

        for line in yaml_str.lines() {
            let line = line.trim();
            if line.is_empty() || !line.contains(':') {
                continue;
            }

            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim().to_string();
                let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
                if !value.is_empty() {
                    result.insert(key, value);
                }
            }
        }
    }

    result
}

/// Extract title from task content (first # heading after frontmatter)
fn extract_task_title(content: &str) -> String {
    // Find content after frontmatter
    let body = if content.starts_with("---") {
        if let Some(end_idx) = content[3..].find("---") {
            &content[end_idx + 6..]
        } else {
            content
        }
    } else {
        content
    };

    // Find first # heading
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return trimmed[2..].trim().to_string();
        }
    }

    // Fallback: use first non-empty line
    for line in body.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            return trimmed.chars().take(50).collect();
        }
    }

    "Untitled Task".to_string()
}

/// Extract tags from frontmatter
fn extract_task_tags(frontmatter: &HashMap<String, String>) -> Vec<String> {
    if let Some(tags_str) = frontmatter.get("tags") {
        // Handle [tag1, tag2] or tag1, tag2 format
        let cleaned = tags_str.trim_start_matches('[').trim_end_matches(']');
        cleaned.split(',')
            .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        Vec::new()
    }
}

/// Index all tasks in the vault
#[tauri::command]
pub fn db_index_tasks(state: State<AppState>) -> Result<i32, String> {
    let vault_path = get_vault_path(&state)?;
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;

    let mut count = 0;

    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') || name == "node_modules" || name == "bun" {
            continue;
        }

        if !path.is_file() {
            continue;
        }

        // Only process .task.md files
        if !name.ends_with(".task.md") {
            continue;
        }

        if let Ok(content) = fs::read_to_string(path) {
            let frontmatter = parse_task_frontmatter(&content);
            let title = extract_task_title(&content);
            let tags = extract_task_tags(&frontmatter);

            let status = frontmatter.get("status").map(|s| s.as_str()).unwrap_or("todo");
            let priority = frontmatter.get("priority").map(|s| s.as_str()).unwrap_or("medium");
            let due_date = frontmatter.get("due").map(|s| s.as_str());
            let project_path = frontmatter.get("project").map(|s| s.as_str());
            let column_name = frontmatter.get("column").map(|s| s.as_str()).unwrap_or("backlog");
            let created = frontmatter.get("created").map(|s| s.clone())
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

            let metadata = fs::metadata(path).ok();
            let modified = metadata.as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| chrono::DateTime::<Utc>::from(t).to_rfc3339())
                .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

            if db.index_task(
                &path.to_string_lossy(),
                &title,
                status,
                priority,
                due_date,
                project_path,
                column_name,
                &tags,
                &created,
                &modified,
            ).is_ok() {
                count += 1;
            }
        }
    }

    Ok(count)
}

/// Get tasks with optional filtering
#[tauri::command]
pub fn db_get_tasks(
    state: State<AppState>,
    status: Option<String>,
    priority: Option<String>,
    project_path: Option<String>,
    column_name: Option<String>,
    due_before: Option<String>,
    due_after: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<Task>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_tasks(
        status.as_deref(),
        priority.as_deref(),
        project_path.as_deref(),
        column_name.as_deref(),
        due_before.as_deref(),
        due_after.as_deref(),
        limit,
    )
}

/// Get a single task by path
#[tauri::command]
pub fn db_get_task(state: State<AppState>, path: String) -> Result<Option<Task>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_task(&path)
}

/// Get tasks due today or overdue
#[tauri::command]
pub fn db_get_tasks_today(state: State<AppState>) -> Result<Vec<Task>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_tasks_today()
}

/// Get tasks due in the next N days
#[tauri::command]
pub fn db_get_tasks_upcoming(state: State<AppState>, days: Option<i32>) -> Result<Vec<Task>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_tasks_upcoming(days.unwrap_or(7))
}

/// Create a new task file
#[tauri::command]
pub fn task_create(
    state: State<AppState>,
    title: String,
    project_path: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    column: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<String, String> {
    let vault_path = get_vault_path(&state)?;

    // Generate filename from title
    let sanitized_title: String = title.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' { c } else { '_' })
        .collect();
    let filename = format!("{}.task.md", sanitized_title.trim().replace(' ', "_"));

    // Normalize project_path - treat empty string as None
    let project_path = project_path.filter(|p| !p.trim().is_empty());

    // Determine directory (project folder or 00_Inbox)
    let dir = if let Some(ref proj) = project_path {
        // If it's an absolute path, use it directly; otherwise join with vault path
        let proj_path = Path::new(proj);
        if proj_path.is_absolute() {
            proj_path.to_path_buf()
        } else {
            Path::new(&vault_path).join(proj.trim_start_matches('/'))
        }
    } else {
        Path::new(&vault_path).join("00_Inbox")
    };

    // Create directory if needed
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let file_path = dir.join(&filename);

    // Avoid overwriting existing files
    let mut final_path = file_path.clone();
    let mut counter = 1;
    while final_path.exists() {
        final_path = dir.join(format!("{}_{}.task.md", sanitized_title.trim().replace(' ', "_"), counter));
        counter += 1;
    }

    // Build frontmatter
    let now = chrono::Utc::now().to_rfc3339();
    let priority_str = priority.as_deref().unwrap_or("medium");
    let column_str = column.as_deref().unwrap_or("backlog");

    let mut frontmatter = format!(
        r#"---
status: todo
priority: {}
column: {}
created: {}
"#,
        priority_str, column_str, now
    );

    if let Some(due) = due_date {
        frontmatter.push_str(&format!("due: {}\n", due));
    }

    if let Some(ref proj) = project_path {
        frontmatter.push_str(&format!("project: {}\n", proj));
    }

    if let Some(ref t) = tags {
        if !t.is_empty() {
            frontmatter.push_str(&format!("tags: [{}]\n", t.join(", ")));
        }
    }

    frontmatter.push_str("---\n\n");

    // Build content
    let content = format!("{}# {}\n\n", frontmatter, title);

    fs::write(&final_path, &content).map_err(|e| e.to_string())?;

    Ok(final_path.to_string_lossy().to_string())
}

/// Update a task's frontmatter
#[tauri::command]
pub fn task_update(
    path: String,
    status: Option<String>,
    priority: Option<String>,
    due_date: Option<String>,
    project_path: Option<String>,
    column: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // Parse existing frontmatter
    let mut frontmatter = parse_task_frontmatter(&content);

    // Update fields if provided
    if let Some(s) = status {
        frontmatter.insert("status".to_string(), s);
    }
    if let Some(p) = priority {
        frontmatter.insert("priority".to_string(), p);
    }
    if let Some(d) = due_date {
        if d.is_empty() {
            frontmatter.remove("due");
        } else {
            frontmatter.insert("due".to_string(), d);
        }
    }
    if let Some(pp) = project_path {
        if pp.is_empty() {
            frontmatter.remove("project");
        } else {
            frontmatter.insert("project".to_string(), pp);
        }
    }
    if let Some(c) = column {
        frontmatter.insert("column".to_string(), c);
    }
    if let Some(t) = tags {
        if t.is_empty() {
            frontmatter.remove("tags");
        } else {
            frontmatter.insert("tags".to_string(), format!("[{}]", t.join(", ")));
        }
    }

    // Extract body (content after frontmatter)
    let body = if content.starts_with("---") {
        if let Some(end_idx) = content[3..].find("---") {
            content[end_idx + 6..].to_string()
        } else {
            content.clone()
        }
    } else {
        content.clone()
    };

    // Rebuild file
    let mut new_content = String::from("---\n");
    for (key, value) in &frontmatter {
        new_content.push_str(&format!("{}: {}\n", key, value));
    }
    new_content.push_str("---");
    new_content.push_str(&body);

    fs::write(&path, new_content).map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Project Commands
// ============================================================================

/// Index all projects in the vault
#[tauri::command]
pub fn db_index_projects(state: State<AppState>) -> Result<i32, String> {
    let vault_path = get_vault_path(&state)?;
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;

    let mut count = 0;

    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and directories
        if name.starts_with('.') || name == "node_modules" || name == "bun" {
            continue;
        }

        if !path.is_file() || name != "_project.json" {
            continue;
        }

        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let project_name = json.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unnamed Project");
                let description = json.get("description")
                    .and_then(|v| v.as_str());
                let color = json.get("color")
                    .and_then(|v| v.as_str());
                let icon = json.get("icon")
                    .and_then(|v| v.as_str());
                let status = json.get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("active");
                let columns: Vec<String> = json.get("columns")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect())
                    .unwrap_or_else(|| vec!["backlog".to_string(), "doing".to_string(), "review".to_string(), "done".to_string(), "archived".to_string()]);
                let created = json.get("created")
                    .and_then(|v| v.as_str())
                    .map(String::from)
                    .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

                // Use parent directory path as project path
                let project_path = path.parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                if db.index_project(
                    &project_path,
                    project_name,
                    description,
                    color,
                    icon,
                    status,
                    &columns,
                    &created,
                ).is_ok() {
                    count += 1;
                }
            }
        }
    }

    Ok(count)
}

/// Get all projects
#[tauri::command]
pub fn db_get_projects(state: State<AppState>, status: Option<String>) -> Result<Vec<Project>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_projects(status.as_deref())
}

/// Get a single project by path
#[tauri::command]
pub fn db_get_project(state: State<AppState>, path: String) -> Result<Option<Project>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_project(&path)
}

/// Get tasks for a specific project
#[tauri::command]
pub fn db_get_project_tasks(state: State<AppState>, project_path: String) -> Result<Vec<Task>, String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.get_project_tasks(&project_path)
}

/// Remove a project from the database index
#[tauri::command]
pub fn db_remove_project(state: State<AppState>, path: String) -> Result<(), String> {
    let db_lock = state.get_db()?;
    let db = db_lock.as_ref().ok_or("Database not initialized")?;
    db.remove_project(&path)
}

/// Create a new project
#[tauri::command]
pub fn project_create(
    state: State<AppState>,
    name: String,
    relative_path: Option<String>,
    description: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<String, String> {
    let vault_path = get_vault_path(&state)?;

    // Determine project directory
    let dir_name: String = name.chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '_' })
        .collect();

    let project_dir = if let Some(rel) = relative_path {
        Path::new(&vault_path).join(rel).join(&dir_name)
    } else {
        Path::new(&vault_path).join("Projects").join(&dir_name)
    };

    // Create directory
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

    // Create _project.json
    let now = chrono::Utc::now().to_rfc3339();
    let project_json = serde_json::json!({
        "name": name,
        "description": description,
        "color": color.unwrap_or_else(|| "#3b82f6".to_string()),
        "icon": icon.unwrap_or_else(|| "folder".to_string()),
        "status": "active",
        "columns": ["backlog", "doing", "review", "done", "archived"],
        "created": now
    });

    let json_path = project_dir.join("_project.json");
    let json_content = serde_json::to_string_pretty(&project_json)
        .map_err(|e| e.to_string())?;
    fs::write(&json_path, json_content).map_err(|e| e.to_string())?;

    Ok(project_dir.to_string_lossy().to_string())
}

// ============================================================================
// Inbox Commands
// ============================================================================

/// Quick capture - create a new file in the inbox
#[tauri::command]
pub fn quick_capture(
    state: State<AppState>,
    content: String,
    as_task: Option<bool>,
) -> Result<String, String> {
    let vault_path = get_vault_path(&state)?;
    let inbox_dir = Path::new(&vault_path).join("00_Inbox");

    // Create inbox if it doesn't exist
    fs::create_dir_all(&inbox_dir).map_err(|e| e.to_string())?;

    // Generate filename from first words or timestamp
    let now = chrono::Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S").to_string();

    let first_words: String = content.split_whitespace()
        .take(5)
        .collect::<Vec<_>>()
        .join("_");

    let sanitized: String = first_words.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .take(30)
        .collect();

    let filename = if sanitized.is_empty() {
        timestamp.clone()
    } else {
        format!("{}_{}", timestamp, sanitized)
    };

    let ext = if as_task.unwrap_or(false) { ".task.md" } else { ".md" };
    let file_path = inbox_dir.join(format!("{}{}", filename, ext));

    // Build content
    let file_content = if as_task.unwrap_or(false) {
        let now_rfc = chrono::Utc::now().to_rfc3339();
        format!(
            r#"---
status: todo
priority: medium
column: backlog
created: {}
---

# {}

{}
"#,
            now_rfc,
            content.lines().next().unwrap_or("New Task"),
            content
        )
    } else {
        content
    };

    fs::write(&file_path, file_content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Get items in the inbox folder
#[tauri::command]
pub fn get_inbox_items(state: State<AppState>, limit: Option<i32>) -> Result<Vec<FileNode>, String> {
    let vault_path = get_vault_path(&state)?;
    let inbox_dir = Path::new(&vault_path).join("00_Inbox");

    if !inbox_dir.exists() {
        return Ok(Vec::new());
    }

    let mut items: Vec<FileNode> = Vec::new();
    let entries = fs::read_dir(&inbox_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') || path.is_dir() {
            continue;
        }

        let metadata = fs::metadata(&path).ok();
        let relative_path = path.strip_prefix(&vault_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let ext = path.extension()
            .map(|e| e.to_string_lossy().to_lowercase());

        items.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            relative_path,
            node_type: "file".to_string(),
            extension: ext,
            children: None,
            modified: metadata.as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| chrono::DateTime::<Utc>::from(t).to_rfc3339()),
            size: metadata.as_ref().map(|m| m.len()),
        });
    }

    // Sort by modified date (newest first)
    items.sort_by(|a, b| b.modified.cmp(&a.modified));

    // Apply limit
    if let Some(l) = limit {
        items.truncate(l as usize);
    }

    Ok(items)
}

// ============================================================================
// Dev Projects Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevProject {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub command: String,
    pub port: u16,
    #[serde(rename = "autoStart")]
    pub auto_start: bool,
}

/// Get all dev projects from database
#[tauri::command]
pub fn db_get_dev_projects(state: State<AppState>) -> Result<Vec<DevProject>, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let rows = db.get_dev_projects()?;
    Ok(rows.into_iter().map(|(id, path, name, command, port, auto_start)| {
        DevProject { id, path, name, command, port, auto_start }
    }).collect())
}

/// Add a new dev project
#[tauri::command]
pub fn db_add_dev_project(
    state: State<AppState>,
    path: String,
    name: String,
    command: String,
    port: u16,
) -> Result<DevProject, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let id = db.add_dev_project(&path, &name, &command, port)?;
    Ok(DevProject { id, path, name, command, port, auto_start: false })
}

/// Update a dev project
#[tauri::command]
pub fn db_update_dev_project(
    state: State<AppState>,
    id: i64,
    name: String,
    command: String,
    port: u16,
    auto_start: bool,
) -> Result<(), String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.update_dev_project(id, &name, &command, port, auto_start)
}

/// Remove a dev project
#[tauri::command]
pub fn db_remove_dev_project(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.remove_dev_project(id)
}

// ============================================================================
// Vulnerability Scan Commands
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct VulnerabilityScanResult {
    pub id: i64,
    #[serde(rename = "devProjectId")]
    pub dev_project_id: i64,
    #[serde(rename = "scanDate")]
    pub scan_date: String,
    #[serde(rename = "totalCount")]
    pub total_count: i32,
    #[serde(rename = "criticalCount")]
    pub critical_count: i32,
    #[serde(rename = "highCount")]
    pub high_count: i32,
    #[serde(rename = "mediumCount")]
    pub medium_count: i32,
    #[serde(rename = "lowCount")]
    pub low_count: i32,
    #[serde(rename = "negligibleCount")]
    pub negligible_count: i32,
    #[serde(rename = "scanData")]
    pub scan_data: Option<String>,
}

/// Save a vulnerability scan result
#[tauri::command]
pub fn db_save_vulnerability_scan(
    state: State<AppState>,
    dev_project_id: i64,
    total_count: i32,
    critical_count: i32,
    high_count: i32,
    medium_count: i32,
    low_count: i32,
    negligible_count: i32,
    scan_data: Option<String>,
) -> Result<i64, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    db.save_vulnerability_scan(
        dev_project_id,
        total_count,
        critical_count,
        high_count,
        medium_count,
        low_count,
        negligible_count,
        scan_data.as_deref(),
    )
}

/// Get the latest vulnerability scan for a dev project
#[tauri::command]
pub fn db_get_latest_vulnerability_scan(
    state: State<AppState>,
    dev_project_id: i64,
) -> Result<Option<VulnerabilityScanResult>, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let scan = db.get_latest_vulnerability_scan(dev_project_id)?;
    Ok(scan.map(|s| VulnerabilityScanResult {
        id: s.id,
        dev_project_id: s.dev_project_id,
        scan_date: s.scan_date,
        total_count: s.total_count,
        critical_count: s.critical_count,
        high_count: s.high_count,
        medium_count: s.medium_count,
        low_count: s.low_count,
        negligible_count: s.negligible_count,
        scan_data: s.scan_data,
    }))
}

/// Get vulnerability scan history for a dev project
#[tauri::command]
pub fn db_get_vulnerability_scan_history(
    state: State<AppState>,
    dev_project_id: i64,
    limit: Option<i32>,
) -> Result<Vec<VulnerabilityScanResult>, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let scans = db.get_vulnerability_scan_history(dev_project_id, limit)?;
    Ok(scans.into_iter().map(|s| VulnerabilityScanResult {
        id: s.id,
        dev_project_id: s.dev_project_id,
        scan_date: s.scan_date,
        total_count: s.total_count,
        critical_count: s.critical_count,
        high_count: s.high_count,
        medium_count: s.medium_count,
        low_count: s.low_count,
        negligible_count: s.negligible_count,
        scan_data: s.scan_data,
    }).collect())
}

// ============================================================================
// Utility Commands
// ============================================================================

/// Run an external command (for opening VS Code, terminal, etc.)
#[tauri::command]
pub fn run_command(command: String, args: Vec<String>) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", &command])
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to run command: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(&command)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to run command: {}", e))?;
    }

    Ok(())
}

/// Check if a port is in use
#[tauri::command]
pub fn check_port_in_use(port: u16) -> Result<bool, String> {
    use std::net::TcpListener;

    match TcpListener::bind(format!("127.0.0.1:{}", port)) {
        Ok(_) => Ok(false), // Port is available
        Err(_) => Ok(true), // Port is in use
    }
}

/// Get process stats for a running shell (CPU and memory)
#[tauri::command]
pub fn get_process_stats(pid: u32) -> Result<ProcessStats, String> {
    use sysinfo::{Pid, ProcessesToUpdate, System};

    let mut sys = System::new();
    let target_pid = Pid::from_u32(pid);

    // Refresh all processes to find our target and its children
    sys.refresh_processes(ProcessesToUpdate::All, true);

    // First try to find the exact process
    if let Some(process) = sys.process(target_pid) {
        let cpu = process.cpu_usage() as f64;
        let memory = process.memory();
        return Ok(ProcessStats { cpu, memory });
    }

    // Process not found directly - look for child processes (node, bun, etc.)
    // This is common because the shell spawns the actual dev server
    let dev_processes: Vec<_> = sys
        .processes()
        .values()
        .filter(|p| {
            let name = p.name().to_string_lossy().to_lowercase();
            name.contains("node") || name.contains("bun") || name.contains("deno")
        })
        .collect();

    if let Some(process) = dev_processes.first() {
        Ok(ProcessStats {
            cpu: process.cpu_usage() as f64,
            memory: process.memory(),
        })
    } else {
        Err("Process not found".to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProcessStats {
    pub cpu: f64,
    pub memory: u64,
}
