import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

export interface Vault {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_opened: string | null;
}

export interface FileNode {
  name: string;
  path: string;
  relative_path: string;
  type: "file" | "folder";
  extension?: string;
  children?: FileNode[];
  modified?: string;
  size?: number;
}

export interface SearchResult {
  path: string;
  relative_path: string;
  name: string;
  match?: string;
}

export interface FileContent {
  content: string | null;
  binary: boolean;
  data: string | null; // base64 encoded for binary
  path: string;
}

// ============================================================================
// Vault Management
// ============================================================================

export async function getVaults(): Promise<Vault[]> {
  return invoke("get_vaults");
}

export async function getActiveVault(): Promise<Vault | null> {
  return invoke("get_active_vault");
}

export async function addVault(name: string, path: string): Promise<Vault> {
  return invoke("add_vault", { name, path });
}

export async function removeVault(vaultId: string): Promise<void> {
  return invoke("remove_vault", { vaultId });
}

export async function setActiveVault(vaultId: string): Promise<Vault> {
  return invoke("set_active_vault", { vaultId });
}

export async function updateVault(vaultId: string, name: string): Promise<Vault> {
  return invoke("update_vault", { vaultId, name });
}

// ============================================================================
// File Tree
// ============================================================================

export async function getFileTree(): Promise<{ tree: FileNode[]; vaultPath: string }> {
  const [tree, vaultPath] = await invoke<[FileNode[], string]>("get_file_tree");
  return { tree, vaultPath };
}

// ============================================================================
// File Operations
// ============================================================================

export async function readFile(path: string): Promise<FileContent> {
  return invoke("read_file", { path });
}

export async function saveFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

export async function createFile(relativePath: string, content = ""): Promise<string> {
  return invoke("create_file", { relativePath, content: content || null });
}

export async function deleteFile(path: string): Promise<void> {
  return invoke("delete_item", { path });
}

export async function createFolder(relativePath: string): Promise<string> {
  return invoke("create_folder", { relativePath });
}

export async function deleteFolder(path: string): Promise<void> {
  return invoke("delete_item", { path });
}

export async function moveItem(oldPath: string, newPath: string): Promise<void> {
  return invoke("move_item", { oldPath, newPath });
}

// ============================================================================
// Search
// ============================================================================

export async function searchVault(
  query: string,
  searchContent = false
): Promise<{ results: SearchResult[] }> {
  const results = await invoke<SearchResult[]>("search_vault", { query, searchContent });
  return { results };
}

// ============================================================================
// Settings
// ============================================================================

export async function getAppSettings(): Promise<Record<string, unknown>> {
  const settings = await invoke<Record<string, unknown>>("get_settings");
  return { settings };
}

export async function saveAppSettings(settings: Record<string, unknown>): Promise<void> {
  return invoke("save_settings", { settings });
}

// ============================================================================
// Legacy compatibility (for existing code)
// ============================================================================

export async function getVaultConfig(): Promise<{ vaultPath: string | null }> {
  const vault = await getActiveVault();
  return { vaultPath: vault?.path || null };
}

export async function setVaultPath(path: string): Promise<{ success: boolean }> {
  // For legacy support - creates a vault with the path as name
  const name = path.split(/[/\\]/).pop() || "Vault";
  await addVault(name, path);
  return { success: true };
}

// Templates, bookmarks, recent files - stored in settings
export async function getTemplates(): Promise<{ templates: unknown[] }> {
  const { settings } = await getAppSettings();
  return { templates: (settings.templates as unknown[]) || [] };
}

export async function createTemplate(name: string, content: string, description?: string): Promise<void> {
  const { settings } = await getAppSettings();
  const templates = (settings.templates as unknown[]) || [];
  templates.push({ id: Date.now(), name, content, description });
  await saveAppSettings({ ...settings, templates });
}

export async function getRecentFiles(): Promise<{ files: string[] }> {
  const { settings } = await getAppSettings();
  return { files: (settings.recentFiles as string[]) || [] };
}

export async function getBookmarks(): Promise<{ bookmarks: unknown[] }> {
  const { settings } = await getAppSettings();
  return { bookmarks: (settings.bookmarks as unknown[]) || [] };
}

