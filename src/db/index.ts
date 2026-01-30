import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

// Ensure data directory exists
const dataDir = join(import.meta.dir, "../../data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, "vault.db");
export const db = new Database(dbPath);

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS recent_files (
    path TEXT PRIMARY KEY,
    opened_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    path TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Settings helpers
export function getSetting(key: string): string | null {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | null;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
}

// Template helpers
export function getTemplates() {
  return db.query("SELECT * FROM templates ORDER BY name").all();
}

export function getTemplate(id: number) {
  return db.query("SELECT * FROM templates WHERE id = ?").get(id);
}

export function createTemplate(name: string, content: string, description?: string) {
  return db.run(
    "INSERT INTO templates (name, content, description) VALUES (?, ?, ?)",
    [name, content, description ?? null]
  );
}

export function updateTemplate(id: number, name: string, content: string, description?: string) {
  return db.run(
    "UPDATE templates SET name = ?, content = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [name, content, description ?? null, id]
  );
}

export function deleteTemplate(id: number) {
  return db.run("DELETE FROM templates WHERE id = ?", [id]);
}

// Recent files helpers
export function addRecentFile(path: string) {
  db.run("INSERT OR REPLACE INTO recent_files (path, opened_at) VALUES (?, CURRENT_TIMESTAMP)", [path]);
  // Keep only last 20
  db.run(`
    DELETE FROM recent_files WHERE path NOT IN (
      SELECT path FROM recent_files ORDER BY opened_at DESC LIMIT 20
    )
  `);
}

export function getRecentFiles() {
  return db.query("SELECT * FROM recent_files ORDER BY opened_at DESC LIMIT 20").all();
}

// Bookmark helpers
export function getBookmarks() {
  return db.query("SELECT * FROM bookmarks ORDER BY name").all();
}

export function addBookmark(path: string, name?: string) {
  db.run("INSERT OR REPLACE INTO bookmarks (path, name) VALUES (?, ?)", [path, name ?? null]);
}

export function removeBookmark(path: string) {
  db.run("DELETE FROM bookmarks WHERE path = ?", [path]);
}

export function getVaultPath(): string | null {
  return getSetting("vault_path");
}

export function setVaultPath(path: string): void {
  setSetting("vault_path", path);
}

// App settings (stored as JSON)
export function getAppSettings(): Record<string, unknown> | null {
  const json = getSetting("app_settings");
  if (json) {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  return null;
}

export function setAppSettings(settings: Record<string, unknown>): void {
  setSetting("app_settings", JSON.stringify(settings));
}

console.log("📦 Database initialized at", dbPath);
