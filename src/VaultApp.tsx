import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  Plus,
  FolderPlus,
  RefreshCw,
  Search,
  FileText,
  Pencil,
  Trash2,
  FolderOpen,
  Sun,
  Moon,
  Monitor,
  Settings as SettingsIcon,
  ChevronDown,
  Check,
  X,
  Star,
  Clock,
  List,
  Command,
  Copy,
  Clipboard,
  Files,
  ExternalLink,
  Database,
  ChevronsUpDown,
  ChevronsDownUp,
  Tag,
  Link2,
  BarChart3,
  HelpCircle,
  BookOpen,
  Code2,
  Image,
  Film,
  Music,
  FileSpreadsheet,
  FileCode,
  LayoutDashboard,
  Kanban,
  TerminalSquare,
  Home,
  ListChecks,
  CalendarDays,
  CalendarClock,
  Calendar,
  CheckSquare,
  ChevronRight,
  FolderKanban,
  Inbox,
  Rocket,
  Play,
  Square,
  Eye,
} from "lucide-react";
import { useTheme, type Theme } from "./hooks/useTheme";
import { useRefreshListener } from "./hooks/useRefresh";
import { FileTree } from "./components/FileTree";
import type { FileNode } from "./components/FileTree";
import { Editor, getFileType, VIRTUAL_PATHS, isVirtualPath, type FileType } from "./components/Editor";
import { TabBar, type Tab } from "./components/TabBar";
import { ContextMenu } from "./components/ContextMenu";
import type { MenuItem } from "./components/ContextMenu";
import { InputModal, ConfirmModal } from "./components/Modal";
import { SearchBar } from "./components/SearchBar";
import { Settings, useSettings } from "./components/Settings";
import { TerminalPanel, type TerminalPosition } from "./components/Terminal";
import { ProjectWizard } from "./components/ProjectWizard";
import { DevProjectWizard } from "./components/DevProjectWizard";
import { DevProjectCreateWizard } from "./components/DevProjectCreateWizard";
import { useToast } from "./components/Toast";
import { DevPreviewPanel } from "./components/DevPreviewPanel";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getVaults,
  getActiveVault,
  addVault,
  removeVault,
  setActiveVault,
  getFileTree,
  readFile,
  saveFile,
  createFile,
  createFolder,
  deleteFile,
  deleteFolder,
  moveItem,
  searchVault,
  dbInit,
  dbIndexVault,
  dbSearch,
  dbGetTags,
  dbGetNotesByTag,
  dbGetBacklinks,
  dbGetStats,
  dbGetFavorites,
  dbGetRecent,
  dbAddRecent,
  dbToggleFavorite,
  spawnShell,
  writeShell,
  resizeShell,
  killShell,
  dbIndexTasks,
  dbIndexProjects,
  dbGetProjects,
  projectDelete,
  dbGetDevProjects,
  dbRemoveDevProject,
  spawnShell as spawnDevShell,
  writeShell as writeDevShell,
  killShell as killDevShell,
  type Vault,
  type DbSearchResult,
  type DbNote,
  type DbStats,
  type Project,
  type DevProject,
} from "./hooks/useApi";
import "./index.css";

interface OpenFile {
  path: string;
  name: string;
  content: string | null;
  originalContent: string | null; // Content when loaded or last saved
  binaryData: ArrayBuffer | null;
  fileType: FileType;
  isDirty: boolean;
}

// Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Get icon for file type in recent files
function getFileTypeIcon(fileType: FileType) {
  switch (fileType) {
    case "md":
      return <FileText className="w-4 h-4 text-blue-500" />;
    case "code":
      return <Code2 className="w-4 h-4 text-green-500" />;
    case "json":
    case "yaml":
      return <FileCode className="w-4 h-4 text-amber-500" />;
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    case "image":
      return <Image className="w-4 h-4 text-pink-500" />;
    case "video":
      return <Film className="w-4 h-4 text-purple-500" />;
    case "audio":
      return <Music className="w-4 h-4 text-cyan-500" />;
    case "pdf":
      return <FileText className="w-4 h-4 text-red-500" />;
    case "docx":
      return <FileText className="w-4 h-4 text-blue-600" />;
    case "html":
      return <Code2 className="w-4 h-4 text-orange-500" />;
    case "dashboard":
      return <LayoutDashboard className="w-4 h-4 text-indigo-500" />;
    case "kanban":
      return <Kanban className="w-4 h-4 text-violet-500" />;
    case "mermaid":
      return <FileCode className="w-4 h-4 text-purple-500" />;
    case "excalidraw":
      return <FileCode className="w-4 h-4 text-violet-400" />;
    case "svg":
      return <Image className="w-4 h-4 text-emerald-400" />;
    case "task":
      return <CheckSquare className="w-4 h-4 text-green-500" />;
    default:
      return <FileText className="w-4 h-4 text-muted" />;
  }
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // Fall back to date
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function VaultApp() {
  // Theme
  const { theme, setTheme, isDark, toggleTheme } = useTheme();

  // Toast notifications
  const toast = useToast();

  // Settings
  const { settings, updateSettings, isLoaded: settingsLoaded } = useSettings();
  const [showSettings, setShowSettings] = useState(false);

  // Sync theme setting with useTheme hook
  useEffect(() => {
    if (settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings.theme]);

  // Sync terminal position from settings
  useEffect(() => {
    if (settings.terminalPosition && settings.terminalPosition !== terminalPosition) {
      setTerminalPosition(settings.terminalPosition);
    }
  }, [settings.terminalPosition]);

  // Startup behavior - track if startup has been handled
  const startupLoadedRef = useRef(false);

  // Vault state
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVault, setActiveVaultState] = useState<Vault | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [vaultDropdownOpen, setVaultDropdownOpen] = useState(false);
  const [addVaultMode, setAddVaultMode] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultPath, setNewVaultPath] = useState("");

  // Editor state
  // Tab state - multiple open files
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeFile = openFiles[activeTabIndex] || null;

  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<{ focus: () => void }>(null);

  // Database state
  const [dbReady, setDbReady] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<string | null>(null);

  // Quick wins state
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; name: string; openedAt: number }>>([]);
  const [recentFilesSelectedIndex, setRecentFilesSelectedIndex] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showOutline, setShowOutline] = useState(false);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [expandAllTrigger, setExpandAllTrigger] = useState(0);
  const [collapseAllTrigger, setCollapseAllTrigger] = useState(0);

  // Database UI state
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showVaultStats, setShowVaultStats] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [tags, setTags] = useState<[string, number][]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagNotes, setTagNotes] = useState<DbNote[]>([]);
  const [backlinks, setBacklinks] = useState<DbNote[]>([]);
  const [vaultStats, setVaultStats] = useState<DbStats | null>(null);

  // Terminal state
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalPosition, setTerminalPosition] = useState<TerminalPosition>("bottom");
  const [terminalSize, setTerminalSize] = useState(300);
  const [shellOutput, setShellOutput] = useState<{ id: string; data: string } | null>(null);

  // Sidebar expansion state
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectWizard, setShowProjectWizard] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Dev Projects state
  const [devProjects, setDevProjects] = useState<DevProject[]>([]);
  const [devProjectsExpanded, setDevProjectsExpanded] = useState(true);
  const [showDevProjectWizard, setShowDevProjectWizard] = useState(false);
  const [showDevProjectCreateWizard, setShowDevProjectCreateWizard] = useState(false);
  const [devProjectToDelete, setDevProjectToDelete] = useState<DevProject | null>(null);
  const [runningServers, setRunningServers] = useState<Map<string, {
    terminalId: string;
    port: number;
    status: "starting" | "running" | "stopped" | "error";
  }>>(new Map());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Word/character count for current file
  const fileStats = useMemo(() => {
    if (!activeFile?.content) return null;
    const content = activeFile.content;
    const charCount = content.length;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const lineCount = content.split('\n').length;
    return { charCount, wordCount, lineCount };
  }, [activeFile?.content]);

  // Extract headings for outline
  const outlineHeadings = useMemo(() => {
    if (!activeFile?.content || activeFile.fileType !== 'md') return [];
    const lines = activeFile.content.split('\n');
    const headings: Array<{ level: number; text: string; line: number }> = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2],
          line: index + 1,
        });
      }
    });
    return headings;
  }, [activeFile?.content, activeFile?.fileType]);

  // Sidebar resize handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Clamp between 200 and 600 pixels
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isResizing) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl/Cmd + key shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'p': // Search/Quick open
            e.preventDefault();
            searchBarRef.current?.focus();
            break;
          case 'n': // New file
            if (!isInput) {
              e.preventDefault();
              setNewFileModal({ folder: "" });
            }
            break;
          case 'b': // Toggle sidebar
            e.preventDefault();
            setSidebarCollapsed(prev => !prev);
            break;
          case ',': // Settings
            e.preventDefault();
            setShowSettings(true);
            break;
          case 'k': // Command palette
            e.preventDefault();
            setShowCommandPalette(true);
            setCommandQuery("");
            break;
          case 'o': // Outline
            if (e.shiftKey) {
              e.preventDefault();
              setShowOutline(prev => !prev);
            }
            break;
          case 'e': // Recent files
            if (e.shiftKey) {
              e.preventDefault();
              setShowRecentFiles(prev => !prev);
            }
            break;
          case 'tab': // Tab switching
            if (openFiles.length > 1) {
              e.preventDefault();
              if (e.shiftKey) {
                // Previous tab
                setActiveTabIndex((i) => (i > 0 ? i - 1 : openFiles.length - 1));
              } else {
                // Next tab
                setActiveTabIndex((i) => (i < openFiles.length - 1 ? i + 1 : 0));
              }
            }
            break;
          case 'w': // Close current tab
            if (activeFile) {
              e.preventDefault();
              handleCloseFile();
            }
            break;
          case '`': // Toggle terminal
            e.preventDefault();
            setShowTerminal(prev => !prev);
            break;
        }
      }

      // F1 for help
      if (e.key === 'F1') {
        e.preventDefault();
        setShowUserGuide(true);
      }

      // Escape to close modals/panels
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowRecentFiles(false);
        setShowTagsPanel(false);
        setShowVaultStats(false);
        setShowUserGuide(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize database for current vault
  const initializeDatabase = useCallback(async (forceReindex = false) => {
    try {
      setIndexingStatus("Initializing database...");
      await dbInit();

      // Load favorites and recent files first (fast)
      try {
        const dbFavorites = await dbGetFavorites();
        setFavorites(new Set(dbFavorites));
      } catch (e) {
        console.log("No favorites yet");
      }

      try {
        const dbRecent = await dbGetRecent(10);
        setRecentFiles(dbRecent.map(([path, name, openedAt]) => ({
          path,
          name,
          openedAt: new Date(openedAt).getTime(),
        })));
      } catch (e) {
        console.log("No recent files yet");
      }

      setDbReady(true);

      // Only index if forced or database seems empty
      if (forceReindex) {
        setIndexingStatus("Indexing files...");
        const counts = await dbIndexVault();
        console.log(`Indexed ${counts.files} files, ${counts.notes} notes`);
      }

      setIndexingStatus(null);
    } catch (e) {
      console.error("Failed to initialize database:", e);
      setIndexingStatus(null);
      // Continue without database - it's not critical
      setDbReady(false);
    }
  }, []);

  // Manual re-index function
  const reindexVault = useCallback(async () => {
    if (!dbReady) {
      await initializeDatabase(true);
    } else {
      try {
        setIndexingStatus("Indexing files...");
        const counts = await dbIndexVault();
        console.log(`Indexed ${counts.files} files, ${counts.notes} notes`);

        // Also index tasks and projects
        setIndexingStatus("Indexing tasks...");
        const taskCount = await dbIndexTasks();
        console.log(`Indexed ${taskCount} tasks`);

        setIndexingStatus("Indexing projects...");
        const projectCount = await dbIndexProjects();
        console.log(`Indexed ${projectCount} projects`);

        // Refresh projects list in sidebar
        const projectList = await dbGetProjects("active");
        setProjects(projectList);

        setIndexingStatus(null);
        toast.success(`Vault indexed (${counts.notes} notes, ${taskCount} tasks)`);
      } catch (e) {
        console.error("Failed to index vault:", e);
        setIndexingStatus(null);
        toast.error("Failed to index vault");
      }
    }
  }, [dbReady, initializeDatabase, toast]);

  // Load tags from database
  const loadTags = useCallback(async () => {
    if (!dbReady) return;
    try {
      const tagList = await dbGetTags();
      setTags(tagList);
    } catch (e) {
      console.error("Failed to load tags:", e);
    }
  }, [dbReady]);

  // Load notes for a specific tag
  const loadTagNotes = useCallback(async (tag: string) => {
    if (!dbReady) return;
    try {
      const notes = await dbGetNotesByTag(tag);
      setTagNotes(notes);
      setSelectedTag(tag);
    } catch (e) {
      console.error("Failed to load notes for tag:", e);
    }
  }, [dbReady]);

  // Load projects from database
  const loadProjects = useCallback(async () => {
    if (!dbReady) return;
    try {
      const projectList = await dbGetProjects("active");
      setProjects(projectList);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  }, [dbReady]);

  // Load dev projects from database
  const loadDevProjects = useCallback(async () => {
    if (!dbReady) return;
    try {
      const projects = await dbGetDevProjects();
      setDevProjects(projects);
    } catch (e) {
      console.error("Failed to load dev projects:", e);
    }
  }, [dbReady]);

  // Delete a dev project
  const deleteDevProject = useCallback(async (project: DevProject) => {
    try {
      // Stop the server if running
      const server = runningServers.get(project.path);
      if (server) {
        await killDevShell(server.terminalId);
        setRunningServers(prev => {
          const m = new Map(prev);
          m.delete(project.path);
          return m;
        });
      }
      // Remove from database
      await dbRemoveDevProject(project.id);
      await loadDevProjects();
      toast.success(`Removed ${project.name}`);
    } catch (e) {
      console.error("Failed to delete dev project:", e);
      toast.error("Failed to delete dev project");
    }
  }, [runningServers, loadDevProjects, toast]);

  // Start a dev server
  const startDevServer = useCallback(async (project: DevProject) => {
    // Don't start if already running
    if (runningServers.has(project.path)) return;

    const terminalId = `devserver-${project.path.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`;

    setRunningServers(prev => {
      const m = new Map(prev);
      m.set(project.path, {
        terminalId,
        port: project.port,
        status: "starting"
      });
      return m;
    });

    try {
      await spawnDevShell(terminalId, project.path, "default");
      await writeDevShell(terminalId, `${project.command}\r`);

      // After a delay, assume it's running
      setTimeout(() => {
        setRunningServers(prev => {
          const m = new Map(prev);
          const server = m.get(project.path);
          if (server && server.status === "starting") {
            m.set(project.path, { ...server, status: "running" });
          }
          return m;
        });
      }, 3000);

      toast.success(`Started ${project.name} on port ${project.port}`);
    } catch (e) {
      console.error("Failed to start dev server:", e);
      setRunningServers(prev => {
        const m = new Map(prev);
        m.delete(project.path);
        return m;
      });
      toast.error(`Failed to start ${project.name}`);
    }
  }, [runningServers, toast]);

  // Stop a dev server
  const stopDevServer = useCallback(async (project: DevProject) => {
    const server = runningServers.get(project.path);
    if (!server) return;

    try {
      await killDevShell(server.terminalId);
      setRunningServers(prev => {
        const m = new Map(prev);
        m.delete(project.path);
        return m;
      });
      toast.info(`Stopped ${project.name}`);
    } catch (e) {
      console.error("Failed to stop dev server:", e);
      toast.error(`Failed to stop ${project.name}`);
    }
  }, [runningServers, toast]);

  // ID-based start/stop (for passing to Editor)
  const startDevServerById = useCallback((projectId: number) => {
    const project = devProjects.find(p => p.id === projectId);
    if (project) startDevServer(project);
  }, [devProjects, startDevServer]);

  const stopDevServerById = useCallback((projectId: number) => {
    const project = devProjects.find(p => p.id === projectId);
    if (project) stopDevServer(project);
  }, [devProjects, stopDevServer]);

  // Get current dev server state for active file (if it's a dev project)
  const currentDevServerState = useMemo(() => {
    if (!activeFile?.path.startsWith("__devproject__:")) return null;
    const idStr = activeFile.path.slice("__devproject__:".length);
    const projectId = parseInt(idStr, 10);
    if (isNaN(projectId)) return null;
    const project = devProjects.find(p => p.id === projectId);
    if (!project) return null;
    return runningServers.get(project.path) || null;
  }, [activeFile, devProjects, runningServers]);

  // Load backlinks for current file
  const loadBacklinks = useCallback(async () => {
    if (!dbReady || !activeFile) return;
    try {
      // Extract the note name without extension
      const noteName = activeFile.name.replace(/\.[^.]+$/, "");
      const links = await dbGetBacklinks(noteName);
      setBacklinks(links);
    } catch (e) {
      console.error("Failed to load backlinks:", e);
    }
  }, [dbReady, activeFile]);

  // Load vault statistics
  const loadVaultStats = useCallback(async () => {
    if (!dbReady) return;
    try {
      const stats = await dbGetStats();
      setVaultStats(stats);
    } catch (e) {
      console.error("Failed to load vault stats:", e);
    }
  }, [dbReady]);

  // Load tags when panel opens
  useEffect(() => {
    if (showTagsPanel) {
      loadTags();
    }
  }, [showTagsPanel, loadTags]);

  // Load projects when database is ready
  useEffect(() => {
    if (dbReady) {
      loadProjects();
    }
  }, [dbReady, loadProjects]);

  // Load dev projects when database is ready
  useEffect(() => {
    if (dbReady) {
      loadDevProjects();
    }
  }, [dbReady, loadDevProjects]);

  // Listen for refresh events from child components
  useRefreshListener('devProjects', loadDevProjects);
  useRefreshListener('projects', loadProjects);

  // Load backlinks when panel opens or file changes
  useEffect(() => {
    if (showBacklinks && activeFile) {
      loadBacklinks();
    }
  }, [showBacklinks, activeFile, loadBacklinks]);

  // Load stats when panel opens
  useEffect(() => {
    if (showVaultStats) {
      loadVaultStats();
    }
  }, [showVaultStats, loadVaultStats]);

  // Terminal output event listener
  useEffect(() => {
    const unlisten = listen<{ id: string; data: string; closed: boolean }>("terminal-output", (event) => {
      if (event.payload.data) {
        setShellOutput({ id: event.payload.id, data: event.payload.data });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Session persistence - save open tabs
  useEffect(() => {
    if (!activeVault?.id) return;

    if (openFiles.length === 0) {
      // Clear session when all tabs are closed
      localStorage.removeItem(`vault-session-${activeVault.id}`);
      return;
    }

    const sessionData = {
      tabs: openFiles.map(f => ({ path: f.path, name: f.name })),
      activeIndex: activeTabIndex,
    };
    localStorage.setItem(`vault-session-${activeVault.id}`, JSON.stringify(sessionData));
  }, [openFiles, activeTabIndex, activeVault?.id]);

  // Startup behavior - handle home page or session restore
  useEffect(() => {
    if (!dbReady || !activeVault?.id || !settingsLoaded || startupLoadedRef.current) return;
    startupLoadedRef.current = true;

    const handleStartup = async () => {
      const behavior = settings.startupBehavior;

      if (behavior === "home" && settings.homePage) {
        // Open the home page
        try {
          // Check if home page is a virtual path (inbox, tasks, project)
          if (isVirtualPath(settings.homePage)) {
            const fileType = getFileType(settings.homePage);
            const newFile: OpenFile = {
              path: settings.homePage,
              name: settings.homePageName || "Home",
              content: null,
              originalContent: null,
              binaryData: null,
              fileType,
              isDirty: false,
            };
            setOpenFiles([newFile]);
            setActiveTabIndex(0);
          } else {
            // Regular file
            const result = await readFile(settings.homePage);
            const fileType = getFileType(settings.homePageName || "file");
            const fileContent = result.binary ? null : result.content;
            const newFile: OpenFile = {
              path: settings.homePage,
              name: settings.homePageName || settings.homePage.split(/[/\\]/).pop() || "Home",
              content: fileContent,
              originalContent: fileContent,
              binaryData: result.binary ? base64ToArrayBuffer(result.data) : null,
              fileType,
              isDirty: false,
            };
            setOpenFiles([newFile]);
            setActiveTabIndex(0);
          }
        } catch (e) {
          console.error("Failed to open home page:", e);
        }
      } else if (behavior === "restore") {
        // Restore previous session
        try {
          const saved = localStorage.getItem(`vault-session-${activeVault.id}`);
          if (saved) {
            const session = JSON.parse(saved) as { tabs: { path: string; name: string }[]; activeIndex: number };
            if (session.tabs && session.tabs.length > 0) {
              const restoredFiles: OpenFile[] = [];
              for (const tab of session.tabs) {
                try {
                  // Check if tab is a virtual path (inbox, tasks, project)
                  if (isVirtualPath(tab.path)) {
                    const fileType = getFileType(tab.path);
                    restoredFiles.push({
                      path: tab.path,
                      name: tab.name,
                      content: null,
                      originalContent: null,
                      binaryData: null,
                      fileType,
                      isDirty: false,
                    });
                  } else {
                    // Regular file
                    const result = await readFile(tab.path);
                    const fileType = getFileType(tab.name);
                    const fileContent = result.binary ? null : result.content;
                    restoredFiles.push({
                      path: tab.path,
                      name: tab.name,
                      content: fileContent,
                      originalContent: fileContent,
                      binaryData: result.binary ? base64ToArrayBuffer(result.data) : null,
                      fileType,
                      isDirty: false,
                    });
                  }
                } catch (e) {
                  console.warn("Could not restore tab:", tab.path);
                }
              }
              if (restoredFiles.length > 0) {
                setOpenFiles(restoredFiles);
                setActiveTabIndex(Math.min(session.activeIndex, restoredFiles.length - 1));
              }
            }
          }
        } catch (e) {
          console.error("Failed to restore session:", e);
        }
      }
      // "empty" behavior - do nothing, start with no files open
    };

    handleStartup();
  }, [dbReady, activeVault?.id, settingsLoaded, settings.startupBehavior, settings.homePage, settings.homePageName]);

  // Terminal handlers
  const handleSpawnShell = useCallback(async (id: string, shellType?: string) => {
    await spawnShell(id, vaultPath || undefined, shellType as any);
  }, [vaultPath]);

  const handleWriteShell = useCallback(async (id: string, data: string) => {
    await writeShell(id, data);
  }, []);

  const handleResizeShell = useCallback(async (id: string, rows: number, cols: number) => {
    await resizeShell(id, rows, cols);
  }, []);

  const handleKillShell = useCallback(async (id: string) => {
    await killShell(id);
  }, []);

  // Track recent files (persisted to database)
  const addToRecentFiles = useCallback(async (path: string, name: string) => {
    // Update local state immediately
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== path);
      const updated = [{ path, name, openedAt: Date.now() }, ...filtered].slice(0, 10);
      return updated;
    });

    // Persist to database
    if (dbReady) {
      try {
        await dbAddRecent(path, name);
      } catch (e) {
        console.error("Failed to add recent file:", e);
      }
    }
  }, [dbReady]);

  // Toggle favorite (persisted to database)
  const toggleFavorite = useCallback(async (path: string) => {
    // Update local state immediately
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    // Persist to database
    if (dbReady) {
      try {
        await dbToggleFavorite(path);
      } catch (e) {
        console.error("Failed to toggle favorite:", e);
      }
    }
  }, [dbReady]);

  // Command palette commands
  const commands = useMemo(() => [
    { id: 'new-file', label: 'New File', shortcut: 'Ctrl+N', action: () => setNewFileModal({ folder: "" }) },
    { id: 'new-folder', label: 'New Folder', action: () => setNewFolderModal({ folder: "" }) },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => setSidebarCollapsed(p => !p) },
    { id: 'toggle-outline', label: 'Toggle Outline', shortcut: 'Ctrl+Shift+O', action: () => setShowOutline(p => !p) },
    { id: 'expand-all-folders', label: 'Expand All Folders', action: () => setExpandAllTrigger(p => p + 1) },
    { id: 'collapse-all-folders', label: 'Collapse All Folders', action: () => setCollapseAllTrigger(p => p + 1) },
    { id: 'recent-files', label: 'Recent Files', shortcut: 'Ctrl+Shift+E', action: () => setShowRecentFiles(true) },
    { id: 'tags-browser', label: 'Browse Tags', action: () => setShowTagsPanel(true) },
    { id: 'toggle-backlinks', label: 'Toggle Backlinks', action: () => setShowBacklinks(p => !p) },
    { id: 'vault-stats', label: 'Vault Statistics', action: () => setShowVaultStats(true) },
    { id: 'user-guide', label: 'User Guide', shortcut: 'F1', action: () => setShowUserGuide(true) },
    { id: 'settings', label: 'Open Settings', shortcut: 'Ctrl+,', action: () => setShowSettings(true) },
    { id: 'refresh', label: 'Refresh Files', action: () => refreshFiles() },
    { id: 'reindex-vault', label: 'Re-index Vault', action: () => reindexVault() },
    { id: 'toggle-theme', label: 'Toggle Theme', action: () => toggleTheme() },
    { id: 'manage-vaults', label: 'Manage Vaults', action: () => setVaultSelectModal(true) },
  ], [toggleTheme, reindexVault]);

  const filteredCommands = useMemo(() => {
    if (!commandQuery) return commands;
    const q = commandQuery.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q));
  }, [commands, commandQuery]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);

  // Modal state
  const [newFileModal, setNewFileModal] = useState<{ folder: string } | null>(
    null
  );
  const [newFolderModal, setNewFolderModal] = useState<{ folder: string } | null>(
    null
  );
  const [renameModal, setRenameModal] = useState<{ node: FileNode } | null>(
    null
  );
  const [deleteModal, setDeleteModal] = useState<{ node: FileNode } | null>(
    null
  );
  const [vaultSelectModal, setVaultSelectModal] = useState(false);
  const [unsavedChangesModal, setUnsavedChangesModal] = useState<{ tabIndex: number } | null>(null);

  // Load vault config
  useEffect(() => {
    loadVault();
  }, []);

  const loadVault = async () => {
    setLoading(true);
    setDbReady(false);
    try {
      // Load all vaults
      const vaultList = await getVaults();
      setVaults(vaultList);

      // Get active vault
      const active = await getActiveVault();
      if (active) {
        setActiveVaultState(active);
        setVaultPath(active.path);
        await refreshFiles();
        // Initialize database in background
        initializeDatabase();
      } else if (vaultList.length > 0) {
        // No active vault but vaults exist - activate first one
        const first = await setActiveVault(vaultList[0].id);
        setActiveVaultState(first);
        setVaultPath(first.path);
        await refreshFiles();
        // Initialize database in background
        initializeDatabase();
      } else {
        // No vaults - show vault selection
        setVaultSelectModal(true);
      }
    } catch (e) {
      console.error("Failed to load vault:", e);
      setVaultSelectModal(true);
    } finally {
      setLoading(false);
    }
  };

  const refreshFiles = useCallback(async () => {
    try {
      const result = await getFileTree();
      if (result.tree) {
        setFiles(result.tree);
        setVaultPath(result.vaultPath);
      }
    } catch (e) {
      console.error("Failed to load files:", e);
    }
  }, []);

  // Listen for 'files' refresh events
  useRefreshListener('files', refreshFiles);

  // Open a virtual tab (inbox, tasks, project)
  const openVirtualTab = useCallback((virtualPath: string, name: string) => {
    const existingIndex = openFiles.findIndex((f) => f.path === virtualPath);
    if (existingIndex !== -1) {
      setActiveTabIndex(existingIndex);
      return;
    }

    const fileType = getFileType(virtualPath);
    const newFile: OpenFile = {
      path: virtualPath,
      name,
      content: null,
      originalContent: null,
      binaryData: null,
      fileType,
      isDirty: false,
    };

    setOpenFiles((prev) => [...prev, newFile]);
    setActiveTabIndex(openFiles.length);
  }, [openFiles]);

  const handleSelectFile = async (node: FileNode) => {
    if (node.type === "folder") return;

    // Check if file is already open
    const existingIndex = openFiles.findIndex((f) => f.path === node.path);
    if (existingIndex !== -1) {
      // Switch to existing tab
      setActiveTabIndex(existingIndex);
      return;
    }

    try {
      const result = await readFile(node.path);
      const fileType = getFileType(node.name);

      const fileContent = result.binary ? null : result.content;
      const newFile: OpenFile = {
        path: node.path,
        name: node.name,
        content: fileContent,
        originalContent: fileContent,
        binaryData: result.binary ? base64ToArrayBuffer(result.data) : null,
        fileType,
        isDirty: false,
      };

      // Add new tab and switch to it
      setOpenFiles((prev) => [...prev, newFile]);
      setActiveTabIndex(openFiles.length);

      // Track in recent files
      addToRecentFiles(node.path, node.name);
    } catch (e) {
      console.error("Failed to read file:", e);
    }
  };

  const handleSaveFile = async (content: string) => {
    if (!activeFile) return;
    try {
      await saveFile(activeFile.path, content);
      // Update the file's content and reset dirty state after successful save
      setOpenFiles((prev) =>
        prev.map((f, i) =>
          i === activeTabIndex
            ? { ...f, content, originalContent: content, isDirty: false }
            : f
        )
      );
      // Re-index tasks if this is a task file so due dates etc. are updated in the database
      if (activeFile.fileType === "task" && vaultPath) {
        dbIndexTasks(vaultPath).catch(console.error);
      }
      toast.success("File saved");
    } catch (err) {
      toast.error("Failed to save file");
      console.error("Save error:", err);
    }
  };

  // Handle content change from editor - track dirty state
  const handleContentChange = useCallback((content: string) => {
    setOpenFiles((prev) =>
      prev.map((f, i) => {
        if (i !== activeTabIndex) return f;
        const isDirty = content !== f.originalContent;
        return { ...f, content, isDirty };
      })
    );
  }, [activeTabIndex]);

  const handleCloseFile = () => {
    handleCloseTab(activeTabIndex);
  };

  const handleCloseTab = (index: number) => {
    // Check if tab has unsaved changes
    const fileToClose = openFiles[index];
    if (fileToClose?.isDirty && settings.confirmDelete) {
      // Show confirmation modal
      setUnsavedChangesModal({ tabIndex: index });
      return;
    }
    forceCloseTab(index);
  };

  const forceCloseTab = (index: number) => {
    setOpenFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Adjust active index if needed
      if (newFiles.length === 0) {
        setActiveTabIndex(0);
      } else if (index <= activeTabIndex) {
        setActiveTabIndex(Math.max(0, activeTabIndex - 1));
      }
      return newFiles;
    });
  };

  const handleSelectTab = (index: number) => {
    setActiveTabIndex(index);
  };

  const handleMoveItem = async (oldPath: string, newPath: string) => {
    try {
      await moveItem(oldPath, newPath);
      await refreshFiles();
    } catch (e) {
      console.error("Failed to move item:", e);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleCreateFile = async (folder: string, name: string) => {
    // If no extension provided, default to .md
    const hasExtension = name.includes(".") && name.lastIndexOf(".") > 0;
    const fileName = hasExtension ? name : `${name}.md`;
    const relativePath = folder ? `${folder}\\${fileName}` : fileName;
    try {
      await createFile(relativePath);
      await refreshFiles();
    } catch (e) {
      console.error("Failed to create file:", e);
    }
  };

  const handleCreateFolder = async (parent: string, name: string) => {
    const relativePath = parent ? `${parent}\\${name}` : name;
    try {
      await createFolder(relativePath);
      await refreshFiles();
    } catch (e) {
      console.error("Failed to create folder:", e);
    }
  };

  const handleRename = async (node: FileNode, newName: string) => {
    const parentPath = node.path.substring(0, node.path.lastIndexOf("\\"));
    const newPath = `${parentPath}\\${newName}`;
    try {
      await moveItem(node.path, newPath);
      await refreshFiles();
      // Update the file in tabs if it's open
      const tabIndex = openFiles.findIndex((f) => f.path === node.path);
      if (tabIndex !== -1) {
        setOpenFiles((prev) =>
          prev.map((f, i) =>
            i === tabIndex ? { ...f, path: newPath, name: newName } : f
          )
        );
      }
    } catch (e) {
      console.error("Failed to rename:", e);
    }
  };

  const handleDelete = async (node: FileNode) => {
    try {
      if (node.type === "folder") {
        await deleteFolder(node.path);
        toast.info("Folder deleted");
      } else {
        await deleteFile(node.path);
        toast.info("File deleted");
      }
      await refreshFiles();
      // Close tab if the file was open
      const tabIndex = openFiles.findIndex((f) => f.path === node.path);
      if (tabIndex !== -1) {
        handleCloseTab(tabIndex);
      }
    } catch (e) {
      toast.error("Failed to delete");
      console.error("Failed to delete:", e);
    }
  };

  const handleSearch = useCallback(
    async (query: string, searchContent: boolean) => {
      // Use database FTS for content search if available
      if (searchContent && dbReady) {
        try {
          const dbResults = await dbSearch(query, 50);
          return dbResults.map(r => ({
            path: r.path,
            relativePath: r.path,
            name: r.name,
            match: r.snippet,
          }));
        } catch (e) {
          console.error("DB search failed, falling back:", e);
        }
      }
      // Fallback to file system search
      const result = await searchVault(query, searchContent);
      return result.results || [];
    },
    [dbReady]
  );

  const handleSearchSelect = async (result: { path: string; name: string }) => {
    // Close task and project views when selecting a file
    setShowTaskView(false);
    setShowProjectView(false);

    // Check if file is already open
    const existingIndex = openFiles.findIndex((f) => f.path === result.path);
    if (existingIndex !== -1) {
      setActiveTabIndex(existingIndex);
      return;
    }

    try {
      const file = await readFile(result.path);
      const fileType = getFileType(result.name);

      const newFile: OpenFile = {
        path: result.path,
        name: result.name,
        content: file.binary ? null : file.content,
        binaryData: file.binary ? base64ToArrayBuffer(file.data) : null,
        fileType,
      };

      setOpenFiles((prev) => [...prev, newFile]);
      setActiveTabIndex(openFiles.length);

      // Track in recent files
      addToRecentFiles(result.path, result.name);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  const handleAddVault = async (name: string, path: string) => {
    try {
      const vault = await addVault(name, path);
      setVaults((prev) => [...prev, vault]);
      // Actually switch to the new vault in the backend
      await setActiveVault(vault.id);
      setActiveVaultState(vault);
      setVaultPath(vault.path);
      setVaultSelectModal(false);
      setAddVaultMode(false);
      setNewVaultName("");
      setNewVaultPath("");
      // Close all open tabs from previous vault
      setOpenFiles([]);
      setActiveTabIndex(0);
      setDbReady(false); // Reset database state
      await refreshFiles();
      // Initialize database for new vault
      initializeDatabase();
    } catch (e) {
      console.error("Failed to add vault:", e);
      alert("Failed to add vault. Please check the path exists.");
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Vault Folder",
      });
      if (selected && typeof selected === "string") {
        setNewVaultPath(selected);
        // Auto-fill name from folder name if empty
        if (!newVaultName) {
          const folderName = selected.split(/[/\\]/).pop() || "Vault";
          setNewVaultName(folderName);
        }
      }
    } catch (e) {
      console.error("Failed to open folder dialog:", e);
    }
  };

  const handleSwitchVault = async (vaultId: string) => {
    try {
      const vault = await setActiveVault(vaultId);
      setActiveVaultState(vault);
      setVaultPath(vault.path);
      setVaultDropdownOpen(false);
      // Close all open tabs
      setOpenFiles([]);
      setActiveTabIndex(0);
      setDbReady(false); // Reset database state
      await refreshFiles();
      // Initialize database for switched vault
      initializeDatabase();
    } catch (e) {
      console.error("Failed to switch vault:", e);
    }
  };

  const handleRemoveVault = async (vaultId: string) => {
    try {
      await removeVault(vaultId);
      setVaults((prev) => prev.filter((v) => v.id !== vaultId));

      // If we removed the active vault, load another one
      if (activeVault?.id === vaultId) {
        const remaining = vaults.filter((v) => v.id !== vaultId);
        if (remaining.length > 0) {
          await handleSwitchVault(remaining[0].id);
        } else {
          setActiveVaultState(null);
          setVaultPath(null);
          setFiles([]);
          setVaultSelectModal(true);
        }
      }
    } catch (e) {
      console.error("Failed to remove vault:", e);
    }
  };

  // Legacy compatibility
  const handleSetVaultPath = async (path: string) => {
    const name = path.split(/[/\\]/).pop() || "Vault";
    await handleAddVault(name, path);
  };

  // Copy path to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (e) {
      toast.error("Failed to copy");
      console.error("Failed to copy to clipboard:", e);
    }
  }, [toast]);

  // Duplicate a file
  const handleDuplicateFile = useCallback(async (node: FileNode) => {
    if (node.type === "folder") return;

    try {
      // Read the original file
      const result = await readFile(node.path);

      // Generate new name with " copy" suffix
      const ext = node.name.lastIndexOf(".");
      const baseName = ext > 0 ? node.name.slice(0, ext) : node.name;
      const extension = ext > 0 ? node.name.slice(ext) : "";
      const newName = `${baseName} copy${extension}`;

      // Get parent path
      const parentPath = node.relativePath.substring(0, node.relativePath.lastIndexOf("\\")) || "";
      const newRelativePath = parentPath ? `${parentPath}\\${newName}` : newName;

      // Create new file with content
      await createFile(newRelativePath);
      if (!result.binary && result.content) {
        const newFullPath = vaultPath ? `${vaultPath}\\${newRelativePath}` : newRelativePath;
        await saveFile(newFullPath, result.content);
      }

      await refreshFiles();
    } catch (e) {
      console.error("Failed to duplicate file:", e);
    }
  }, [vaultPath]);

  const getContextMenuItems = (node: FileNode): MenuItem[] => {
    const items: MenuItem[] = [];
    const isFavorite = favorites.has(node.path);

    if (node.type === "folder") {
      items.push(
        {
          label: "New File",
          icon: <Plus className="w-4 h-4" />,
          action: () => setNewFileModal({ folder: node.relativePath }),
        },
        {
          label: "New Folder",
          icon: <FolderPlus className="w-4 h-4" />,
          action: () => setNewFolderModal({ folder: node.relativePath }),
          divider: true,
        },
        {
          label: "Copy Path",
          icon: <Clipboard className="w-4 h-4" />,
          action: () => copyToClipboard(node.path),
        },
        {
          label: "Copy Relative Path",
          icon: <Copy className="w-4 h-4" />,
          action: () => copyToClipboard(node.relativePath),
          divider: true,
        },
        {
          label: "Rename",
          icon: <Pencil className="w-4 h-4" />,
          action: () => setRenameModal({ node }),
        },
        {
          label: "Delete",
          icon: <Trash2 className="w-4 h-4" />,
          action: () => setDeleteModal({ node }),
          danger: true,
        }
      );
    } else {
      const isHomePage = settings.homePage === node.path;
      items.push(
        {
          label: "Open",
          icon: <FileText className="w-4 h-4" />,
          action: () => handleSelectFile(node),
        },
        {
          label: isFavorite ? "Remove from Favorites" : "Add to Favorites",
          icon: <Star className={`w-4 h-4 ${isFavorite ? "fill-current text-yellow-500" : ""}`} />,
          action: () => toggleFavorite(node.path),
        },
        {
          label: isHomePage ? "Remove as Home Page" : "Set as Home Page",
          icon: <Home className={`w-4 h-4 ${isHomePage ? "text-primary" : ""}`} />,
          action: () => {
            if (isHomePage) {
              updateSettings({ ...settings, homePage: null, homePageName: null });
            } else {
              updateSettings({ ...settings, homePage: node.path, homePageName: node.name });
            }
          },
          divider: true,
        },
        {
          label: "Copy Path",
          icon: <Clipboard className="w-4 h-4" />,
          action: () => copyToClipboard(node.path),
        },
        {
          label: "Copy Relative Path",
          icon: <Copy className="w-4 h-4" />,
          action: () => copyToClipboard(node.relativePath),
          divider: true,
        },
        {
          label: "Duplicate",
          icon: <Files className="w-4 h-4" />,
          action: () => handleDuplicateFile(node),
        },
        {
          label: "Rename",
          icon: <Pencil className="w-4 h-4" />,
          action: () => setRenameModal({ node }),
        },
        {
          label: "Delete",
          icon: <Trash2 className="w-4 h-4" />,
          action: () => setDeleteModal({ node }),
          danger: true,
        }
      );
    }

    return items;
  };

  // Theme icon helper
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  // Vault selection/management screen
  if (vaultSelectModal || (!loading && !vaultPath)) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="bg-card rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-app">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-app">
                {vaults.length > 0 ? "Your Vaults" : "Welcome to Vault"}
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                title={`Theme: ${theme}`}
                className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              >
                <ThemeIcon className="w-5 h-5" />
              </button>
              {vaults.length > 0 && activeVault && (
                <button
                  onClick={() => setVaultSelectModal(false)}
                  className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Existing vaults */}
          {vaults.length > 0 && !addVaultMode && (
            <div className="mb-6">
              <p className="text-muted mb-4">Select a vault to open or add a new one.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {vaults.map((vault) => (
                  <div
                    key={vault.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      activeVault?.id === vault.id
                        ? "border-primary bg-primary/10"
                        : "border-app hover:border-primary/50 hover:bg-accent"
                    }`}
                    onClick={() => handleSwitchVault(vault.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-app truncate">{vault.name}</p>
                        <p className="text-xs text-muted truncate">{vault.path}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {activeVault?.id === vault.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove "${vault.name}" from your vaults?`)) {
                            handleRemoveVault(vault.id);
                          }
                        }}
                        className="p-1 text-muted hover:text-destructive rounded transition-colors"
                        title="Remove vault"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setAddVaultMode(true)}
                className="w-full mt-4 py-3 border border-dashed border-app hover:border-primary text-muted hover:text-app font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Vault
              </button>
            </div>
          )}

          {/* Add vault form */}
          {(vaults.length === 0 || addVaultMode) && (
            <div>
              <p className="text-muted mb-4">
                {vaults.length === 0
                  ? "Add your first vault to get started."
                  : "Add a new vault to your collection."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newVaultName && newVaultPath) {
                    handleAddVault(newVaultName, newVaultPath);
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="Vault name (e.g., Work Notes)"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  className="w-full px-4 py-3 bg-app border border-input rounded-lg text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                />
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="D:\Path\To\Your\Vault"
                    value={newVaultPath}
                    onChange={(e) => setNewVaultPath(e.target.value)}
                    className="flex-1 px-4 py-3 bg-app border border-input rounded-lg text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="px-4 py-3 bg-secondary hover:bg-accent text-app font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
                <div className="flex gap-3">
                  {addVaultMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddVaultMode(false);
                        setNewVaultName("");
                        setNewVaultPath("");
                      }}
                      className="flex-1 py-3 bg-secondary hover:bg-accent text-app font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!newVaultName || !newVaultPath}
                    className="flex-1 py-3 bg-primary hover:opacity-90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {vaults.length === 0 ? "Open Vault" : "Add Vault"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-app border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app flex">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`bg-sidebar border-r border-sidebar flex flex-col ${
          sidebarCollapsed ? "w-0 overflow-hidden" : ""
        } ${isResizing ? "" : "transition-all duration-200"}`}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-sidebar">
          {/* Vault selector dropdown */}
          <div className="relative mb-3">
            <button
              onClick={() => setVaultDropdownOpen(!vaultDropdownOpen)}
              className="flex items-center gap-2 text-lg font-bold text-app hover:text-primary transition-colors w-full"
            >
              <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="truncate">{activeVault?.name || "Vault"}</span>
              <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${vaultDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown menu */}
            {vaultDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setVaultDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-app rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
                  {vaults.map((vault) => (
                    <button
                      key={vault.id}
                      onClick={() => handleSwitchVault(vault.id)}
                      className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent transition-colors ${
                        activeVault?.id === vault.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="truncate flex-1 text-app">{vault.name}</span>
                      {activeVault?.id === vault.id && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-app my-1" />
                  <button
                    onClick={() => {
                      setVaultDropdownOpen(false);
                      setVaultSelectModal(true);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent transition-colors text-muted hover:text-app"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Manage Vaults...</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap mb-3">
            <button
              onClick={() => setNewFileModal({ folder: "" })}
              title="New File (Ctrl+N)"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setNewFolderModal({ folder: "" })}
              title="New Folder"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpandAllTrigger(p => p + 1)}
              title="Expand All Folders"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCollapseAllTrigger(p => p + 1)}
              title="Collapse All Folders"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowRecentFiles(true)}
              title="Recent Files (Ctrl+Shift+E)"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <Clock className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCommandPalette(true)}
              title="Command Palette (Ctrl+K)"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <Command className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              title="Toggle Terminal (Ctrl+`)"
              className={`p-1.5 hover:bg-accent rounded-lg transition-colors ${showTerminal ? 'text-primary' : 'text-muted hover:text-app'}`}
            >
              <TerminalSquare className="w-4 h-4" />
            </button>
            <button
              onClick={refreshFiles}
              title="Refresh Files"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              title={`Theme: ${theme}`}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <ThemeIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              title="Settings (Ctrl+,)"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
          <SearchBar onSearch={handleSearch} onSelect={handleSearchSelect} />
        </div>

        {/* Inbox */}
        <div className="border-b border-sidebar">
          <button
            onClick={() => openVirtualTab(VIRTUAL_PATHS.INBOX, "Inbox")}
            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
              activeFile?.path === VIRTUAL_PATHS.INBOX
                ? "bg-accent text-app"
                : "text-muted hover:text-app"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span className="text-sm font-medium">Inbox</span>
          </button>
        </div>

        {/* Calendar */}
        <div className="border-b border-sidebar">
          <button
            onClick={() => openVirtualTab(VIRTUAL_PATHS.CALENDAR, "Calendar")}
            className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
              activeFile?.path === VIRTUAL_PATHS.CALENDAR
                ? "bg-accent text-app"
                : "text-muted hover:text-app"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Calendar</span>
          </button>
        </div>

        {/* Tasks Section */}
        <div className="border-b border-sidebar">
          <button
            onClick={() => setTasksExpanded(!tasksExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-muted" />
              <span className="text-sm font-medium">Tasks</span>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-muted transition-transform ${
                tasksExpanded ? "rotate-90" : ""
              }`}
            />
          </button>
          {tasksExpanded && (
            <div className="px-2 pb-2 space-y-0.5">
              <button
                onClick={() => openVirtualTab(VIRTUAL_PATHS.TASKS_TODAY, "Today")}
                className={`w-full px-3 py-1.5 flex items-center gap-2 rounded-md text-sm transition-colors ${
                  activeFile?.path === VIRTUAL_PATHS.TASKS_TODAY
                    ? "bg-accent text-app"
                    : "text-muted hover:bg-accent hover:text-app"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Today
              </button>
              <button
                onClick={() => openVirtualTab(VIRTUAL_PATHS.TASKS_UPCOMING, "Upcoming")}
                className={`w-full px-3 py-1.5 flex items-center gap-2 rounded-md text-sm transition-colors ${
                  activeFile?.path === VIRTUAL_PATHS.TASKS_UPCOMING
                    ? "bg-accent text-app"
                    : "text-muted hover:bg-accent hover:text-app"
                }`}
              >
                <CalendarClock className="w-4 h-4" />
                Upcoming
              </button>
              <button
                onClick={() => openVirtualTab(VIRTUAL_PATHS.TASKS_ALL, "All Tasks")}
                className={`w-full px-3 py-1.5 flex items-center gap-2 rounded-md text-sm transition-colors ${
                  activeFile?.path === VIRTUAL_PATHS.TASKS_ALL
                    ? "bg-accent text-app"
                    : "text-muted hover:bg-accent hover:text-app"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                All Tasks
              </button>
            </div>
          )}
        </div>

        {/* Dev Projects Section */}
        <div className="border-b border-sidebar">
          <div className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent transition-colors">
            <div
              className="flex items-center gap-2 flex-1 cursor-pointer"
              onClick={() => setDevProjectsExpanded(!devProjectsExpanded)}
            >
              <Rocket className="w-4 h-4 text-muted" />
              <span className="text-sm font-medium">Dev Projects</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="relative group/devmenu">
                <button
                  className="p-1 text-muted hover:text-app rounded transition-colors"
                  title="Add dev project"
                >
                  <Plus className="w-3 h-3" />
                </button>
                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-app rounded-lg shadow-lg opacity-0 invisible group-hover/devmenu:opacity-100 group-hover/devmenu:visible transition-all z-50">
                  <button
                    onClick={() => setShowDevProjectCreateWizard(true)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent rounded-t-lg flex items-center gap-2"
                  >
                    <FolderPlus className="w-3 h-3" />
                    Create New
                  </button>
                  <button
                    onClick={() => setShowDevProjectWizard(true)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent rounded-b-lg flex items-center gap-2"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Add Existing
                  </button>
                </div>
              </div>
              <div
                onClick={() => setDevProjectsExpanded(!devProjectsExpanded)}
                className="cursor-pointer"
              >
                <ChevronRight
                  className={`w-4 h-4 text-muted transition-transform ${
                    devProjectsExpanded ? "rotate-90" : ""
                  }`}
                />
              </div>
            </div>
          </div>
            {devProjectsExpanded && (
              <div className="px-2 pb-2 space-y-0.5">
                {devProjects.map((project) => {
                  const server = runningServers.get(project.path);
                  const isRunning = server?.status === "running";
                  const isStarting = server?.status === "starting";
                  const devProjectVirtualPath = `${VIRTUAL_PATHS.DEVPROJECT_PREFIX}${project.id}`;
                  return (
                    <div
                      key={project.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent group cursor-pointer ${
                        activeFile?.path === devProjectVirtualPath ? "bg-accent" : ""
                      }`}
                      onClick={() => openVirtualTab(devProjectVirtualPath, project.name)}
                    >
                      {/* Status dot */}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isRunning
                            ? "bg-green-500"
                            : isStarting
                              ? "bg-amber-500 animate-pulse"
                              : "bg-gray-400"
                        }`}
                      />
                      {/* Name */}
                      <span className="flex-1 truncate text-sm">{project.name}</span>
                      {/* Port */}
                      <span className="text-xs text-muted">:{project.port}</span>
                      {/* Delete action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDevProjectToDelete(project);
                        }}
                        className="p-1 text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Delete project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {devProjects.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted">
                    No dev projects yet
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Projects Section */}
        <div className="border-b border-sidebar">
          <div
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer"
          >
            <div
              className="flex items-center gap-2 flex-1"
              onClick={() => setProjectsExpanded(!projectsExpanded)}
            >
              <FolderKanban className="w-4 h-4 text-muted" />
              <span className="text-sm font-medium">Projects</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowProjectWizard(true)}
                className="p-1 text-muted hover:text-app rounded transition-colors"
                title="Create project"
              >
                <Plus className="w-3 h-3" />
              </button>
              <div
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                className="cursor-pointer"
              >
                <ChevronRight
                  className={`w-4 h-4 text-muted transition-transform ${
                    projectsExpanded ? "rotate-90" : ""
                  }`}
                />
              </div>
            </div>
          </div>
          {projectsExpanded && (
            <div className="px-2 pb-2 space-y-0.5">
              {projects.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => {
                  const projectVirtualPath = `${VIRTUAL_PATHS.PROJECT_PREFIX}${project.path}`;
                  return (
                    <div
                      key={project.id}
                      className={`w-full px-3 py-1.5 flex items-center gap-2 rounded-md text-sm transition-colors group cursor-pointer ${
                        activeFile?.path === projectVirtualPath
                          ? "bg-accent text-app"
                          : "text-muted hover:bg-accent hover:text-app"
                      }`}
                      onClick={() => openVirtualTab(projectVirtualPath, project.name)}
                    >
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: project.color || "#3b82f6" }}
                      />
                      <span className="truncate flex-1">{project.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project);
                        }}
                        className="p-1 text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                        title="Delete project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Files Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className="flex-shrink-0 w-full px-3 py-2 flex items-center justify-between hover:bg-accent transition-colors border-b border-sidebar cursor-pointer"
          >
            <div
              className="flex items-center gap-2 flex-1"
              onClick={() => setFilesExpanded(!filesExpanded)}
            >
              <Files className="w-4 h-4 text-muted" />
              <span className="text-sm font-medium">Files</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setNewFileModal({ folder: "" })}
                className="p-1 text-muted hover:text-app rounded transition-colors"
                title="New file"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => setNewFolderModal({ folder: "" })}
                className="p-1 text-muted hover:text-app rounded transition-colors"
                title="New folder"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <div
                onClick={() => setFilesExpanded(!filesExpanded)}
                className="cursor-pointer"
              >
                <ChevronRight
                  className={`w-4 h-4 text-muted transition-transform ${
                    filesExpanded ? "rotate-90" : ""
                  }`}
                />
              </div>
            </div>
          </div>
          {filesExpanded && (
            <div className="flex-1 overflow-y-auto">
              <FileTree
                nodes={files}
                selectedPath={activeFile?.path}
                onSelect={handleSelectFile}
                onMove={handleMoveItem}
                onContextMenu={handleContextMenu}
                onCreateFile={(folder) => setNewFileModal({ folder })}
                onCreateFolder={(folder) => setNewFolderModal({ folder })}
                defaultFoldersOpen={settings.defaultFoldersOpen}
                foldersOpenDepth={settings.foldersOpenDepth}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                expandAllTrigger={expandAllTrigger}
                collapseAllTrigger={collapseAllTrigger}
              />
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-sidebar text-xs text-muted">
          {indexingStatus ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>{indexingStatus}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVaultSelectModal(true)}
                className="hover:text-app transition-colors truncate flex-1 text-left"
                title={vaultPath || ""}
              >
                {vaultPath}
              </button>
              <button
                onClick={reindexVault}
                className={`p-1 rounded transition-colors flex-shrink-0 ${
                  dbReady
                    ? "text-primary hover:bg-accent"
                    : "text-muted hover:text-app hover:bg-accent"
                }`}
                title={dbReady ? "Re-index vault (database ready)" : "Index vault (click to initialize)"}
              >
                <Database className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Resize handle */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={() => setIsResizing(true)}
          className={`w-1 hover:w-1.5 bg-transparent hover:bg-primary cursor-col-resize transition-all flex-shrink-0 ${
            isResizing ? "w-1.5 bg-primary" : ""
          }`}
          title="Drag to resize sidebar"
        />
      )}

      {/* Sidebar collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 z-10 p-1 bg-secondary hover:bg-accent rounded-r-lg transition-colors"
        style={{ left: sidebarCollapsed ? 0 : sidebarWidth + 3 }}
      >
        <svg
          className={`w-4 h-4 text-muted transition-transform ${
            sidebarCollapsed ? "" : "rotate-180"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {/* Main content area */}
      <div className={`flex-1 flex ${terminalPosition === 'right' && showTerminal ? 'flex-row' : 'flex-col'} min-h-0`}>
        {/* Main editor area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Tab bar */}
          {openFiles.length > 0 && (
            <TabBar
              tabs={openFiles.map((f) => ({
                path: f.path,
                name: f.name,
                isDirty: f.isDirty,
                fileType: f.fileType,
              }))}
              activeIndex={activeTabIndex}
              onSelect={handleSelectTab}
              onClose={handleCloseTab}
            />
          )}

        <div className="flex-1 flex overflow-hidden">
          {/* Editor (handles files, tasks, projects, inbox) */}
          <div className="flex-1 flex flex-col">
            {activeFile ? (
              <Editor
                key={activeFile.path}  // Force remount when switching files for fresh state
                content={activeFile.content}
                binaryData={activeFile.binaryData}
                filePath={activeFile.path}
                fileName={activeFile.name}
                fileType={activeFile.fileType}
                onSave={handleSaveFile}
                onClose={handleCloseFile}
                onChange={handleContentChange}
                defaultViewMode={settings.defaultViewMode}
                isDark={isDark}
                vaultPath={vaultPath || undefined}
                onOpenFile={(path) => handleSelectFile({ path, name: path.split(/[/\\]/).pop() || "", type: "file", relative_path: path })}
                onFileDeleted={refreshFiles}
                devServerState={currentDevServerState}
                onStartDevServer={startDevServerById}
                onStopDevServer={stopDevServerById}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a note to open</p>
                  <p className="text-sm mt-2">Or press Ctrl+P to search</p>
                </div>
              </div>
            )}
          </div>

          {/* Right side panels */}
          {(showOutline || showBacklinks) && activeFile && (
            <div className="w-64 border-l border-app bg-sidebar flex flex-col">
              {/* Outline section */}
              {showOutline && activeFile.fileType === 'md' && (
                <>
                  <div className="p-3 border-b border-sidebar flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4 text-muted" />
                      <span className="text-sm font-medium text-app">Outline</span>
                    </div>
                    <button
                      onClick={() => setShowOutline(false)}
                      className="p-1 text-muted hover:text-app rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 max-h-[40vh]">
                    {outlineHeadings.length > 0 ? (
                      outlineHeadings.map((heading, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left px-2 py-1 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors truncate"
                          style={{ paddingLeft: `${(heading.level - 1) * 12 + 8}px` }}
                          title={heading.text}
                        >
                          {heading.text}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted p-2">No headings found</p>
                    )}
                  </div>
                </>
              )}

              {/* Backlinks section */}
              {showBacklinks && (
                <>
                  <div className="p-3 border-b border-sidebar flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-muted" />
                      <span className="text-sm font-medium text-app">Backlinks</span>
                    </div>
                    <button
                      onClick={() => setShowBacklinks(false)}
                      className="p-1 text-muted hover:text-app rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {!dbReady ? (
                      <p className="text-xs text-muted p-2">Index vault to see backlinks</p>
                    ) : backlinks.length > 0 ? (
                      backlinks.map((note) => (
                        <button
                          key={note.path}
                          onClick={() => handleSearchSelect({ path: note.path, name: note.name })}
                          className="w-full text-left px-2 py-1.5 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors truncate"
                          title={note.path}
                        >
                          {note.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted p-2">No backlinks found</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status bar */}
        {activeFile && fileStats && (
          <div className="h-6 px-3 bg-sidebar border-t border-sidebar flex items-center justify-between text-xs text-muted">
            <div className="flex items-center gap-4">
              <span>{activeFile.fileType}</span>
              <span>{activeFile.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{fileStats.lineCount} lines</span>
              <span>{fileStats.wordCount} words</span>
              <span>{fileStats.charCount} chars</span>
              {activeFile.fileType === 'md' && (
                <button
                  onClick={() => setShowOutline(!showOutline)}
                  className={`flex items-center gap-1 hover:text-app transition-colors ${showOutline ? 'text-primary' : ''}`}
                  title="Toggle Outline (Ctrl+Shift+O)"
                >
                  <List className="w-3 h-3" />
                  Outline
                </button>
              )}
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className={`flex items-center gap-1 hover:text-app transition-colors ${showTerminal ? 'text-primary' : ''}`}
                title="Toggle Terminal (Ctrl+`)"
              >
                <TerminalSquare className="w-3 h-3" />
                Terminal
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Terminal panel */}
        {showTerminal && (
          <TerminalPanel
            isOpen={showTerminal}
            onClose={() => setShowTerminal(false)}
            position={terminalPosition}
            onPositionChange={setTerminalPosition}
            size={terminalSize}
            onSizeChange={setTerminalSize}
            isDark={isDark}
            workingDirectory={vaultPath || undefined}
            onSpawnShell={handleSpawnShell}
            onWriteShell={handleWriteShell}
            onResizeShell={handleResizeShell}
            onKillShell={handleKillShell}
            shellOutput={shellOutput}
          />
        )}

        {/* Dev Preview Panel */}
        {previewUrl && (
          <DevPreviewPanel
            url={previewUrl}
            onClose={() => setPreviewUrl(null)}
          />
        )}
      </div>

      {/* Recent files panel */}
      {showRecentFiles && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowRecentFiles(false)}
          />
          <div
            className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border border-app rounded-xl shadow-2xl z-50 overflow-hidden"
            onKeyDown={(e) => {
              if (recentFiles.length === 0) return;

              switch (e.key) {
                case "ArrowDown":
                  e.preventDefault();
                  setRecentFilesSelectedIndex((i) =>
                    i < recentFiles.length - 1 ? i + 1 : 0
                  );
                  break;
                case "ArrowUp":
                  e.preventDefault();
                  setRecentFilesSelectedIndex((i) =>
                    i > 0 ? i - 1 : recentFiles.length - 1
                  );
                  break;
                case "Enter":
                  e.preventDefault();
                  const selectedFile = recentFiles[recentFilesSelectedIndex];
                  if (selectedFile) {
                    handleSearchSelect({ path: selectedFile.path, name: selectedFile.name });
                    setShowRecentFiles(false);
                  }
                  break;
                case "Escape":
                  e.preventDefault();
                  setShowRecentFiles(false);
                  break;
                default:
                  // Number keys 1-9 for quick select
                  if (e.key >= "1" && e.key <= "9") {
                    const index = parseInt(e.key) - 1;
                    if (index < recentFiles.length) {
                      e.preventDefault();
                      const file = recentFiles[index];
                      handleSearchSelect({ path: file.path, name: file.name });
                      setShowRecentFiles(false);
                    }
                  }
              }
            }}
            tabIndex={0}
            ref={(el) => el?.focus()}
          >
            <div className="p-3 border-b border-app flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted" />
                <span className="font-medium text-app">Recent Files</span>
                <span className="text-xs text-muted">({recentFiles.length})</span>
              </div>
              <div className="flex items-center gap-1">
                {recentFiles.length > 0 && (
                  <button
                    onClick={() => setRecentFiles([])}
                    className="px-2 py-1 text-xs text-muted hover:text-destructive rounded transition-colors"
                    title="Clear recent files"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowRecentFiles(false)}
                  className="p-1 text-muted hover:text-app rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {recentFiles.length > 0 ? (
                recentFiles.map((file, index) => {
                  const fileType = getFileType(file.name);
                  const isFavorite = favorites.has(file.path);
                  const isSelected = index === recentFilesSelectedIndex;

                  return (
                    <button
                      key={file.path}
                      onClick={() => {
                        handleSearchSelect({ path: file.path, name: file.name });
                        setShowRecentFiles(false);
                      }}
                      onMouseEnter={() => setRecentFilesSelectedIndex(index)}
                      className={`w-full px-4 py-2 text-left transition-colors flex items-center gap-3 ${
                        isSelected ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      {/* Quick select number */}
                      <span className="w-4 text-xs text-muted/50 flex-shrink-0">
                        {index < 9 ? index + 1 : ""}
                      </span>

                      {/* File type icon */}
                      <div className="flex-shrink-0">
                        {getFileTypeIcon(fileType)}
                      </div>

                      {/* File info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-app truncate">{file.name}</p>
                          {isFavorite && (
                            <Star className="w-3 h-3 text-yellow-500 fill-current flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted truncate">
                          {formatRelativeTime(file.openedAt)}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="p-4 text-center text-muted text-sm">No recent files</p>
              )}
            </div>
            {recentFiles.length > 0 && (
              <div className="p-2 border-t border-app text-xs text-muted text-center">
                ↑↓ navigate | Enter open | 1-9 quick select | Esc close
              </div>
            )}
          </div>
        </>
      )}

      {/* Command palette */}
      {showCommandPalette && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowCommandPalette(false)}
          />
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border border-app rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-app">
              <div className="flex items-center gap-2 px-3 py-2 bg-app border border-input rounded-lg">
                <Command className="w-4 h-4 text-muted" />
                <input
                  type="text"
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent text-app placeholder:text-muted focus:outline-none text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setShowCommandPalette(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between"
                >
                  <span className="text-sm text-app">{cmd.label}</span>
                  {cmd.shortcut && (
                    <span className="text-xs text-muted bg-secondary px-2 py-0.5 rounded">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <p className="p-4 text-center text-muted text-sm">No commands found</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Tags Browser Panel */}
      {showTagsPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowTagsPanel(false)}
          />
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-card border border-app rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-app flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <span className="font-medium text-app">Tags</span>
              </div>
              <button
                onClick={() => setShowTagsPanel(false)}
                className="p-1 text-muted hover:text-app rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {!dbReady ? (
                <p className="text-center text-muted text-sm">Database not initialized. Re-index vault to enable tags.</p>
              ) : tags.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {tags.map(([tag, count]) => (
                      <button
                        key={tag}
                        onClick={() => loadTagNotes(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          selectedTag === tag
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-app border-app hover:border-primary"
                        }`}
                      >
                        #{tag} <span className="text-xs opacity-70">({count})</span>
                      </button>
                    ))}
                  </div>
                  {selectedTag && tagNotes.length > 0 && (
                    <div className="border-t border-app pt-4">
                      <h4 className="text-sm font-medium text-muted mb-2">Notes with #{selectedTag}</h4>
                      <div className="space-y-1">
                        {tagNotes.map((note) => (
                          <button
                            key={note.path}
                            onClick={() => {
                              handleSearchSelect({ path: note.path, name: note.name });
                              setShowTagsPanel(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-accent rounded-lg transition-colors"
                          >
                            <p className="text-sm text-app">{note.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted text-sm">No tags found. Add tags in YAML frontmatter of your notes.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Vault Statistics Panel */}
      {showVaultStats && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowVaultStats(false)}
          />
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border border-app rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-app flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="font-medium text-app">Vault Statistics</span>
              </div>
              <button
                onClick={() => setShowVaultStats(false)}
                className="p-1 text-muted hover:text-app rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {!dbReady ? (
                <p className="text-center text-muted text-sm">Database not initialized. Re-index vault to see statistics.</p>
              ) : vaultStats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-2xl font-bold text-primary">{vaultStats.notes}</p>
                    <p className="text-sm text-muted">Notes</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-2xl font-bold text-chart-1">{vaultStats.total_words.toLocaleString()}</p>
                    <p className="text-sm text-muted">Total Words</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-2xl font-bold text-chart-2">{vaultStats.tags}</p>
                    <p className="text-sm text-muted">Tags</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-2xl font-bold text-chart-3">{vaultStats.links}</p>
                    <p className="text-sm text-muted">Links</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-2xl font-bold text-chart-4">{vaultStats.favorites}</p>
                    <p className="text-sm text-muted">Favorites</p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-2xl font-bold text-chart-5">{files.length}</p>
                    <p className="text-sm text-muted">Total Files</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted text-sm">Loading statistics...</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* User Guide */}
      {showUserGuide && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowUserGuide(false)}
          />
          <div className="fixed top-10 left-1/2 -translate-x-1/2 w-full max-w-3xl max-h-[85vh] bg-card border border-app rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-app flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="text-lg font-semibold text-app">User Guide</span>
              </div>
              <button
                onClick={() => setShowUserGuide(false)}
                className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-sm max-w-none text-app">
                <h2 className="text-xl font-bold text-app mb-4">Welcome to Vault</h2>
                <p className="text-muted mb-6">
                  Vault is a powerful desktop application for managing your notes, documents, and files.
                  This guide covers all the features available to you.
                </p>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-primary" /> Getting Started
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li>Click the vault name at the top of the sidebar to switch between vaults</li>
                  <li>Use "Manage Vaults" to add, rename, or remove vaults</li>
                  <li>Files are organized in a tree structure - click folders to expand/collapse</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> File Management
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li><strong>New File:</strong> Click + button or press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Ctrl+N</kbd></li>
                  <li><strong>New Folder:</strong> Click folder+ button in sidebar</li>
                  <li><strong>Rename/Delete:</strong> Right-click any file or folder</li>
                  <li><strong>Move:</strong> Drag and drop files between folders</li>
                  <li><strong>Duplicate:</strong> Right-click → Duplicate</li>
                  <li><strong>Copy Path:</strong> Right-click → Copy Path or Copy Relative Path</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <Search className="w-5 h-5 text-primary" /> Search
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li><strong>Quick Search:</strong> <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Ctrl+P</kbd> to focus search bar</li>
                  <li><strong>Name Search:</strong> Search by file name (default mode)</li>
                  <li><strong>Content Search:</strong> Click "Content" toggle to search inside files</li>
                  <li>Content search uses full-text search when database is indexed</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-primary" /> Editor
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li><strong>Save:</strong> <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Ctrl+S</kbd></li>
                  <li><strong>View Modes:</strong> Edit, Split, or Preview (for Markdown)</li>
                  <li><strong>Outline:</strong> <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Ctrl+Shift+O</kbd> to toggle heading outline</li>
                  <li>Supports syntax highlighting for code files</li>
                  <li>Live preview for Markdown, HTML, JSX, and more</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" /> Tags & Organization
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li>Add tags in YAML frontmatter at the top of Markdown files</li>
                  <li>Example: <code className="bg-secondary px-1 rounded">tags: [project, important]</code></li>
                  <li><strong>Browse Tags:</strong> Use command palette → "Browse Tags"</li>
                  <li><strong>Favorites:</strong> Right-click → "Add to Favorites"</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-primary" /> Backlinks
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li>Use [[note name]] syntax to link between notes</li>
                  <li><strong>View Backlinks:</strong> Command palette → "Toggle Backlinks"</li>
                  <li>Backlinks show all notes that link to the current note</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" /> Database & Indexing
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li>Click the database icon in sidebar footer to re-index vault</li>
                  <li>Indexing enables: fast content search, tags, backlinks, statistics</li>
                  <li><strong>Vault Stats:</strong> Command palette → "Vault Statistics"</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <Command className="w-5 h-5 text-primary" /> Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Command Palette</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+K</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Quick Search</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+P</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">New File</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+N</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Save File</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+S</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Toggle Sidebar</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+B</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Toggle Outline</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+Shift+O</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Recent Files</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+Shift+E</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Settings</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Ctrl+,</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">User Guide</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">F1</kbd>
                  </div>
                  <div className="flex justify-between bg-secondary p-2 rounded">
                    <span className="text-muted">Close Modal</span>
                    <kbd className="px-1.5 py-0.5 bg-app rounded text-xs">Esc</kbd>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-primary" /> Settings
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li><strong>Theme:</strong> Light, Dark, or System</li>
                  <li><strong>Accent Color:</strong> Choose your preferred color</li>
                  <li><strong>Editor:</strong> Font size, line numbers, word wrap, minimap</li>
                  <li><strong>Files:</strong> Auto-expand folders, show hidden files, auto-save</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Supported File Types
                </h3>
                <ul className="list-disc list-inside text-muted space-y-1 mb-4">
                  <li><strong>Documents:</strong> Markdown (.md), Text, HTML, PDF, DOCX</li>
                  <li><strong>Data:</strong> JSON, YAML, CSV, XLSX</li>
                  <li><strong>Code:</strong> TypeScript, JavaScript, Python, Rust, Go, and more</li>
                  <li><strong>Media:</strong> Images (PNG, JPG, SVG), Video, Audio</li>
                  <li><strong>Special:</strong> Dashboard (.dashboard.json), Kanban (.kanban.json), Live Pages (.page.tsx)</li>
                </ul>

                <h3 className="text-lg font-semibold text-app mt-6 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> JSX Pages & Dashboards
                </h3>
                <p className="text-muted mb-3">
                  Create powerful interactive dashboards using JSX/TSX files with access to your vault data.
                </p>
                <div className="bg-secondary p-3 rounded-lg mb-3">
                  <p className="text-sm text-app font-semibold mb-2">Vault API Hooks:</p>
                  <ul className="list-disc list-inside text-muted text-sm space-y-1">
                    <li><code className="bg-app px-1 rounded">Vault.useNotes()</code> - Get all notes, filter by tag</li>
                    <li><code className="bg-app px-1 rounded">Vault.useNote("name")</code> - Get a specific note</li>
                    <li><code className="bg-app px-1 rounded">Vault.useSearch("query")</code> - Full-text search</li>
                    <li><code className="bg-app px-1 rounded">Vault.useTags()</code> - All tags with counts</li>
                    <li><code className="bg-app px-1 rounded">Vault.useStats()</code> - Vault statistics</li>
                    <li><code className="bg-app px-1 rounded">Vault.useBacklinks("note")</code> - Notes linking to this one</li>
                  </ul>
                </div>
                <div className="bg-secondary p-3 rounded-lg mb-3">
                  <p className="text-sm text-app font-semibold mb-2">Data Helpers:</p>
                  <ul className="list-disc list-inside text-muted text-sm space-y-1">
                    <li><code className="bg-app px-1 rounded">Vault.groupBy(notes, "field")</code> - Group by frontmatter</li>
                    <li><code className="bg-app px-1 rounded">Vault.sum(notes, "field")</code> - Sum numeric values</li>
                    <li><code className="bg-app px-1 rounded">Vault.avg(notes, "field")</code> - Average values</li>
                    <li><code className="bg-app px-1 rounded">Vault.parseFrontmatter(content)</code> - Parse YAML</li>
                  </ul>
                </div>
                <div className="bg-secondary p-3 rounded-lg mb-3">
                  <p className="text-sm text-app font-semibold mb-2">Visualization:</p>
                  <ul className="list-disc list-inside text-muted text-sm space-y-1">
                    <li><strong>Charts:</strong> LineChart, BarChart, PieChart, AreaChart, etc. (Recharts)</li>
                    <li><strong>Icons:</strong> 500+ icons via <code className="bg-app px-1 rounded">Icons.FileText</code>, <code className="bg-app px-1 rounded">Icons.Folder</code>, etc.</li>
                  </ul>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg border border-primary/30">
                  <p className="text-sm text-app font-semibold mb-2">Example Dashboard:</p>
                  <pre className="text-xs text-muted overflow-x-auto whitespace-pre">{`export default function Dashboard() {
  const notes = Vault.useNotes();
  const stats = Vault.useStats();
  const tags = Vault.useTags();

  return (
    <div className="p-4">
      <h1>Vault Overview</h1>
      <p>{stats?.notes} notes, {stats?.tags} tags</p>
      <PieChart width={300} height={200}>
        <Pie data={tags.slice(0,5)} dataKey="count" nameKey="tag" />
      </PieChart>
    </div>
  );
}`}</pre>
                </div>

                <div className="mt-8 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <p className="text-sm text-app">
                    <strong>Tip:</strong> Press <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">Ctrl+K</kbd> anytime
                    to open the command palette and quickly access any feature!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Modals */}
      <InputModal
        title="New File"
        isOpen={!!newFileModal}
        onClose={() => setNewFileModal(null)}
        onSubmit={(name) =>
          newFileModal && handleCreateFile(newFileModal.folder, name)
        }
        placeholder="filename.ext (e.g., notes.md, script.tsx)"
        submitLabel="Create"
      />

      <InputModal
        title="New Folder"
        isOpen={!!newFolderModal}
        onClose={() => setNewFolderModal(null)}
        onSubmit={(name) =>
          newFolderModal && handleCreateFolder(newFolderModal.folder, name)
        }
        placeholder="Folder name"
        submitLabel="Create"
      />

      <InputModal
        title="Rename"
        isOpen={!!renameModal}
        onClose={() => setRenameModal(null)}
        onSubmit={(name) => renameModal && handleRename(renameModal.node, name)}
        initialValue={renameModal?.node.name || ""}
        submitLabel="Rename"
      />

      <ConfirmModal
        title="Delete"
        message={`Are you sure you want to delete "${deleteModal?.node.name}"? This action cannot be undone.`}
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={() => deleteModal && handleDelete(deleteModal.node)}
        confirmLabel="Delete"
        danger
      />

      {/* Unsaved changes confirmation */}
      <ConfirmModal
        title="Unsaved Changes"
        message={`"${unsavedChangesModal !== null ? openFiles[unsavedChangesModal.tabIndex]?.name : ''}" has unsaved changes. Are you sure you want to close it?`}
        isOpen={!!unsavedChangesModal}
        onClose={() => setUnsavedChangesModal(null)}
        onConfirm={() => {
          if (unsavedChangesModal) {
            forceCloseTab(unsavedChangesModal.tabIndex);
            setUnsavedChangesModal(null);
          }
        }}
        confirmLabel="Close without saving"
        danger
      />

      {/* Delete Project Confirmation */}
      <ConfirmModal
        title="Delete Project"
        message={`Delete "${projectToDelete?.name}" and all its contents? This action cannot be undone.`}
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => {
          // Capture values before modal closes and clears state
          const projectPath = projectToDelete?.path;
          if (!projectPath) return;
          const projectVirtualPath = `${VIRTUAL_PATHS.PROJECT_PREFIX}${projectPath}`;

          // Run async deletion
          (async () => {
            try {
              await projectDelete(projectPath);
              // Refresh projects list
              const updatedProjects = await dbGetProjects("active");
              setProjects(updatedProjects);
              // If this project is open as a tab, close it
              const tabIndex = openFiles.findIndex((f) => f.path === projectVirtualPath);
              if (tabIndex !== -1) {
                forceCloseTab(tabIndex);
              }
              // Also refresh the file tree
              const { tree } = await getFileTree();
              setFiles(tree);
            } catch (err) {
              console.error("Failed to delete project:", err);
            }
          })();
        }}
        confirmLabel="Delete Project"
        danger
      />

      {/* Project Wizard */}
      {showProjectWizard && (
        <ProjectWizard
          onClose={() => setShowProjectWizard(false)}
          onCreated={async (path) => {
            setShowProjectWizard(false);
            // Re-index projects to pick up new one, then refresh list
            await dbIndexProjects();
            await loadProjects();
            // Refresh file tree
            refreshFiles();
            // Open the project view
            setActiveProjectPath(path);
            setShowProjectView(true);
            setShowTaskView(false);
            setShowInboxView(false);
          }}
        />
      )}

      {/* Dev Project Wizard (Add Existing) */}
      {showDevProjectWizard && (
        <DevProjectWizard
          onClose={() => setShowDevProjectWizard(false)}
          onCreated={async (project) => {
            setShowDevProjectWizard(false);
            await loadDevProjects();
            toast.success(`Added ${project.name}`);
          }}
          vaultPath={vaultPath || ""}
        />
      )}

      {/* Dev Project Create Wizard (Create New) */}
      {showDevProjectCreateWizard && (
        <DevProjectCreateWizard
          onClose={() => setShowDevProjectCreateWizard(false)}
          onCreated={async (project) => {
            setShowDevProjectCreateWizard(false);
            await loadDevProjects();
            await refreshFileTree();
            toast.success(`Created ${project.name}`);
            // Open the new project
            openVirtualTab(`${VIRTUAL_PATHS.DEVPROJECT_PREFIX}${project.id}`, project.name);
          }}
          vaultPath={vaultPath || ""}
        />
      )}

      {/* Delete Dev Project Confirmation */}
      <ConfirmModal
        title="Delete Dev Project"
        message={`Remove "${devProjectToDelete?.name}" from the list? This won't delete any files.`}
        isOpen={!!devProjectToDelete}
        onClose={() => setDevProjectToDelete(null)}
        onConfirm={() => {
          if (devProjectToDelete) {
            deleteDevProject(devProjectToDelete);
            setDevProjectToDelete(null);
          }
        }}
        confirmLabel="Remove"
        danger
      />

      {/* Settings */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={(newSettings) => {
          updateSettings(newSettings);
          // Sync theme change
          if (newSettings.theme !== theme) {
            setTheme(newSettings.theme);
          }
        }}
        vaultPath={vaultPath}
        onVaultPathChange={handleSetVaultPath}
        projects={projects}
      />
    </div>
  );
}

export default VaultApp;