export async function addBookmark(path: string, name?: string): Promise<void> {
  const { settings } = await getAppSettings();
  const bookmarks = (settings.bookmarks as unknown[]) || [];
  bookmarks.push({ path, name: name || path.split(/[/\\]/).pop() });
  await saveAppSettings({ ...settings, bookmarks });
}

export async function removeBookmark(path: string): Promise<void> {
  const { settings } = await getAppSettings();
  const bookmarks = ((settings.bookmarks as { path: string }[]) || []).filter(b => b.path !== path);
  await saveAppSettings({ ...settings, bookmarks });
}

// ============================================================================
// Database API
// ============================================================================

export interface DbNote {
  id: number;
  path: string;
  name: string;
  content: string;
  frontmatter: Record<string, unknown> | null;
  word_count: number;
  char_count: number;
  created_at: string;
  modified_at: string;
  is_favorite: boolean;
}

export interface DbSearchResult {
  path: string;
  name: string;
  snippet: string;
  rank: number;
}

export interface DbQueryResult {
  notes: Record<string, unknown>[];
  total: number;
}

export interface DbStats {
  notes: number;
  tags: number;
  links: number;
  favorites: number;
  total_words: number;
}

/** Initialize the database for the current vault */
export async function dbInit(): Promise<void> {
  return invoke("db_init");
}

/** Index all files in the vault (returns count of files and notes indexed) */
export async function dbIndexVault(): Promise<{ files: number; notes: number }> {
  return invoke("db_index_vault");
}

/** Full-text search using the database */
export async function dbSearch(query: string, limit?: number): Promise<DbSearchResult[]> {
  return invoke("db_search", { query, limit });
}

/** Get all notes with optional filtering */
export async function dbGetNotes(options?: {
  filter?: string;
  sort?: string;
  limit?: number;
}): Promise<DbNote[]> {
  return invoke("db_get_notes", options || {});
}

/** Get notes by tag */
export async function dbGetNotesByTag(tag: string): Promise<DbNote[]> {
  return invoke("db_get_notes_by_tag", { tag });
}

/** Get all tags with counts */
export async function dbGetTags(): Promise<[string, number][]> {
  return invoke("db_get_tags");
}

/** Get backlinks for a note */
export async function dbGetBacklinks(noteName: string): Promise<DbNote[]> {
  return invoke("db_get_backlinks", { noteName });
}

/** Toggle favorite status for a note */
export async function dbToggleFavorite(path: string): Promise<boolean> {
  return invoke("db_toggle_favorite", { path });
}

/** Get all favorites */
export async function dbGetFavorites(): Promise<string[]> {
  return invoke("db_get_favorites");
}

/** Add a file to recent files */
export async function dbAddRecent(path: string, name: string): Promise<void> {
  return invoke("db_add_recent", { path, name });
}

/** Get recent files */
export async function dbGetRecent(limit?: number): Promise<[string, string, string][]> {
  return invoke("db_get_recent", { limit });
}

/** Execute a custom SQL query (SELECT only) - for JSX pages */
export async function dbQuery(sql: string): Promise<DbQueryResult> {
  return invoke("db_query", { sql });
}

/** Get database statistics */
export async function dbGetStats(): Promise<DbStats> {
  return invoke("db_get_stats");
}

// ============================================================================
// File Metadata API
// ============================================================================

export interface FileEntry {
  id: number;
  path: string;
  name: string;
  extension: string | null;
  file_type: string;
  size_bytes: number;
  created_at: string;
  modified_at: string;
  is_favorite: boolean;
  metadata: Record<string, unknown> | null;
}

/** Get a file entry by path */
export async function dbGetFile(path: string): Promise<FileEntry | null> {
  return invoke("db_get_file", { path });
}

/** Get files with optional filtering */
export async function dbGetFiles(options?: {
  fileType?: string;
  extension?: string;
  isFavorite?: boolean;
  sort?: string;
  limit?: number;
}): Promise<FileEntry[]> {
  return invoke("db_get_files", {
    file_type: options?.fileType,
    extension: options?.extension,
    is_favorite: options?.isFavorite,
    sort: options?.sort,
    limit: options?.limit,
  });
}

/** Set custom metadata on a file */
export async function dbSetFileMetadata(path: string, metadata: Record<string, unknown>): Promise<void> {
  return invoke("db_set_file_metadata", { path, metadata });
}

