use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use regex::Regex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub file_type: String,
    pub size_bytes: i64,
    pub created_at: String,
    pub modified_at: String,
    pub is_favorite: bool,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub content: String,
    pub frontmatter: Option<serde_json::Value>,
    pub word_count: i32,
    pub char_count: i32,
    pub created_at: String,
    pub modified_at: String,
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteLink {
    pub source_path: String,
    pub target_path: String,
    pub link_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteTag {
    pub note_path: String,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub snippet: String,
    pub rank: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Todo
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskStatus::Todo => write!(f, "todo"),
            TaskStatus::InProgress => write!(f, "in_progress"),
            TaskStatus::Done => write!(f, "done"),
            TaskStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for TaskStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "todo" => Ok(TaskStatus::Todo),
            "in_progress" | "inprogress" | "in-progress" => Ok(TaskStatus::InProgress),
            "done" | "completed" => Ok(TaskStatus::Done),
            "cancelled" | "canceled" => Ok(TaskStatus::Cancelled),
            _ => Err(format!("Unknown task status: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Urgent,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Medium
    }
}

impl std::fmt::Display for TaskPriority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaskPriority::Low => write!(f, "low"),
            TaskPriority::Medium => write!(f, "medium"),
            TaskPriority::High => write!(f, "high"),
            TaskPriority::Urgent => write!(f, "urgent"),
        }
    }
}

impl std::str::FromStr for TaskPriority {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "low" => Ok(TaskPriority::Low),
            "medium" | "normal" => Ok(TaskPriority::Medium),
            "high" => Ok(TaskPriority::High),
            "urgent" | "critical" => Ok(TaskPriority::Urgent),
            _ => Err(format!("Unknown task priority: {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub status: TaskStatus,
    pub priority: TaskPriority,
    pub due_date: Option<String>,
    pub project_path: Option<String>,
    pub column_name: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i64,
    pub path: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub status: String,
    pub columns: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueryResult {
    pub notes: Vec<HashMap<String, serde_json::Value>>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VulnerabilityScan {
    pub id: i64,
    pub dev_project_id: i64,
    pub scan_date: String,
    pub total_count: i32,
    pub critical_count: i32,
    pub high_count: i32,
    pub medium_count: i32,
    pub low_count: i32,
    pub negligible_count: i32,
    pub scan_data: Option<String>,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open or create database at the given path
    pub fn open(db_path: &Path) -> Result<Self, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    /// Initialize database schema
    fn init_schema(&self) -> Result<(), String> {
        self.conn.execute_batch(r#"
            -- Files table (ALL files metadata)
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                extension TEXT,
                file_type TEXT NOT NULL,
                size_bytes INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                is_favorite INTEGER DEFAULT 0,
                metadata TEXT
            );

            -- Notes table (markdown content for FTS)
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                frontmatter TEXT,
                word_count INTEGER DEFAULT 0,
                char_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                is_favorite INTEGER DEFAULT 0
            );

            -- Tags table (normalized)
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            -- Note-Tag junction table
            CREATE TABLE IF NOT EXISTS note_tags (
                note_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            -- File-Tag junction table (tags for any file)
            CREATE TABLE IF NOT EXISTS file_tags (
                file_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (file_id, tag_id),
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            -- Links table (for backlinks/graph)
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_note_id INTEGER NOT NULL,
                target_path TEXT NOT NULL,
                link_text TEXT,
                FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE
            );

            -- Recent files table
            CREATE TABLE IF NOT EXISTS recent_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                opened_at TEXT NOT NULL
            );

            -- Favorites table
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                added_at TEXT NOT NULL
            );

            -- FTS5 virtual table for full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                path,
                name,
                content,
                frontmatter,
                content='notes',
                content_rowid='id'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
                INSERT INTO notes_fts(rowid, path, name, content, frontmatter)
                VALUES (new.id, new.path, new.name, new.content, new.frontmatter);
            END;

            CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, path, name, content, frontmatter)
                VALUES ('delete', old.id, old.path, old.name, old.content, old.frontmatter);
            END;

            CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
                INSERT INTO notes_fts(notes_fts, rowid, path, name, content, frontmatter)
                VALUES ('delete', old.id, old.path, old.name, old.content, old.frontmatter);
                INSERT INTO notes_fts(rowid, path, name, content, frontmatter)
                VALUES (new.id, new.path, new.name, new.content, new.frontmatter);
            END;

            -- Tasks table (indexed from .task.md files)
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'todo',
                priority TEXT DEFAULT 'medium',
                due_date TEXT,
                project_path TEXT,
                column_name TEXT DEFAULT 'backlog',
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL
            );

            -- Projects table (indexed from _project.json files)
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                icon TEXT,
                status TEXT DEFAULT 'active',
                columns TEXT,
                created_at TEXT NOT NULL
            );

