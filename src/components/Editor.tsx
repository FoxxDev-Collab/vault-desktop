import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import {
  Save,
  X,
  Edit3,
  Eye,
  Columns,
  FileText,
  Code2,
  LayoutDashboard,
  Kanban,
  FileCode,
  Play,
  MonitorPlay,
  Image,
  Film,
  Music,
  CheckSquare,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";
import { MarkdownEditor } from "./MarkdownEditor";
import { CsvViewer } from "./CsvViewer";
import { SpreadsheetEditor } from "./SpreadsheetEditor";
import { XlsxViewer } from "./XlsxViewer";
import { DocxViewer } from "./DocxViewer";
import { CodeEditor, getLanguageFromExtension, type CodeEditorHandle } from "./CodeEditor";
import { EditorToolbar } from "./EditorToolbar";
import { Breadcrumb } from "./Breadcrumb";
import { Dashboard } from "./Dashboard";
import { KanbanBoard } from "./KanbanBoard";
import { JSXPreview } from "./JSXPreview";
import { HtmlViewer } from "./HtmlViewer";
import { PdfViewer } from "./PdfViewer";
import { SvgViewer } from "./SvgViewer";
import { ImageViewer } from "./ImageViewer";
import { MediaViewer } from "./MediaViewer";
import { MermaidEditor } from "./MermaidEditor";
import { ExcalidrawEditor } from "./ExcalidrawEditor";
import { TaskEditor } from "./TaskEditor";
import { InboxView } from "./InboxView";
import { TaskListView } from "./TaskListView";
import { ProjectView } from "./ProjectView";
import { CalendarView } from "./CalendarView";
import { DevProjectView } from "./DevProjectView";

// Extended file types
type FileType =
  | "md"
  | "txt"
  | "json"
  | "yaml"
  | "csv"
  | "xlsx"
  | "docx"
  | "pdf"
  | "svg"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "html"
  | "dashboard"
  | "kanban"
  | "page"
  | "mermaid"
  | "excalidraw"
  | "task"
  | "inbox"
  | "tasks_today"
  | "tasks_upcoming"
  | "tasks_all"
  | "project"
  | "calendar"
  | "devproject"
  | "other";

// Virtual paths for special views
export const VIRTUAL_PATHS = {
  INBOX: "__inbox__",
  TASKS_TODAY: "__tasks_today__",
  TASKS_UPCOMING: "__tasks_upcoming__",
  TASKS_ALL: "__tasks_all__",
  PROJECT_PREFIX: "__project__:",
  DEVPROJECT_PREFIX: "__devproject__:",
  CALENDAR: "__calendar__",
} as const;

export function isVirtualPath(path: string): boolean {
  return path.startsWith("__") && path.endsWith("__") ||
    path.startsWith(VIRTUAL_PATHS.PROJECT_PREFIX) ||
    path.startsWith(VIRTUAL_PATHS.DEVPROJECT_PREFIX);
}

export function getDevProjectIdFromVirtual(virtualPath: string): number | null {
  if (virtualPath.startsWith(VIRTUAL_PATHS.DEVPROJECT_PREFIX)) {
    const idStr = virtualPath.slice(VIRTUAL_PATHS.DEVPROJECT_PREFIX.length);
    const id = parseInt(idStr, 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

export function getProjectPathFromVirtual(virtualPath: string): string | null {
  if (virtualPath.startsWith(VIRTUAL_PATHS.PROJECT_PREFIX)) {
    return virtualPath.slice(VIRTUAL_PATHS.PROJECT_PREFIX.length);
  }
  return null;
}

// Dev server state passed from VaultApp
export interface DevServerState {
  terminalId: string;
  port: number;
  status: "starting" | "running" | "stopped" | "error";
}

interface EditorProps {
  content: string | null;
  binaryData?: ArrayBuffer | null;
  filePath: string;
  fileName: string;
  fileType: FileType;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
  onChange?: (content: string) => void;
  defaultViewMode?: "edit" | "preview" | "split";
  isDark?: boolean;
  vaultPath?: string;
  onNavigateToFolder?: (folderPath: string) => void;
  // Callbacks for virtual views
  onOpenFile?: (path: string) => void;
  onFileDeleted?: () => void;
  // Dev server management (for DevProjectView)
  devServerState?: DevServerState | null;
  onStartDevServer?: (projectId: number) => void;
  onStopDevServer?: (projectId: number) => void;
}

type ViewMode = "edit" | "preview" | "split";

// Code file extensions (html/htm handled separately for live preview)
const CODE_EXTENSIONS = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "sql",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "css",
  "scss",
  "less",
  "xml",
  "graphql",
  "gql",
  "vue",
  "svelte",
  "astro",
  "prisma",
  "dockerfile",
  "makefile",
  "toml",
  "ini",
  "conf",
  "env",
];

function getFileType(fileName: string): FileType {
  // Check for virtual paths first
  if (fileName === VIRTUAL_PATHS.INBOX) return "inbox";
  if (fileName === VIRTUAL_PATHS.TASKS_TODAY) return "tasks_today";
  if (fileName === VIRTUAL_PATHS.TASKS_UPCOMING) return "tasks_upcoming";
  if (fileName === VIRTUAL_PATHS.TASKS_ALL) return "tasks_all";
  if (fileName.startsWith(VIRTUAL_PATHS.PROJECT_PREFIX)) return "project";
  if (fileName.startsWith(VIRTUAL_PATHS.DEVPROJECT_PREFIX)) return "devproject";
  if (fileName === VIRTUAL_PATHS.CALENDAR) return "calendar";

  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split(".").pop() || "";

  // Check for special file types first
  if (lowerName.endsWith(".task.md")) return "task";
  if (lowerName.endsWith(".page.tsx") || lowerName.endsWith(".page.jsx")) return "page";
  if (lowerName.endsWith(".render.tsx") || lowerName.endsWith(".render.jsx")) return "page";
  if (lowerName.endsWith(".live.tsx") || lowerName.endsWith(".live.jsx")) return "page";
  if (lowerName.endsWith(".dashboard.json")) return "dashboard";
  if (lowerName.endsWith(".kanban.json")) return "kanban";
  if (lowerName.endsWith(".board.json")) return "kanban";
  if (lowerName.endsWith(".excalidraw")) return "excalidraw";

  // Standard types
  switch (ext) {
    case "mermaid":
    case "mmd":
      return "mermaid";
    case "md":
    case "markdown":
      return "md";
    case "txt":
      return "txt";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "csv":
      return "csv";
    case "xlsx":
    case "xls":
      return "xlsx";
    case "docx":
    case "doc":
      return "docx";
    case "pdf":
      return "pdf";
    case "svg":
      return "svg";
    // Image files
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "bmp":
    case "ico":
    case "tiff":
    case "tif":
      return "image";
    // Video files
    case "mp4":
    case "webm":
    case "ogv":
    case "mov":
    case "avi":
    case "mkv":
      return "video";
    // Audio files
    case "mp3":
    case "wav":
    case "ogg":
    case "oga":
    case "flac":
    case "aac":
    case "m4a":
      return "audio";
    case "html":
    case "htm":
      return "html";
    default:
      // Check if it's a code file
      if (CODE_EXTENSIONS.includes(ext)) {
        return "code";
      }
      return "other";
  }
}

// Get icon for file type
function getFileIcon(fileType: FileType) {
  switch (fileType) {
    case "code":
      return <Code2 className="w-5 h-5 text-chart-3" />;
    case "page":
      return <MonitorPlay className="w-5 h-5 text-chart-5" />;
    case "html":
      return <MonitorPlay className="w-5 h-5 text-orange-500" />;
    case "pdf":
      return <FileText className="w-5 h-5 text-red-500" />;
    case "svg":
      return <FileCode className="w-5 h-5 text-emerald-500" />;
    case "image":
      return <Image className="w-5 h-5 text-pink-500" />;
    case "video":
      return <Film className="w-5 h-5 text-purple-500" />;
    case "audio":
      return <Music className="w-5 h-5 text-cyan-500" />;
    case "dashboard":
      return <LayoutDashboard className="w-5 h-5 text-chart-1" />;
    case "kanban":
      return <Kanban className="w-5 h-5 text-chart-2" />;
    case "mermaid":
      return <FileCode className="w-5 h-5 text-purple-500" />;
    case "excalidraw":
      return <FileCode className="w-5 h-5 text-violet-500" />;
    case "task":
      return <CheckSquare className="w-5 h-5 text-green-500" />;
    case "json":
    case "yaml":
      return <FileCode className="w-5 h-5 text-chart-4" />;
    default:
      return <FileText className="w-5 h-5 text-muted" />;
  }
}

export function Editor({
  content,
  binaryData,
  filePath,
  fileName,
  fileType,
  onSave,
  onClose,
  onChange,
  defaultViewMode = "split",
  isDark = true,
  vaultPath,
  onNavigateToFolder,
  onOpenFile,
  onFileDeleted,
  devServerState,
  onStartDevServer,
  onStopDevServer,
}: EditorProps) {
  // Handle virtual views early (they don't need editor state)
  if (fileType === "inbox") {
    return (
      <InboxView
        onSelectFile={onOpenFile || (() => {})}
        onFileDeleted={onFileDeleted}
        vaultPath={vaultPath || ""}
      />
    );
  }

  if (fileType === "tasks_today") {
    return (
      <TaskListView
        onSelectTask={onOpenFile || (() => {})}
        initialView="today"
      />
    );
  }

  if (fileType === "tasks_upcoming") {
    return (
      <TaskListView
        onSelectTask={onOpenFile || (() => {})}
        initialView="upcoming"
      />
    );
  }

  if (fileType === "tasks_all") {
    return (
      <TaskListView
        onSelectTask={onOpenFile || (() => {})}
        initialView="all"
      />
    );
  }

  if (fileType === "project") {
    const projectPath = getProjectPathFromVirtual(filePath);
    return (
      <ProjectView
        projectPath={projectPath || ""}
        onBack={onClose}
        onSelectTask={onOpenFile || (() => {})}
        onSelectFile={onOpenFile || (() => {})}
      />
    );
  }

  if (fileType === "calendar") {
    return (
      <CalendarView
        onSelectItem={onOpenFile || (() => {})}
        vaultPath={vaultPath}
      />
    );
  }

  if (fileType === "devproject") {
    const devProjectId = getDevProjectIdFromVirtual(filePath);
    return (
      <DevProjectView
        key={`devproject-${devProjectId}`}  // Force remount on project change for fresh state
        projectId={devProjectId || 0}
        onClose={onClose}
        serverState={devServerState}
        onStartServer={onStartDevServer ? () => onStartDevServer(devProjectId || 0) : undefined}
        onStopServer={onStopDevServer ? () => onStopDevServer(devProjectId || 0) : undefined}
      />
    );
  }

  const [text, setText] = useState(content || "");
  const [mode, setMode] = useState<ViewMode>(() => {
    // Default mode based on file type (some types override user preference)
    if (fileType === "code" || fileType === "json" || fileType === "yaml") {
      return "edit"; // Code files always start in edit mode
    }
    if (fileType === "dashboard" || fileType === "kanban") {
      return "preview"; // Special views start in preview
    }
    if (fileType === "page" || fileType === "html" || fileType === "svg") {
      return "split"; // Live pages, HTML, and SVG always use split view
    }
    // For markdown and other text files, use the user's preference
    return defaultViewMode;
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);

  // Determine if file can be edited
  const isEditable = useMemo(() => {
    return ![
      "xlsx",
      "docx",
      "pdf",
      "image",
      "video",
      "audio",
    ].includes(fileType);
  }, [fileType]);

  const isBinary = ["xlsx", "docx", "pdf", "image", "video", "audio"].includes(fileType);
  const isCodeFile = fileType === "code";
  const isDashboard = fileType === "dashboard";
  const isKanban = fileType === "kanban";
  const isPage = fileType === "page";
  const isHtml = fileType === "html";
  const isPdf = fileType === "pdf";
  const isSvg = fileType === "svg";
  const isMermaid = fileType === "mermaid";
  const isExcalidraw = fileType === "excalidraw";
  const isSpecialView = isDashboard || isKanban;

  // Get Monaco language for code files
  const monacoLanguage = useMemo(() => {
    if (isCodeFile || isPage) {
      return getLanguageFromExtension(fileName);
    }
    if (isHtml) return "html";
    if (isSvg) return "xml";
    if (fileType === "json" || isDashboard || isKanban) return "json";
    if (fileType === "yaml") return "yaml";
    if (fileType === "md") return "markdown";
    return "plaintext";
  }, [fileName, fileType, isCodeFile, isPage, isHtml, isSvg, isDashboard, isKanban]);

  // Determine if we should use Monaco editor
  const useMonaco = useMemo(() => {
    return (
      isCodeFile ||
      isPage ||
      isHtml ||
      isSvg ||
      fileType === "json" ||
      fileType === "yaml" ||
      isDashboard ||
      isKanban
    );
  }, [isCodeFile, isPage, isHtml, isSvg, fileType, isDashboard, isKanban]);

  // Determine if we should show the editor toolbar
  const showEditorToolbar = useMemo(() => {
    return isCodeFile || isHtml || fileType === "json" || fileType === "yaml";
  }, [isCodeFile, isHtml, fileType]);

  // Toolbar handlers
  const handleFormat = useCallback(() => {
    codeEditorRef.current?.format();
  }, []);

  const handleCopy = useCallback(() => {
    codeEditorRef.current?.copy();
  }, []);

  const handleToggleWordWrap = useCallback(() => {
    setWordWrap((prev) => !prev);
  }, []);

  // Track previous file path to detect file switches
  const prevFilePathRef = useRef(filePath);

  // Update text when file changes (not when content updates from typing)
  useEffect(() => {
    // Only reset when switching to a different file
    if (prevFilePathRef.current !== filePath) {
      setText(content || "");
      setIsDirty(false);
      prevFilePathRef.current = filePath;
    }
  }, [filePath, content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        if (mode === "edit" && isSpecialView) setMode("preview");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [text, isDirty, mode, isSpecialView]);

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving || !isEditable) return;
    setIsSaving(true);
    try {
      await onSave(text);
      setIsDirty(false);
      setLastSaved(new Date());
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  }, [text, isDirty, isSaving, onSave, isEditable]);

  const handleTextChange = useCallback((newValue: string) => {
    setText(newValue);
    setIsDirty(true);
    onChange?.(newValue);
  }, [onChange]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setText(newValue);
    setIsDirty(true);
    onChange?.(newValue);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && mode !== "preview" && !useMonaco) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text, mode, useMonaco]);

  // Render file content based on type
  const renderPreview = () => {
    switch (fileType) {
      case "csv":
        return (
          <CsvViewer
            content={text}
            editable={mode !== "preview"}
            onChange={handleTextChange}
          />
        );
      case "xlsx":
        if (binaryData) {
          return <XlsxViewer data={binaryData} />;
        }
        return <div className="text-muted">Loading...</div>;
      case "docx":
        if (binaryData) {
          return <DocxViewer data={binaryData} />;
        }
        return <div className="text-muted">Loading...</div>;
      case "pdf":
        if (binaryData) {
          return <PdfViewer data={binaryData} fileName={fileName} />;
        }
        return <div className="text-muted">Loading PDF...</div>;
      case "svg":
        return <SvgViewer content={text} fileName={fileName} />;
      case "image":
        if (binaryData) {
          return <ImageViewer data={binaryData} fileName={fileName} />;
        }
        return <div className="text-muted">Loading image...</div>;
      case "video":
        if (binaryData) {
          return <MediaViewer data={binaryData} fileName={fileName} mediaType="video" />;
        }
        return <div className="text-muted">Loading video...</div>;
      case "audio":
        if (binaryData) {
          return <MediaViewer data={binaryData} fileName={fileName} mediaType="audio" />;
        }
        return <div className="text-muted">Loading audio...</div>;
      case "dashboard":
        return (
          <Dashboard
            content={text}
            onChange={handleTextChange}
            readOnly={mode === "preview"}
          />
        );
      case "kanban":
        return (
          <KanbanBoard
            content={text}
            onChange={handleTextChange}
            readOnly={mode === "preview"}
          />
        );
      case "json":
        try {
          const formatted = JSON.stringify(JSON.parse(text), null, 2);
          return (
            <pre className="text-sm text-chart-3 font-mono whitespace-pre-wrap p-6">
              {formatted}
            </pre>
          );
        } catch {
          return (
            <pre className="text-sm text-muted font-mono p-6">{text}</pre>
          );
        }
      case "yaml":
        return (
          <pre className="text-sm text-chart-4 font-mono whitespace-pre-wrap p-6">
            {text}
          </pre>
        );
      case "md":
        return <MarkdownViewer content={text} isDark={isDark} enableLiveCode={true} />;
      case "html":
        return <HtmlViewer content={text} fileName={fileName} />;
      case "code":
        return (
          <pre className="text-sm text-app font-mono whitespace-pre-wrap p-6">
            {text}
          </pre>
        );
      default:
        return (
          <pre className="text-sm text-muted font-mono p-6">{text}</pre>
        );
    }
  };

  // Render editor based on file type
  const renderEditor = (includeToolbar: boolean = false) => {
    if (useMonaco) {
      return (
        <div className="flex flex-col h-full">
          {includeToolbar && showEditorToolbar && (
            <EditorToolbar
              onFormat={handleFormat}
              onCopy={handleCopy}
              wordWrap={wordWrap}
              onToggleWordWrap={handleToggleWordWrap}
              language={monacoLanguage}
            />
          )}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              ref={codeEditorRef}
              value={text}
              onChange={handleTextChange}
              language={monacoLanguage}
              isDark={isDark}
              wordWrap={wordWrap}
            />
          </div>
        </div>
      );
    }

    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextareaChange}
        className="w-full min-h-full p-6 bg-transparent text-app font-mono text-sm leading-relaxed resize-none focus:outline-none"
        placeholder="Start writing..."
        spellCheck={false}
      />
    );
  };

  // For special views (dashboard, kanban), show full-screen preview with edit toggle
  if (isSpecialView) {
    return (
      <div className="flex flex-col h-full bg-app">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
          <div className="flex items-center gap-3">
            {getFileIcon(fileType)}
            <span className="text-lg font-medium text-app">{fileName}</span>
            {isDirty && (
              <span className="text-chart-2 text-sm">(unsaved)</span>
            )}
            {lastSaved && !isDirty && (
              <span className="text-muted text-xs">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setMode("edit")}
                title="Edit JSON"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "edit"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("preview")}
                title="Preview"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "preview"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? "bg-primary hover:opacity-90 text-primary-foreground"
                  : "bg-secondary text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mode === "edit" ? (
            <div className="h-full">{renderEditor()}</div>
          ) : (
            <div className="h-full overflow-auto">{renderPreview()}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted flex justify-between">
          <span>
            {text.length} characters | {text.split("\n").length} lines
          </span>
          <span>
            Ctrl+S to save |{" "}
            {isDashboard ? "DASHBOARD" : isKanban ? "KANBAN" : fileType.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  // Special view for page files - split code editor + live preview
  if (isPage) {
    return (
      <div className="flex flex-col h-full bg-app">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
          <div className="flex items-center gap-3">
            {getFileIcon(fileType)}
            <span className="text-lg font-medium text-app">{fileName}</span>
            {isDirty && (
              <span className="text-chart-2 text-sm">(unsaved)</span>
            )}
            {lastSaved && !isDirty && (
              <span className="text-muted text-xs">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setMode("edit")}
                title="Code only"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "edit"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("split")}
                title="Split view"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "split"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("preview")}
                title="Preview only"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "preview"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Play className="w-4 h-4" />
              </button>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? "bg-primary hover:opacity-90 text-primary-foreground"
                  : "bg-secondary text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code editor pane */}
          {(mode === "edit" || mode === "split") && (
            <div
              className={`${
                mode === "split" ? "w-1/2 border-r border-app" : "w-full"
              } h-full overflow-hidden`}
            >
              <CodeEditor
                value={text}
                onChange={handleTextChange}
                language={monacoLanguage}
                isDark={isDark}
              />
            </div>
          )}

          {/* Live preview pane */}
          {(mode === "preview" || mode === "split") && (
            <div
              className={`${
                mode === "split" ? "w-1/2" : "w-full"
              } h-full overflow-hidden`}
            >
              <JSXPreview code={text} autoRun={true} isDark={isDark} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted flex justify-between">
          <span>
            {text.length} characters | {text.split("\n").length} lines
          </span>
          <span>
            Ctrl+S to save | LIVE {monacoLanguage.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  // Special view for HTML files - split code editor + live preview
  if (isHtml) {
    return (
      <div className="flex flex-col h-full bg-app">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {getFileIcon(fileType)}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-app truncate">{fileName}</span>
                {isDirty && <span className="text-chart-2 text-sm flex-shrink-0">(unsaved)</span>}
                {lastSaved && !isDirty && (
                  <span className="text-muted text-xs flex-shrink-0">
                    Saved {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
              {vaultPath && (
                <Breadcrumb
                  filePath={filePath}
                  vaultPath={vaultPath}
                  onNavigate={onNavigateToFolder}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setMode("edit")}
                title="Code only"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "edit"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("split")}
                title="Split view"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "split"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("preview")}
                title="Preview only"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "preview"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? "bg-primary hover:opacity-90 text-primary-foreground"
                  : "bg-secondary text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code editor pane */}
          {(mode === "edit" || mode === "split") && (
            <div
              className={`${
                mode === "split" ? "w-1/2 border-r border-app" : "w-full"
              } h-full overflow-hidden flex flex-col`}
            >
              <EditorToolbar
                onFormat={handleFormat}
                onCopy={handleCopy}
                wordWrap={wordWrap}
                onToggleWordWrap={handleToggleWordWrap}
                language="html"
              />
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  ref={codeEditorRef}
                  value={text}
                  onChange={handleTextChange}
                  language="html"
                  isDark={isDark}
                  wordWrap={wordWrap}
                />
              </div>
            </div>
          )}

          {/* Live preview pane */}
          {(mode === "preview" || mode === "split") && (
            <div
              className={`${
                mode === "split" ? "w-1/2" : "w-full"
              } h-full overflow-hidden`}
            >
              <HtmlViewer content={text} fileName={fileName} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted flex justify-between">
          <span>
            {text.length} characters | {text.split("\n").length} lines
          </span>
          <span>Ctrl+S to save | Shift+Alt+F to format | HTML</span>
        </div>
      </div>
    );
  }

  // Check if file is markdown
  const isMarkdown = fileType === "md";

  // Special view for Markdown files - Word-like editor with ribbon
  if (isMarkdown) {
    return (
      <div className="flex flex-col h-full bg-app">
        <MarkdownEditor
          content={text}
          onChange={handleTextChange}
          onSave={handleSave}
          isDirty={isDirty}
          isSaving={isSaving}
          fileName={fileName}
          onClose={onClose}
          lastSaved={lastSaved}
          isDark={isDark}
        />
      </div>
    );
  }

  // Special view for TXT files - reuse MarkdownEditor (works great for plain text)
  const isTxt = fileType === "txt";
  if (isTxt) {
    return (
      <div className="flex flex-col h-full bg-app">
        <MarkdownEditor
          content={text}
          onChange={handleTextChange}
          onSave={handleSave}
          isDirty={isDirty}
          isSaving={isSaving}
          fileName={fileName}
          onClose={onClose}
          lastSaved={lastSaved}
          isDark={isDark}
        />
      </div>
    );
  }

  // Special view for CSV files - Spreadsheet editor with ribbon
  const isCsv = fileType === "csv";
  if (isCsv) {
    return (
      <div className="flex flex-col h-full bg-app">
        <SpreadsheetEditor
          content={text}
          onChange={handleTextChange}
          onSave={handleSave}
          isDirty={isDirty}
          isSaving={isSaving}
          fileName={fileName}
          onClose={onClose}
          lastSaved={lastSaved}
          readOnly={false}
        />
      </div>
    );
  }

  // Special view for Mermaid diagrams
  if (isMermaid) {
    return (
      <MermaidEditor
        content={text}
        onChange={handleTextChange}
        onSave={handleSave}
        onClose={onClose}
        fileName={fileName}
        isDirty={isDirty}
        isSaving={isSaving}
        lastSaved={lastSaved}
        isDark={isDark}
      />
    );
  }

  // Special view for Excalidraw diagrams
  if (isExcalidraw) {
    return (
      <ExcalidrawEditor
        content={text}
        onChange={handleTextChange}
        onSave={handleSave}
        onClose={onClose}
        fileName={fileName}
        isDirty={isDirty}
        isSaving={isSaving}
        lastSaved={lastSaved}
        isDark={isDark}
      />
    );
  }

  // Special view for Task files (.task.md)
  const isTask = fileType === "task";
  if (isTask) {
    return (
      <TaskEditor
        key={filePath}  // Force remount when file changes to reset all state
        path={filePath}
        content={content || ""}  // Use content prop directly, not text state
        onSave={onSave}
        onChange={handleTextChange}
        isDark={isDark}
      />
    );
  }

  // Special view for SVG files - split code editor + live preview
  if (isSvg) {
    return (
      <div className="flex flex-col h-full bg-app">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
          <div className="flex items-center gap-3">
            {getFileIcon(fileType)}
            <span className="text-lg font-medium text-app">{fileName}</span>
            {isDirty && (
              <span className="text-chart-2 text-sm">(unsaved)</span>
            )}
            {lastSaved && !isDirty && (
              <span className="text-muted text-xs">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setMode("edit")}
                title="Code only"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "edit"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("split")}
                title="Split view"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "split"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("preview")}
                title="Preview only"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "preview"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? "bg-primary hover:opacity-90 text-primary-foreground"
                  : "bg-secondary text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code editor pane */}
          {(mode === "edit" || mode === "split") && (
            <div
              className={`${
                mode === "split" ? "w-1/2 border-r border-app" : "w-full"
              } h-full overflow-hidden`}
            >
              <CodeEditor
                value={text}
                onChange={handleTextChange}
                language="xml"
                isDark={isDark}
              />
            </div>
          )}

          {/* Live preview pane */}
          {(mode === "preview" || mode === "split") && (
            <div
              className={`${
                mode === "split" ? "w-1/2" : "w-full"
              } h-full overflow-hidden`}
            >
              <SvgViewer content={text} fileName={fileName} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted flex justify-between">
          <span>
            {text.length} characters | {text.split("\n").length} lines
          </span>
          <span>Ctrl+S to save | SVG</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {getFileIcon(fileType)}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-medium text-app truncate">{fileName}</span>
              {isDirty && <span className="text-chart-2 text-sm flex-shrink-0">(unsaved)</span>}
              {lastSaved && !isDirty && (
                <span className="text-muted text-xs flex-shrink-0">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            {vaultPath && (
              <Breadcrumb
                filePath={filePath}
                vaultPath={vaultPath}
                onNavigate={onNavigateToFolder}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle - for editable non-code files */}
          {isEditable && !isCodeFile && (
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setMode("edit")}
                title="Edit mode"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "edit"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("split")}
                title="Split view"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "split"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMode("preview")}
                title="Preview mode"
                className={`p-1.5 rounded-md transition-colors ${
                  mode === "preview"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Save button - only for editable files */}
          {isEditable && (
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isDirty
                  ? "bg-primary hover:opacity-90 text-primary-foreground"
                  : "bg-secondary text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* For binary files, just show the viewer */}
        {isBinary ? (
          <div className="w-full overflow-auto p-6">{renderPreview()}</div>
        ) : isCodeFile ? (
          // Full-screen code editor with toolbar
          <div className="w-full h-full">{renderEditor(true)}</div>
        ) : (
          <>
            {/* Editor pane */}
            {(mode === "edit" || mode === "split") && (
              <div
                className={`${
                  mode === "split" ? "w-1/2 border-r border-app" : "w-full"
                } overflow-auto h-full`}
              >
                {useMonaco ? (
                  <div className="h-full">{renderEditor(true)}</div>
                ) : (
                  renderEditor()
                )}
              </div>
            )}

            {/* Preview pane */}
            {(mode === "preview" || mode === "split") && (
              <div
                className={`${
                  mode === "split" ? "w-1/2" : "w-full"
                } overflow-auto p-6`}
              >
                {renderPreview()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted flex justify-between">
        <span>
          {!isBinary && (
            <>
              {text.length} characters | {text.split("\n").length} lines
            </>
          )}
          {isBinary && "Binary file"}
        </span>
        <span>
          {isEditable ? "Ctrl+S to save" : ""}
          {showEditorToolbar ? " | Shift+Alt+F to format" : ""}
          {" | "}
          {isCodeFile ? monacoLanguage.toUpperCase() : fileType.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

export { getFileType };
export type { FileType };
export default Editor;