/** Get custom metadata for a file */
export async function dbGetFileMetadata(path: string): Promise<Record<string, unknown> | null> {
  return invoke("db_get_file_metadata", { path });
}

/** Add a tag to a file */
export async function dbAddFileTag(path: string, tag: string): Promise<void> {
  return invoke("db_add_file_tag", { path, tag });
}

/** Remove a tag from a file */
export async function dbRemoveFileTag(path: string, tag: string): Promise<void> {
  return invoke("db_remove_file_tag", { path, tag });
}

/** Get tags for a file */
export async function dbGetFileTags(path: string): Promise<string[]> {
  return invoke("db_get_file_tags", { path });
}

/** Get files by tag */
export async function dbGetFilesByTag(tag: string): Promise<FileEntry[]> {
  return invoke("db_get_files_by_tag", { tag });
}

// ============================================================================
// Terminal API
// ============================================================================

/** Shell types available */
export type ShellType = "powershell" | "pwsh" | "cmd" | "bash" | "wsl" | "default";

/** Spawn a new shell process */
export async function spawnShell(id: string, workingDir?: string, shellType?: ShellType): Promise<void> {
  return invoke("spawn_shell", { id, workingDir, shellType: shellType === "default" ? null : shellType });
}

/** Write data to a terminal */
export async function writeShell(id: string, data: string): Promise<void> {
  return invoke("write_shell", { id, data });
}

/** Resize a terminal */
export async function resizeShell(id: string, rows: number, cols: number): Promise<void> {
  return invoke("resize_shell", { id, rows, cols });
}

/** Kill a terminal session */
export async function killShell(id: string): Promise<void> {
  return invoke("kill_shell", { id });
}

// ============================================================================
// Task API
// ============================================================================

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: number;
  path: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_path: string | null;
  column_name: string;
  tags: string[];
  created_at: string;
  modified_at: string;
}

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  project_path?: string;
  column_name?: string;
  due_before?: string;
  due_after?: string;
  limit?: number;
}

export interface CreateTaskOptions {
  project_path?: string;
  priority?: TaskPriority;
  due_date?: string;
  column?: string;
  tags?: string[];
}

/** Index all tasks in the vault */
export async function dbIndexTasks(): Promise<number> {
  return invoke("db_index_tasks");
}

/** Get tasks with optional filtering */
export async function dbGetTasks(filter?: TaskFilter): Promise<Task[]> {
  return invoke("db_get_tasks", {
    status: filter?.status,
    priority: filter?.priority,
    projectPath: filter?.project_path,
    columnName: filter?.column_name,
    dueBefore: filter?.due_before,
    dueAfter: filter?.due_after,
    limit: filter?.limit,
  });
}

/** Get a single task by path */
export async function dbGetTask(path: string): Promise<Task | null> {
  return invoke("db_get_task", { path });
}

/** Get tasks due today or overdue */
export async function dbGetTasksToday(): Promise<Task[]> {
  return invoke("db_get_tasks_today");
}

/** Get tasks due in the next N days */
export async function dbGetTasksUpcoming(days?: number): Promise<Task[]> {
  return invoke("db_get_tasks_upcoming", { days });
}

/** Create a new task file */
export async function taskCreate(
  title: string,
  options?: CreateTaskOptions
): Promise<string> {
  // Ensure empty strings are sent as undefined (which Rust treats as None)
  const projectPath = options?.project_path && options.project_path.trim() !== ""
    ? options.project_path
    : undefined;

  return invoke("task_create", {
    title,
    projectPath: projectPath,  // camelCase for Tauri v2
    priority: options?.priority,
    dueDate: options?.due_date,  // camelCase for Tauri v2
    column: options?.column,
    tags: options?.tags,
  });
}

/** Update a task's frontmatter */
export async function taskUpdate(
  path: string,
  updates: Partial<{
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    project_path: string;
    column: string;
    tags: string[];
  }>
): Promise<void> {
  // Note: Tauri v2 auto-converts camelCase (JS) to snake_case (Rust)
  return invoke("task_update", {
    path,
    status: updates.status,
    priority: updates.priority,
    dueDate: updates.due_date,  // camelCase for Tauri v2
    projectPath: updates.project_path,  // camelCase for Tauri v2
    column: updates.column,
    tags: updates.tags,
  });
}

// ============================================================================
// Project API
// ============================================================================