            -- Task-Tag junction table
            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            -- Dev Projects table
            CREATE TABLE IF NOT EXISTS dev_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                command TEXT NOT NULL DEFAULT 'bun dev',
                port INTEGER NOT NULL DEFAULT 3000,
                auto_start INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            -- Vulnerability Scans table (stores scan history for dev projects)
            CREATE TABLE IF NOT EXISTS vulnerability_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dev_project_id INTEGER NOT NULL,
                scan_date TEXT NOT NULL,
                total_count INTEGER DEFAULT 0,
                critical_count INTEGER DEFAULT 0,
                high_count INTEGER DEFAULT 0,
                medium_count INTEGER DEFAULT 0,
                low_count INTEGER DEFAULT 0,
                negligible_count INTEGER DEFAULT 0,
                scan_data TEXT,
                FOREIGN KEY (dev_project_id) REFERENCES dev_projects(id) ON DELETE CASCADE
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
            CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
            CREATE INDEX IF NOT EXISTS idx_files_type ON files(file_type);
            CREATE INDEX IF NOT EXISTS idx_files_ext ON files(extension);
            CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at);
            CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path);
            CREATE INDEX IF NOT EXISTS idx_notes_name ON notes(name);
            CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_note_id);
            CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_path);
            CREATE INDEX IF NOT EXISTS idx_note_tags_note ON note_tags(note_id);
            CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);
            CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_path);
            CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
            CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_name);
            CREATE INDEX IF NOT EXISTS idx_vuln_scans_project ON vulnerability_scans(dev_project_id);
            CREATE INDEX IF NOT EXISTS idx_vuln_scans_date ON vulnerability_scans(scan_date);
            CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
        "#).map_err(|e| format!("Failed to initialize schema: {}", e))?;

        Ok(())
    }

    /// Index a note (insert or update)
    pub fn index_note(&self, path: &str, name: &str, content: &str, modified_at: &str) -> Result<i64, String> {
        let frontmatter = extract_frontmatter(content);
        let frontmatter_json = frontmatter.as_ref().map(|f| serde_json::to_string(f).unwrap_or_default());
        let word_count = content.split_whitespace().count() as i32;
        let char_count = content.len() as i32;
        let now = chrono::Utc::now().to_rfc3339();

        // Upsert note
        self.conn.execute(
            r#"INSERT INTO notes (path, name, content, frontmatter, word_count, char_count, created_at, modified_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
               ON CONFLICT(path) DO UPDATE SET
                   name = excluded.name,
                   content = excluded.content,
                   frontmatter = excluded.frontmatter,
                   word_count = excluded.word_count,
                   char_count = excluded.char_count,
                   modified_at = excluded.modified_at"#,
            params![path, name, content, frontmatter_json, word_count, char_count, now, modified_at],
        ).map_err(|e| format!("Failed to index note: {}", e))?;

        let note_id: i64 = self.conn.query_row(
            "SELECT id FROM notes WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get note id: {}", e))?;

        // Extract and store tags
        self.update_tags(note_id, content, &frontmatter)?;

        // Extract and store links
        self.update_links(note_id, content)?;

        Ok(note_id)
    }

    /// Index a file (insert or update metadata)
    pub fn index_file(
        &self,
        path: &str,
        name: &str,
        extension: Option<&str>,
        file_type: &str,
        size_bytes: i64,
        created_at: &str,
        modified_at: &str,
    ) -> Result<i64, String> {
        // Upsert file
        self.conn.execute(
            r#"INSERT INTO files (path, name, extension, file_type, size_bytes, created_at, modified_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
               ON CONFLICT(path) DO UPDATE SET
                   name = excluded.name,
                   extension = excluded.extension,
                   file_type = excluded.file_type,
                   size_bytes = excluded.size_bytes,
                   modified_at = excluded.modified_at"#,
            params![path, name, extension, file_type, size_bytes, created_at, modified_at],
        ).map_err(|e| format!("Failed to index file: {}", e))?;

        let file_id: i64 = self.conn.query_row(
            "SELECT id FROM files WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get file id: {}", e))?;

        Ok(file_id)
    }

    /// Get a file by path
    pub fn get_file(&self, path: &str) -> Result<Option<FileEntry>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT id, path, name, extension, file_type, size_bytes, created_at, modified_at, is_favorite, metadata
               FROM files WHERE path = ?1"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let result = stmt.query_row(params![path], |row| {
            let metadata_str: Option<String> = row.get(9)?;
            let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(FileEntry {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                file_type: row.get(4)?,
                size_bytes: row.get(5)?,
                created_at: row.get(6)?,
                modified_at: row.get(7)?,
                is_favorite: row.get::<_, i32>(8)? != 0,
                metadata,
            })
        });

        match result {
            Ok(file) => Ok(Some(file)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get file: {}", e)),
        }
    }

    /// Get files with optional filtering
    pub fn get_files(
        &self,
        file_type: Option<&str>,
        extension: Option<&str>,
        is_favorite: Option<bool>,
        sort: Option<&str>,
        limit: Option<i32>,
    ) -> Result<Vec<FileEntry>, String> {
        let mut sql = "SELECT id, path, name, extension, file_type, size_bytes, created_at, modified_at, is_favorite, metadata FROM files WHERE 1=1".to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ft) = file_type {
            sql.push_str(" AND file_type = ?");
            params_vec.push(Box::new(ft.to_string()));
        }

        if let Some(ext) = extension {
            sql.push_str(" AND extension = ?");
            params_vec.push(Box::new(ext.to_string()));
        }

        if let Some(fav) = is_favorite {
            sql.push_str(" AND is_favorite = ?");
            params_vec.push(Box::new(if fav { 1 } else { 0 }));
        }

        if let Some(s) = sort {
            sql.push_str(&format!(" ORDER BY {}", s));
        } else {
            sql.push_str(" ORDER BY modified_at DESC");
        }

        if let Some(l) = limit {
            sql.push_str(&format!(" LIMIT {}", l));
        }

        let mut stmt = self.conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let results = stmt.query_map(params_refs.as_slice(), |row| {
            let metadata_str: Option<String> = row.get(9)?;
            let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(FileEntry {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                file_type: row.get(4)?,
                size_bytes: row.get(5)?,
                created_at: row.get(6)?,
                modified_at: row.get(7)?,
                is_favorite: row.get::<_, i32>(8)? != 0,
                metadata,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut files = Vec::new();
        for result in results {
            files.push(result.map_err(|e| format!("Failed to read file: {}", e))?);
        }

        Ok(files)
    }

    /// Set custom metadata on a file
    pub fn set_file_metadata(&self, path: &str, metadata: &serde_json::Value) -> Result<(), String> {
        let metadata_json = serde_json::to_string(metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

        self.conn.execute(
            "UPDATE files SET metadata = ?1 WHERE path = ?2",
            params![metadata_json, path],
        ).map_err(|e| format!("Failed to set metadata: {}", e))?;

        Ok(())
    }

    /// Get custom metadata for a file
    pub fn get_file_metadata(&self, path: &str) -> Result<Option<serde_json::Value>, String> {
        let result: Result<Option<String>, _> = self.conn.query_row(
            "SELECT metadata FROM files WHERE path = ?1",
            params![path],
            |row| row.get(0),
        );

        match result {
            Ok(Some(json_str)) => {
                let metadata = serde_json::from_str(&json_str)
                    .map_err(|e| format!("Failed to parse metadata: {}", e))?;
                Ok(Some(metadata))
            }
            Ok(None) => Ok(None),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get metadata: {}", e)),
        }
    }

    /// Add a tag to a file
    pub fn add_file_tag(&self, path: &str, tag: &str) -> Result<(), String> {
        let file_id: i64 = self.conn.query_row(
            "SELECT id FROM files WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| format!("File not found: {}", e))?;

        let tag_lower = tag.to_lowercase();

        // Insert tag if not exists
        self.conn.execute(
            "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
            params![tag_lower],
        ).map_err(|e| format!("Failed to insert tag: {}", e))?;

        // Get tag id
        let tag_id: i64 = self.conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag_lower],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get tag id: {}", e))?;

        // Link file to tag
        self.conn.execute(
            "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?1, ?2)",
            params![file_id, tag_id],
        ).map_err(|e| format!("Failed to link file to tag: {}", e))?;

        Ok(())
    }

    /// Remove a tag from a file
    pub fn remove_file_tag(&self, path: &str, tag: &str) -> Result<(), String> {
        let file_id: i64 = self.conn.query_row(
            "SELECT id FROM files WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| format!("File not found: {}", e))?;

        let tag_lower = tag.to_lowercase();

        let tag_id: Result<i64, _> = self.conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag_lower],
            |row| row.get(0),
        );

        if let Ok(tid) = tag_id {
            self.conn.execute(
                "DELETE FROM file_tags WHERE file_id = ?1 AND tag_id = ?2",
                params![file_id, tid],
            ).map_err(|e| format!("Failed to remove tag: {}", e))?;
        }

        Ok(())
    }

    /// Get tags for a file
    pub fn get_file_tags(&self, path: &str) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT t.name FROM tags t
               JOIN file_tags ft ON t.id = ft.tag_id
               JOIN files f ON ft.file_id = f.id
               WHERE f.path = ?1
               ORDER BY t.name"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map(params![path], |row| row.get(0))
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut tags = Vec::new();
        for result in results {
            tags.push(result.map_err(|e| format!("Failed to read tag: {}", e))?);
        }

        Ok(tags)
    }

    /// Get files by tag
    pub fn get_files_by_tag(&self, tag: &str) -> Result<Vec<FileEntry>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT f.id, f.path, f.name, f.extension, f.file_type, f.size_bytes,
                      f.created_at, f.modified_at, f.is_favorite, f.metadata
               FROM files f
               JOIN file_tags ft ON f.id = ft.file_id
               JOIN tags t ON ft.tag_id = t.id
               WHERE t.name = ?1
               ORDER BY f.modified_at DESC"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map(params![tag.to_lowercase()], |row| {
            let metadata_str: Option<String> = row.get(9)?;
            let metadata = metadata_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(FileEntry {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                extension: row.get(3)?,
                file_type: row.get(4)?,
                size_bytes: row.get(5)?,
                created_at: row.get(6)?,
                modified_at: row.get(7)?,
                is_favorite: row.get::<_, i32>(8)? != 0,
                metadata,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut files = Vec::new();
        for result in results {
            files.push(result.map_err(|e| format!("Failed to read file: {}", e))?);
        }

        Ok(files)
    }

    /// Remove a file from the index
    pub fn remove_file(&self, path: &str) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM files WHERE path = ?1",
            params![path],
        ).map_err(|e| format!("Failed to remove file: {}", e))?;
        Ok(())
    }

    /// Update tags for a note
    fn update_tags(&self, note_id: i64, content: &str, frontmatter: &Option<serde_json::Value>) -> Result<(), String> {
        // Delete existing tags for this note
        self.conn.execute(
            "DELETE FROM note_tags WHERE note_id = ?1",
            params![note_id],
        ).map_err(|e| format!("Failed to delete old tags: {}", e))?;

        let mut tags: Vec<String> = Vec::new();

        // Extract tags from frontmatter
        if let Some(fm) = frontmatter {
            if let Some(fm_tags) = fm.get("tags") {
                if let Some(arr) = fm_tags.as_array() {
                    for tag in arr {
                        if let Some(t) = tag.as_str() {
                            tags.push(t.to_lowercase());
                        }
                    }
                } else if let Some(t) = fm_tags.as_str() {
                    // Handle comma-separated tags
                    for tag in t.split(',') {
                        tags.push(tag.trim().to_lowercase());
                    }
                }
            }
        }

        // Extract inline #tags from content
        let tag_regex = Regex::new(r"#([a-zA-Z][a-zA-Z0-9_-]*)").unwrap();
        for cap in tag_regex.captures_iter(content) {
            if let Some(tag) = cap.get(1) {
                tags.push(tag.as_str().to_lowercase());
            }
        }

        // Insert unique tags
        tags.sort();
        tags.dedup();

        for tag in tags {
            // Insert tag if not exists
            self.conn.execute(
                "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
                params![tag],
            ).map_err(|e| format!("Failed to insert tag: {}", e))?;

            // Get tag id
            let tag_id: i64 = self.conn.query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![tag],
                |row| row.get(0),
            ).map_err(|e| format!("Failed to get tag id: {}", e))?;

            // Link note to tag
            self.conn.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
                params![note_id, tag_id],
            ).map_err(|e| format!("Failed to link note to tag: {}", e))?;
        }

        Ok(())
    }

    /// Update links for a note
    fn update_links(&self, note_id: i64, content: &str) -> Result<(), String> {
        // Delete existing links from this note
        self.conn.execute(
            "DELETE FROM links WHERE source_note_id = ?1",
            params![note_id],
        ).map_err(|e| format!("Failed to delete old links: {}", e))?;

        // Extract [[wiki links]]
        let wiki_link_regex = Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap();
        for cap in wiki_link_regex.captures_iter(content) {
            let target = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let link_text = cap.get(2).map(|m| m.as_str()).unwrap_or(target);

            self.conn.execute(
                "INSERT INTO links (source_note_id, target_path, link_text) VALUES (?1, ?2, ?3)",
                params![note_id, target, link_text],
            ).map_err(|e| format!("Failed to insert link: {}", e))?;
        }

        Ok(())
    }

    /// Remove a note from the index
    pub fn remove_note(&self, path: &str) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM notes WHERE path = ?1",
            params![path],
        ).map_err(|e| format!("Failed to remove note: {}", e))?;
        Ok(())
    }

    /// Full-text search
    pub fn search(&self, query: &str, limit: i32) -> Result<Vec<SearchResult>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT path, name, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 32) as snippet,
                      bm25(notes_fts) as rank
               FROM notes_fts
               WHERE notes_fts MATCH ?1
               ORDER BY rank
               LIMIT ?2"#
        ).map_err(|e| format!("Failed to prepare search: {}", e))?;

        let results = stmt.query_map(params![query, limit], |row| {
            Ok(SearchResult {
                path: row.get(0)?,
                name: row.get(1)?,
                snippet: row.get(2)?,
                rank: row.get(3)?,
            })
        }).map_err(|e| format!("Failed to execute search: {}", e))?;

        let mut search_results = Vec::new();
        for result in results {
            search_results.push(result.map_err(|e| format!("Failed to read search result: {}", e))?);
        }

        Ok(search_results)
    }

    /// Get all notes with optional filtering
    pub fn get_notes(&self, filter: Option<&str>, sort: Option<&str>, limit: Option<i32>) -> Result<Vec<Note>, String> {
        let mut sql = "SELECT id, path, name, content, frontmatter, word_count, char_count, created_at, modified_at, is_favorite FROM notes".to_string();

        if let Some(f) = filter {
            sql.push_str(&format!(" WHERE {}", f));
        }

        if let Some(s) = sort {
            sql.push_str(&format!(" ORDER BY {}", s));
        } else {
            sql.push_str(" ORDER BY modified_at DESC");
        }

        if let Some(l) = limit {
            sql.push_str(&format!(" LIMIT {}", l));
        }

        let mut stmt = self.conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map([], |row| {
            let frontmatter_str: Option<String> = row.get(4)?;
            let frontmatter = frontmatter_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(Note {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                frontmatter,
                word_count: row.get(5)?,
                char_count: row.get(6)?,
                created_at: row.get(7)?,
                modified_at: row.get(8)?,
                is_favorite: row.get::<_, i32>(9)? != 0,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut notes = Vec::new();
        for result in results {
            notes.push(result.map_err(|e| format!("Failed to read note: {}", e))?);
        }

        Ok(notes)
    }

    /// Get notes by tag
    pub fn get_notes_by_tag(&self, tag: &str) -> Result<Vec<Note>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT n.id, n.path, n.name, n.content, n.frontmatter, n.word_count, n.char_count,
                      n.created_at, n.modified_at, n.is_favorite
               FROM notes n
               JOIN note_tags nt ON n.id = nt.note_id
               JOIN tags t ON nt.tag_id = t.id
               WHERE t.name = ?1
               ORDER BY n.modified_at DESC"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map(params![tag.to_lowercase()], |row| {
            let frontmatter_str: Option<String> = row.get(4)?;
            let frontmatter = frontmatter_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(Note {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                frontmatter,
                word_count: row.get(5)?,
                char_count: row.get(6)?,
                created_at: row.get(7)?,
                modified_at: row.get(8)?,
                is_favorite: row.get::<_, i32>(9)? != 0,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut notes = Vec::new();
        for result in results {
            notes.push(result.map_err(|e| format!("Failed to read note: {}", e))?);
        }

        Ok(notes)
    }

    /// Get all tags with note counts
    pub fn get_tags(&self) -> Result<Vec<(String, i64)>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT t.name, COUNT(nt.note_id) as count
               FROM tags t
               LEFT JOIN note_tags nt ON t.id = nt.tag_id
               GROUP BY t.id
               ORDER BY count DESC, t.name ASC"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut tags = Vec::new();
        for result in results {
            tags.push(result.map_err(|e| format!("Failed to read tag: {}", e))?);
        }

        Ok(tags)
    }

    /// Get backlinks for a note
    pub fn get_backlinks(&self, note_name: &str) -> Result<Vec<Note>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT DISTINCT n.id, n.path, n.name, n.content, n.frontmatter, n.word_count,
                      n.char_count, n.created_at, n.modified_at, n.is_favorite
               FROM notes n
               JOIN links l ON n.id = l.source_note_id
               WHERE l.target_path = ?1 OR l.target_path LIKE ?2
               ORDER BY n.modified_at DESC"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let pattern = format!("%/{}", note_name);
        let results = stmt.query_map(params![note_name, pattern], |row| {
            let frontmatter_str: Option<String> = row.get(4)?;
            let frontmatter = frontmatter_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(Note {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                frontmatter,
                word_count: row.get(5)?,
                char_count: row.get(6)?,
                created_at: row.get(7)?,
                modified_at: row.get(8)?,
                is_favorite: row.get::<_, i32>(9)? != 0,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut notes = Vec::new();
        for result in results {
            notes.push(result.map_err(|e| format!("Failed to read note: {}", e))?);
        }

        Ok(notes)
    }

    /// Toggle favorite status
    pub fn toggle_favorite(&self, path: &str) -> Result<bool, String> {
        let current: i32 = self.conn.query_row(
            "SELECT is_favorite FROM notes WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).unwrap_or(0);

        let new_value = if current == 0 { 1 } else { 0 };

        self.conn.execute(
            "UPDATE notes SET is_favorite = ?1 WHERE path = ?2",
            params![new_value, path],
        ).map_err(|e| format!("Failed to toggle favorite: {}", e))?;

        // Also update favorites table
        if new_value == 1 {
            let now = chrono::Utc::now().to_rfc3339();
            self.conn.execute(
                "INSERT OR REPLACE INTO favorites (path, added_at) VALUES (?1, ?2)",
                params![path, now],
            ).map_err(|e| format!("Failed to add favorite: {}", e))?;
        } else {
            self.conn.execute(
                "DELETE FROM favorites WHERE path = ?1",
                params![path],
            ).map_err(|e| format!("Failed to remove favorite: {}", e))?;
        }

        Ok(new_value == 1)
    }

    /// Get favorites
    pub fn get_favorites(&self) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT path FROM favorites ORDER BY added_at DESC"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut paths = Vec::new();
        for result in results {
            paths.push(result.map_err(|e| format!("Failed to read path: {}", e))?);
        }

        Ok(paths)
    }

    /// Add to recent files
    pub fn add_recent(&self, path: &str, name: &str) -> Result<(), String> {
        let now = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT OR REPLACE INTO recent_files (path, name, opened_at) VALUES (?1, ?2, ?3)",
            params![path, name, now],
        ).map_err(|e| format!("Failed to add recent: {}", e))?;

        // Keep only last 20 recent files
        self.conn.execute(
            r#"DELETE FROM recent_files WHERE id NOT IN (
                SELECT id FROM recent_files ORDER BY opened_at DESC LIMIT 20
            )"#,
            [],
        ).map_err(|e| format!("Failed to cleanup recent: {}", e))?;

        Ok(())
    }

    /// Get recent files
    pub fn get_recent(&self, limit: i32) -> Result<Vec<(String, String, String)>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT path, name, opened_at FROM recent_files ORDER BY opened_at DESC LIMIT ?1"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map(params![limit], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut files = Vec::new();
        for result in results {
            files.push(result.map_err(|e| format!("Failed to read recent: {}", e))?);
        }

        Ok(files)
    }

    /// Execute a custom query (for advanced use / JSX pages)
    pub fn query(&self, sql: &str) -> Result<QueryResult, String> {
        // Only allow SELECT queries for safety
        let sql_lower = sql.trim().to_lowercase();
        if !sql_lower.starts_with("select") {
            return Err("Only SELECT queries are allowed".to_string());
        }

        let mut stmt = self.conn.prepare(sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let column_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let column_count = column_names.len();

        let mut notes: Vec<HashMap<String, serde_json::Value>> = Vec::new();

        let mut rows = stmt.query([])
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        while let Some(row) = rows.next().map_err(|e| format!("Failed to read row: {}", e))? {
            let mut note: HashMap<String, serde_json::Value> = HashMap::new();

            for i in 0..column_count {
                let col_name = &column_names[i];

                // Try to get value as different types
                if let Ok(v) = row.get::<_, i64>(i) {
                    note.insert(col_name.clone(), serde_json::Value::Number(v.into()));
                } else if let Ok(v) = row.get::<_, f64>(i) {
                    if let Some(n) = serde_json::Number::from_f64(v) {
                        note.insert(col_name.clone(), serde_json::Value::Number(n));
                    }
                } else if let Ok(v) = row.get::<_, String>(i) {
                    note.insert(col_name.clone(), serde_json::Value::String(v));
                } else {
                    note.insert(col_name.clone(), serde_json::Value::Null);
                }
            }

            notes.push(note);
        }

        let total = notes.len() as i64;

        Ok(QueryResult { notes, total })
    }

    /// Get database stats
    pub fn get_stats(&self) -> Result<HashMap<String, i64>, String> {
        let mut stats = HashMap::new();

        stats.insert("notes".to_string(), self.conn.query_row(
            "SELECT COUNT(*) FROM notes", [], |row| row.get(0)
        ).unwrap_or(0));

        stats.insert("tags".to_string(), self.conn.query_row(
            "SELECT COUNT(*) FROM tags", [], |row| row.get(0)
        ).unwrap_or(0));

        stats.insert("links".to_string(), self.conn.query_row(
            "SELECT COUNT(*) FROM links", [], |row| row.get(0)
        ).unwrap_or(0));

        stats.insert("favorites".to_string(), self.conn.query_row(
            "SELECT COUNT(*) FROM favorites", [], |row| row.get(0)
        ).unwrap_or(0));

        stats.insert("total_words".to_string(), self.conn.query_row(
            "SELECT COALESCE(SUM(word_count), 0) FROM notes", [], |row| row.get(0)
        ).unwrap_or(0));

        stats.insert("tasks".to_string(), self.conn.query_row(
            "SELECT COUNT(*) FROM tasks", [], |row| row.get(0)
        ).unwrap_or(0));

        stats.insert("projects".to_string(), self.conn.query_row(
            "SELECT COUNT(*) FROM projects", [], |row| row.get(0)
        ).unwrap_or(0));

        Ok(stats)
    }

    // =========================================================================
    // Task Methods
    // =========================================================================

    /// Index a task from a .task.md file
    pub fn index_task(
        &self,
        path: &str,
        title: &str,
        status: &str,
        priority: &str,
        due_date: Option<&str>,
        project_path: Option<&str>,
        column_name: &str,
        tags: &[String],
        created_at: &str,
        modified_at: &str,
    ) -> Result<i64, String> {
        // Upsert task
        self.conn.execute(
            r#"INSERT INTO tasks (path, title, status, priority, due_date, project_path, column_name, created_at, modified_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
               ON CONFLICT(path) DO UPDATE SET
                   title = excluded.title,
                   status = excluded.status,
                   priority = excluded.priority,
                   due_date = excluded.due_date,
                   project_path = excluded.project_path,
                   column_name = excluded.column_name,
                   modified_at = excluded.modified_at"#,
            params![path, title, status, priority, due_date, project_path, column_name, created_at, modified_at],
        ).map_err(|e| format!("Failed to index task: {}", e))?;

        let task_id: i64 = self.conn.query_row(
            "SELECT id FROM tasks WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get task id: {}", e))?;

        // Update task tags
        self.conn.execute(
            "DELETE FROM task_tags WHERE task_id = ?1",
            params![task_id],
        ).map_err(|e| format!("Failed to delete old task tags: {}", e))?;

        for tag in tags {
            let tag_lower = tag.to_lowercase();
            self.conn.execute(
                "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
                params![tag_lower],
            ).map_err(|e| format!("Failed to insert tag: {}", e))?;

            let tag_id: i64 = self.conn.query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![tag_lower],
                |row| row.get(0),
            ).map_err(|e| format!("Failed to get tag id: {}", e))?;

            self.conn.execute(
                "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
                params![task_id, tag_id],
            ).map_err(|e| format!("Failed to link task to tag: {}", e))?;
        }

        Ok(task_id)
    }

    /// Get tasks with optional filtering
    pub fn get_tasks(
        &self,
        status: Option<&str>,
        priority: Option<&str>,
        project_path: Option<&str>,
        column_name: Option<&str>,
        due_before: Option<&str>,
        due_after: Option<&str>,
        limit: Option<i32>,
    ) -> Result<Vec<Task>, String> {
        let mut sql = r#"SELECT t.id, t.path, t.title, t.status, t.priority, t.due_date,
                                t.project_path, t.column_name, t.created_at, t.modified_at
                         FROM tasks t WHERE 1=1"#.to_string();
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(s) = status {
            sql.push_str(" AND t.status = ?");
            params_vec.push(Box::new(s.to_string()));
        }

        if let Some(p) = priority {
            sql.push_str(" AND t.priority = ?");
            params_vec.push(Box::new(p.to_string()));
        }

        if let Some(pp) = project_path {
            sql.push_str(" AND t.project_path = ?");
            params_vec.push(Box::new(pp.to_string()));
        }

        if let Some(cn) = column_name {
            sql.push_str(" AND t.column_name = ?");
            params_vec.push(Box::new(cn.to_string()));
        }

        if let Some(db) = due_before {
            sql.push_str(" AND t.due_date <= ?");
            params_vec.push(Box::new(db.to_string()));
        }

        if let Some(da) = due_after {
            sql.push_str(" AND t.due_date >= ?");
            params_vec.push(Box::new(da.to_string()));
        }

        sql.push_str(" ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.due_date ASC NULLS LAST, t.modified_at DESC");

        if let Some(l) = limit {
            sql.push_str(&format!(" LIMIT {}", l));
        }

        let mut stmt = self.conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let results = stmt.query_map(params_refs.as_slice(), |row| {
            Ok(Task {
                id: row.get(0)?,
                path: row.get(1)?,
                title: row.get(2)?,
                status: row.get::<_, String>(3)?
                    .parse()
                    .unwrap_or(TaskStatus::Todo),
                priority: row.get::<_, String>(4)?
                    .parse()
                    .unwrap_or(TaskPriority::Medium),
                due_date: row.get(5)?,
                project_path: row.get(6)?,
                column_name: row.get::<_, String>(7)?,
                tags: Vec::new(), // Will be populated separately
                created_at: row.get(8)?,
                modified_at: row.get(9)?,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut tasks = Vec::new();
        for result in results {
            let mut task = result.map_err(|e| format!("Failed to read task: {}", e))?;
            task.tags = self.get_task_tags(task.id)?;
            tasks.push(task);
        }

        Ok(tasks)
    }

    /// Get a single task by path
    pub fn get_task(&self, path: &str) -> Result<Option<Task>, String> {
        let result = self.conn.query_row(
            r#"SELECT id, path, title, status, priority, due_date, project_path,
                      column_name, created_at, modified_at
               FROM tasks WHERE path = ?1"#,
            params![path],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    status: row.get::<_, String>(3)?
                        .parse()
                        .unwrap_or(TaskStatus::Todo),
                    priority: row.get::<_, String>(4)?
                        .parse()
                        .unwrap_or(TaskPriority::Medium),
                    due_date: row.get(5)?,
                    project_path: row.get(6)?,
                    column_name: row.get(7)?,
                    tags: Vec::new(),
                    created_at: row.get(8)?,
                    modified_at: row.get(9)?,
                })
            },
        );

        match result {
            Ok(mut task) => {
                task.tags = self.get_task_tags(task.id)?;
                Ok(Some(task))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get task: {}", e)),
        }
    }

    /// Get tags for a task
    fn get_task_tags(&self, task_id: i64) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(
            r#"SELECT t.name FROM tags t
               JOIN task_tags tt ON t.id = tt.tag_id
               WHERE tt.task_id = ?1
               ORDER BY t.name"#
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map(params![task_id], |row| row.get(0))
            .map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut tags = Vec::new();
        for result in results {
            tags.push(result.map_err(|e| format!("Failed to read tag: {}", e))?);
        }

        Ok(tags)
    }

    /// Remove a task from the index
    pub fn remove_task(&self, path: &str) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM tasks WHERE path = ?1",
            params![path],
        ).map_err(|e| format!("Failed to remove task: {}", e))?;
        Ok(())
    }

    /// Get tasks due today or overdue
    pub fn get_tasks_today(&self) -> Result<Vec<Task>, String> {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        self.get_tasks(None, None, None, None, Some(&today), None, None)
    }

    /// Get tasks due in the next N days
    pub fn get_tasks_upcoming(&self, days: i32) -> Result<Vec<Task>, String> {
        let today = chrono::Local::now();
        let future = today + chrono::Duration::days(days as i64);
        let today_str = today.format("%Y-%m-%d").to_string();
        let future_str = future.format("%Y-%m-%d").to_string();
        self.get_tasks(None, None, None, None, Some(&future_str), Some(&today_str), None)
    }

    // =========================================================================
    // Project Methods
    // =========================================================================

    /// Index a project from a _project.json file
    pub fn index_project(
        &self,
        path: &str,
        name: &str,
        description: Option<&str>,
        color: Option<&str>,
        icon: Option<&str>,
        status: &str,
        columns: &[String],
        created_at: &str,
    ) -> Result<i64, String> {
        let columns_json = serde_json::to_string(columns)
            .map_err(|e| format!("Failed to serialize columns: {}", e))?;

        self.conn.execute(
            r#"INSERT INTO projects (path, name, description, color, icon, status, columns, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
               ON CONFLICT(path) DO UPDATE SET
                   name = excluded.name,
                   description = excluded.description,
                   color = excluded.color,
                   icon = excluded.icon,
                   status = excluded.status,
                   columns = excluded.columns"#,
            params![path, name, description, color, icon, status, columns_json, created_at],
        ).map_err(|e| format!("Failed to index project: {}", e))?;

        let project_id: i64 = self.conn.query_row(
            "SELECT id FROM projects WHERE path = ?1",
            params![path],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to get project id: {}", e))?;

        Ok(project_id)
    }

    /// Get all projects
    pub fn get_projects(&self, status: Option<&str>) -> Result<Vec<Project>, String> {
        let mut sql = r#"SELECT id, path, name, description, color, icon, status, columns, created_at
                         FROM projects WHERE 1=1"#.to_string();

        if let Some(s) = status {
            sql.push_str(&format!(" AND status = '{}'", s));
        }

        sql.push_str(" ORDER BY name ASC");

        let mut stmt = self.conn.prepare(&sql)
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let results = stmt.query_map([], |row| {
            let columns_json: String = row.get(7)?;
            let columns: Vec<String> = serde_json::from_str(&columns_json).unwrap_or_default();

            Ok(Project {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                color: row.get(4)?,
                icon: row.get(5)?,
                status: row.get(6)?,
                columns,
                created_at: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to execute query: {}", e))?;

        let mut projects = Vec::new();
        for result in results {
            projects.push(result.map_err(|e| format!("Failed to read project: {}", e))?);
        }

        Ok(projects)
    }

    /// Get a single project by path
    pub fn get_project(&self, path: &str) -> Result<Option<Project>, String> {
        let result = self.conn.query_row(
            r#"SELECT id, path, name, description, color, icon, status, columns, created_at
               FROM projects WHERE path = ?1"#,
            params![path],
            |row| {
                let columns_json: String = row.get(7)?;
                let columns: Vec<String> = serde_json::from_str(&columns_json).unwrap_or_default();

                Ok(Project {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    color: row.get(4)?,
                    icon: row.get(5)?,
                    status: row.get(6)?,
                    columns,
                    created_at: row.get(8)?,
                })
            },
        );

        match result {
            Ok(project) => Ok(Some(project)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get project: {}", e)),
        }
    }

    /// Remove a project from the index
    pub fn remove_project(&self, path: &str) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM projects WHERE path = ?1",
            params![path],
        ).map_err(|e| format!("Failed to remove project: {}", e))?;
        Ok(())
    }

    /// Get tasks for a specific project
    pub fn get_project_tasks(&self, project_path: &str) -> Result<Vec<Task>, String> {
        self.get_tasks(None, None, Some(project_path), None, None, None, None)
    }

    // =========================================================================
    // Dev Projects
    // =========================================================================

    /// Add a dev project
    pub fn add_dev_project(&self, path: &str, name: &str, command: &str, port: u16) -> Result<i64, String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO dev_projects (path, name, command, port, auto_start, created_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5)",
            params![path, name, command, port as i32, now],
        ).map_err(|e| format!("Failed to add dev project: {}", e))?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Get all dev projects
    pub fn get_dev_projects(&self) -> Result<Vec<(i64, String, String, String, u16, bool)>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, name, command, port, auto_start FROM dev_projects ORDER BY name"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)? as u16,
                row.get::<_, i32>(5)? != 0,
            ))
        }).map_err(|e| format!("Failed to query dev projects: {}", e))?;

        let mut projects = Vec::new();
        for row in rows {
            if let Ok(project) = row {
                projects.push(project);
            }
        }
        Ok(projects)
    }

    /// Get a dev project by id
    pub fn get_dev_project(&self, id: i64) -> Result<Option<(i64, String, String, String, u16, bool)>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, name, command, port, auto_start FROM dev_projects WHERE id = ?1"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let result = stmt.query_row(params![id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)? as u16,
                row.get::<_, i32>(5)? != 0,
            ))
        });

        match result {
            Ok(project) => Ok(Some(project)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get dev project: {}", e)),
        }
    }

    /// Update a dev project
    pub fn update_dev_project(&self, id: i64, name: &str, command: &str, port: u16, auto_start: bool) -> Result<(), String> {
        self.conn.execute(
            "UPDATE dev_projects SET name = ?1, command = ?2, port = ?3, auto_start = ?4 WHERE id = ?5",
            params![name, command, port as i32, auto_start as i32, id],
        ).map_err(|e| format!("Failed to update dev project: {}", e))?;
        Ok(())
    }

    /// Remove a dev project
    pub fn remove_dev_project(&self, id: i64) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM dev_projects WHERE id = ?1",
            params![id],
        ).map_err(|e| format!("Failed to remove dev project: {}", e))?;
        Ok(())
    }

    // =========================================================================
    // Vulnerability Scan Methods
    // =========================================================================

    /// Save a vulnerability scan result
    pub fn save_vulnerability_scan(
        &self,
        dev_project_id: i64,
        total_count: i32,
        critical_count: i32,
        high_count: i32,
        medium_count: i32,
        low_count: i32,
        negligible_count: i32,
        scan_data: Option<&str>,
    ) -> Result<i64, String> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO vulnerability_scans (dev_project_id, scan_date, total_count, critical_count, high_count, medium_count, low_count, negligible_count, scan_data)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![dev_project_id, now, total_count, critical_count, high_count, medium_count, low_count, negligible_count, scan_data],
        ).map_err(|e| format!("Failed to save vulnerability scan: {}", e))?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Get the latest vulnerability scan for a dev project
    pub fn get_latest_vulnerability_scan(&self, dev_project_id: i64) -> Result<Option<VulnerabilityScan>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT id, dev_project_id, scan_date, total_count, critical_count, high_count, medium_count, low_count, negligible_count, scan_data
             FROM vulnerability_scans
             WHERE dev_project_id = ?1
             ORDER BY scan_date DESC
             LIMIT 1"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let result = stmt.query_row(params![dev_project_id], |row| {
            Ok(VulnerabilityScan {
                id: row.get(0)?,
                dev_project_id: row.get(1)?,
                scan_date: row.get(2)?,
                total_count: row.get(3)?,
                critical_count: row.get(4)?,
                high_count: row.get(5)?,
                medium_count: row.get(6)?,
                low_count: row.get(7)?,
                negligible_count: row.get(8)?,
                scan_data: row.get(9)?,
            })
        });

        match result {
            Ok(scan) => Ok(Some(scan)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get vulnerability scan: {}", e)),
        }
    }

    /// Get vulnerability scan history for a dev project
    pub fn get_vulnerability_scan_history(&self, dev_project_id: i64, limit: Option<i32>) -> Result<Vec<VulnerabilityScan>, String> {
        let limit_val = limit.unwrap_or(10);
        let mut stmt = self.conn.prepare(
            "SELECT id, dev_project_id, scan_date, total_count, critical_count, high_count, medium_count, low_count, negligible_count, scan_data
             FROM vulnerability_scans
             WHERE dev_project_id = ?1
             ORDER BY scan_date DESC
             LIMIT ?2"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt.query_map(params![dev_project_id, limit_val], |row| {
            Ok(VulnerabilityScan {
                id: row.get(0)?,
                dev_project_id: row.get(1)?,
                scan_date: row.get(2)?,
                total_count: row.get(3)?,
                critical_count: row.get(4)?,
                high_count: row.get(5)?,
                medium_count: row.get(6)?,
                low_count: row.get(7)?,
                negligible_count: row.get(8)?,
                scan_data: row.get(9)?,
            })
        }).map_err(|e| format!("Failed to query scans: {}", e))?;

        let mut scans = Vec::new();
        for row in rows {
            scans.push(row.map_err(|e| format!("Failed to read scan: {}", e))?);
        }
        Ok(scans)
    }

    /// Delete old vulnerability scans (keep only the last N)
    pub fn cleanup_old_scans(&self, dev_project_id: i64, keep_count: i32) -> Result<i32, String> {
        let deleted = self.conn.execute(
            "DELETE FROM vulnerability_scans
             WHERE dev_project_id = ?1
             AND id NOT IN (
                 SELECT id FROM vulnerability_scans
                 WHERE dev_project_id = ?1
                 ORDER BY scan_date DESC
                 LIMIT ?2
             )",
            params![dev_project_id, keep_count],
        ).map_err(|e| format!("Failed to cleanup scans: {}", e))?;
        Ok(deleted as i32)
    }
}

/// Extract YAML frontmatter from markdown content
fn extract_frontmatter(content: &str) -> Option<serde_json::Value> {
    if !content.starts_with("---") {
        return None;
    }

    let end_index = content[3..].find("---")?;
    let yaml_str = &content[3..end_index + 3];

    // Simple YAML-like parsing for common frontmatter fields
    let mut map: HashMap<String, serde_json::Value> = HashMap::new();

    for line in yaml_str.lines() {
        let line = line.trim();
        if line.is_empty() || !line.contains(':') {
            continue;
        }

        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim();

            // Handle arrays (simple format: [item1, item2])
            if value.starts_with('[') && value.ends_with(']') {
                let items: Vec<serde_json::Value> = value[1..value.len()-1]
                    .split(',')
                    .map(|s| serde_json::Value::String(s.trim().trim_matches('"').trim_matches('\'').to_string()))
                    .collect();
                map.insert(key, serde_json::Value::Array(items));
            } else if value.is_empty() {
                // This might be the start of a YAML list, skip for now
                continue;
            } else {
                // Simple string value
                let clean_value = value.trim_matches('"').trim_matches('\'');
                map.insert(key, serde_json::Value::String(clean_value.to_string()));
            }
        }
    }

    if map.is_empty() {
        None
    } else {
        Some(serde_json::Value::Object(map.into_iter().collect()))
    }
}