export interface Project {
  id: number;
  path: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  status: string;
  columns: string[];
  created_at: string;
}

export interface CreateProjectOptions {
  relative_path?: string;
  description?: string;
  color?: string;
  icon?: string;
}

/** Index all projects in the vault */
export async function dbIndexProjects(): Promise<number> {
  return invoke("db_index_projects");
}

/** Get all projects */
export async function dbGetProjects(status?: string): Promise<Project[]> {
  return invoke("db_get_projects", { status });
}

/** Get a single project by path */
export async function dbGetProject(path: string): Promise<Project | null> {
  return invoke("db_get_project", { path });
}

/** Get tasks for a specific project */
export async function dbGetProjectTasks(projectPath: string): Promise<Task[]> {
  return invoke("db_get_project_tasks", { projectPath });
}

/** Create a new project */
export async function projectCreate(
  name: string,
  options?: CreateProjectOptions
): Promise<string> {
  // Note: Tauri v2 auto-converts camelCase (JS) to snake_case (Rust)
  return invoke("project_create", {
    name,
    relativePath: options?.relative_path,  // camelCase for Tauri v2
    description: options?.description,
    color: options?.color,
    icon: options?.icon,
  });
}

/** Remove a project from the database index */
export async function dbRemoveProject(path: string): Promise<void> {
  return invoke("db_remove_project", { path });
}

/** Delete a project (folder and all contents) */
export async function projectDelete(path: string): Promise<void> {
  // Remove from database first
  await dbRemoveProject(path);
  // Delete the project folder from filesystem
  await invoke("delete_item", { path });
  // Re-index tasks to clean up any orphaned task references
  await dbIndexTasks();
}

// ============================================================================
// Inbox API
// ============================================================================

/** Quick capture - create a new file in the inbox */
export async function quickCapture(
  content: string,
  asTask?: boolean
): Promise<string> {
  return invoke("quick_capture", { content, asTask });
}

/** Get items in the inbox folder */
export async function getInboxItems(limit?: number): Promise<FileNode[]> {
  return invoke("get_inbox_items", { limit });
}

// ============================================================================
// Dev Projects API
// ============================================================================

export interface DevProject {
  id: number;
  path: string;
  name: string;
  command: string;
  port: number;
  autoStart: boolean;
}

/** Get all dev projects */
export async function dbGetDevProjects(): Promise<DevProject[]> {
  return invoke("db_get_dev_projects");
}

/** Add a new dev project */
export async function dbAddDevProject(
  path: string,
  name: string,
  command: string,
  port: number
): Promise<DevProject> {
  return invoke("db_add_dev_project", { path, name, command, port });
}

/** Update a dev project */
export async function dbUpdateDevProject(
  id: number,
  name: string,
  command: string,
  port: number,
  autoStart: boolean
): Promise<void> {
  return invoke("db_update_dev_project", { id, name, command, port, autoStart });
}

/** Remove a dev project */
export async function dbRemoveDevProject(id: number): Promise<void> {
  return invoke("db_remove_dev_project", { id });
}

// ============================================================================
// Vulnerability Scans API
// ============================================================================

export interface VulnerabilityScan {
  id: number;
  devProjectId: number;
  scanDate: string;
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  negligibleCount: number;
  scanData: string | null;
}

/** Save a vulnerability scan result */
export async function dbSaveVulnerabilityScan(
  devProjectId: number,
  totalCount: number,
  criticalCount: number,
  highCount: number,
  mediumCount: number,
  lowCount: number,
  negligibleCount: number,
  scanData?: string
): Promise<number> {
  return invoke("db_save_vulnerability_scan", {
    devProjectId,
    totalCount,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    negligibleCount,
    scanData: scanData ?? null,
  });
}

/** Get the latest vulnerability scan for a dev project */
export async function dbGetLatestVulnerabilityScan(
  devProjectId: number
): Promise<VulnerabilityScan | null> {
  return invoke("db_get_latest_vulnerability_scan", { devProjectId });
}

/** Get vulnerability scan history for a dev project */
export async function dbGetVulnerabilityScanHistory(
  devProjectId: number,
  limit?: number
): Promise<VulnerabilityScan[]> {
  return invoke("db_get_vulnerability_scan_history", { devProjectId, limit: limit ?? null });
}
