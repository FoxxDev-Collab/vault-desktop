import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Calendar,
  FolderKanban,
  Tag,
  ChevronDown,
  Save,
  Columns3,
} from "lucide-react";
import { MarkdownEditor } from "./MarkdownEditor";
import {
  taskUpdate,
  dbGetProjects,
  dbIndexTasks,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type Project,
} from "../hooks/useApi";

interface TaskEditorProps {
  path: string;
  content: string;
  onSave: (content: string) => Promise<void>;
  onChange?: (content: string) => void;
  isDark: boolean;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: "todo", label: "To Do", icon: Circle, color: "text-muted" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-blue-500" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-green-500" },
  { value: "cancelled", label: "Cancelled", icon: AlertCircle, color: "text-gray-400" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-gray-400" },
  { value: "medium", label: "Medium", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

const DEFAULT_COLUMNS = ["backlog", "doing", "review", "done", "archived"];

export function TaskEditor({
  path,
  content,
  onSave,
  onChange,
  isDark,
}: TaskEditorProps) {
  const [metadata, setMetadata] = useState<{
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    project_path: string;
    column: string;
    tags: string[];
  }>({
    status: "todo",
    priority: "medium",
    due_date: "",
    project_path: "",
    column: "backlog",
    tags: [],
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [originalContent, setOriginalContent] = useState(content);
  const [isDirty, setIsDirty] = useState(false);

  // Parse content on mount (component remounts when file changes due to key prop)
  useEffect(() => {
    const parsed = parseTaskContent(content);
    setMetadata(parsed.metadata);
    setTitle(parsed.title);
    setBody(parsed.body);
    setOriginalContent(content);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Load projects
  useEffect(() => {
    dbGetProjects("active").then(setProjects).catch(console.error);
  }, []);

  // Get available columns from selected project or defaults
  const availableColumns = useMemo(() => {
    if (metadata.project_path) {
      const project = projects.find((p) => p.path === metadata.project_path);
      if (project?.columns?.length) {
        return project.columns;
      }
    }
    return DEFAULT_COLUMNS;
  }, [metadata.project_path, projects]);

  // Rebuild content from metadata, title, and body
  const rebuildContent = useCallback(
    (meta: typeof metadata, taskTitle: string, bodyContent: string) => {
      let frontmatter = "---\n";
      frontmatter += `status: ${meta.status}\n`;
      frontmatter += `priority: ${meta.priority}\n`;
      frontmatter += `column: ${meta.column}\n`;

      if (meta.due_date) {
        frontmatter += `due: ${meta.due_date}\n`;
      }
      if (meta.project_path) {
        frontmatter += `project: ${meta.project_path}\n`;
      }
      if (meta.tags.length > 0) {
        frontmatter += `tags: [${meta.tags.join(", ")}]\n`;
      }

      frontmatter += "---\n\n";
      return frontmatter + `# ${taskTitle}\n\n` + bodyContent;
    },
    []
  );

  // Handle metadata changes with status/column sync
  const handleMetadataChange = useCallback(
    async (key: keyof typeof metadata, value: string | string[]) => {
      // Sync status and column bidirectionally
      const statusToColumn: Record<string, string> = {
        todo: "backlog",
        in_progress: "doing",
        done: "done",
        cancelled: "archived",
      };
      const columnToStatus: Record<string, TaskStatus> = {
        backlog: "todo",
        doing: "in_progress",
        review: "in_progress",
        done: "done",
        archived: "cancelled",
      };

      let newMetadata = { ...metadata, [key]: value };
      const updates: Record<string, string | string[]> = { [key]: value };

      // If status changed, also update column
      if (key === "status" && typeof value === "string") {
        const newColumn = statusToColumn[value] || "backlog";
        newMetadata = { ...newMetadata, column: newColumn };
        updates.column = newColumn;
      }
      // If column changed, also update status
      else if (key === "column" && typeof value === "string") {
        const newStatus = columnToStatus[value] || "todo";
        newMetadata = { ...newMetadata, status: newStatus };
        updates.status = newStatus;
      }

      setMetadata(newMetadata);
      const newContent = rebuildContent(newMetadata, title, body);
      onChange?.(newContent);

      // Also update via API for database sync (metadata saves immediately)
      try {
        await taskUpdate(path, updates);
        // Re-index to sync database
        await dbIndexTasks();
        // Update original content since metadata was auto-saved
        setOriginalContent(newContent);
        setIsDirty(false);
      } catch (e) {
        console.error("Failed to update task:", e);
        // Mark as dirty since save failed
        setIsDirty(true);
      }
    },
    [metadata, title, body, path, onChange, rebuildContent]
  );

  // Handle title changes
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      const newContent = rebuildContent(metadata, newTitle, body);
      setIsDirty(newContent !== originalContent);
      onChange?.(newContent);
    },
    [metadata, body, onChange, rebuildContent, originalContent]
  );

  // Handle body changes
  const handleBodyChange = useCallback(
    (newBody: string) => {
      setBody(newBody);
      const newContent = rebuildContent(metadata, title, newBody);
      setIsDirty(newContent !== originalContent);
      onChange?.(newContent);
    },
    [metadata, title, onChange, rebuildContent, originalContent]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setIsSaving(true);
    try {
      const newContent = rebuildContent(metadata, title, body);
      await onSave(newContent);
      setOriginalContent(newContent);
      setIsDirty(false);
      // Re-index tasks to update database with new title
      await dbIndexTasks();
    } catch (e) {
      console.error("Failed to save task:", e);
    } finally {
      setIsSaving(false);
    }
  }, [metadata, title, body, onSave, rebuildContent, isDirty]);

  // Add tag
  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !metadata.tags.includes(tag)) {
      handleMetadataChange("tags", [...metadata.tags, tag]);
    }
    setTagInput("");
  }, [tagInput, metadata.tags, handleMetadataChange]);

  // Remove tag
  const handleRemoveTag = useCallback(
    (tag: string) => {
      handleMetadataChange(
        "tags",
        metadata.tags.filter((t) => t !== tag)
      );
    },
    [metadata.tags, handleMetadataChange]
  );

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === metadata.status) || STATUS_OPTIONS[0];
  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === metadata.priority) || PRIORITY_OPTIONS[1];
  const currentProject = projects.find((p) => p.path === metadata.project_path);

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-secondary/30">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Task title..."
          className="w-full text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-app placeholder:text-muted"
        />
      </div>

      {/* Metadata Panel */}
      <div className="flex-shrink-0 px-4 pb-4 bg-secondary/30 border-b border-app">
        <div className="flex flex-wrap gap-4 items-start">
          {/* Status */}
          <div className="relative">
            <label className="text-xs text-muted mb-1 block">Status</label>
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-app hover:border-primary transition-colors ${currentStatus.color}`}
            >
              <currentStatus.icon className="w-4 h-4" />
              <span className="text-sm">{currentStatus.label}</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute top-full left-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        handleMetadataChange("status", opt.value);
                        setShowStatusMenu(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${opt.color}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority */}
          <div className="relative">
            <label className="text-xs text-muted mb-1 block">Priority</label>
            <button
              onClick={() => setShowPriorityMenu(!showPriorityMenu)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-app hover:border-primary transition-colors ${currentPriority.color}`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{currentPriority.label}</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </button>
            {showPriorityMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPriorityMenu(false)} />
                <div className="absolute top-full left-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        handleMetadataChange("priority", opt.value);
                        setShowPriorityMenu(false);
                      }}
                      className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${opt.color}`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-muted mb-1 block">Due Date</label>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-app">
              <Calendar className="w-4 h-4 text-muted" />
              <input
                type="date"
                value={metadata.due_date}
                onChange={(e) => handleMetadataChange("due_date", e.target.value)}
                className="bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Project */}
          <div className="relative">
            <label className="text-xs text-muted mb-1 block">Project</label>
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-app hover:border-primary transition-colors"
            >
              <FolderKanban className="w-4 h-4 text-muted" />
              <span className="text-sm truncate max-w-[150px]">
                {currentProject?.name || "No Project"}
              </span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </button>
            {showProjectMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
                <div className="absolute top-full left-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[180px] max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      handleMetadataChange("project_path", "");
                      setShowProjectMenu(false);
                    }}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors text-muted"
                  >
                    <span className="text-sm">No Project</span>
                  </button>
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        handleMetadataChange("project_path", proj.path);
                        setShowProjectMenu(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: proj.color || "#3b82f6" }}
                      />
                      <span className="text-sm truncate">{proj.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Column */}
          <div className="relative">
            <label className="text-xs text-muted mb-1 block">Column</label>
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-app hover:border-primary transition-colors"
            >
              <Columns3 className="w-4 h-4 text-muted" />
              <span className="text-sm capitalize">{metadata.column}</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </button>
            {showColumnMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute top-full left-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                  {availableColumns.map((col) => (
                    <button
                      key={col}
                      onClick={() => {
                        handleMetadataChange("column", col);
                        setShowColumnMenu(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors"
                    >
                      <span className="text-sm capitalize">{col}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Save button */}
          <div className="ml-auto">
            <label className="text-xs text-muted mb-1 block">&nbsp;</label>
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors min-w-[90px]"
            >
              <Save className={`w-4 h-4 ${isSaving ? "animate-spin" : ""}`} />
              <span className="text-sm">{isSaving ? "Saving" : isDirty ? "Save" : "Saved"}</span>
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-3">
          <label className="text-xs text-muted mb-1 block">Tags</label>
          <div className="flex flex-wrap gap-2 items-center">
            {metadata.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 bg-accent rounded-full text-xs"
              >
                <Tag className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-muted hover:text-destructive"
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag..."
              className="px-2 py-0.5 bg-transparent text-xs focus:outline-none border-b border-transparent focus:border-primary w-20"
            />
          </div>
        </div>
      </div>

      {/* Markdown Editor */}
      <div className="flex-1 min-h-0">
        <MarkdownEditor
          content={body}
          onChange={handleBodyChange}
          onSave={handleSave}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

// Parse task content into metadata, title, and body
function parseTaskContent(content: string): {
  metadata: {
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    project_path: string;
    column: string;
    tags: string[];
  };
  title: string;
  body: string;
} {
  const defaults = {
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    due_date: "",
    project_path: "",
    column: "backlog",
    tags: [] as string[],
  };

  if (!content.startsWith("---")) {
    // Try to extract title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : "";
    const body = titleMatch ? content.replace(/^#\s+.+\n*/, "") : content;
    return { metadata: defaults, title, body };
  }

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) {
    return { metadata: defaults, title: "", body: content };
  }

  const yamlStr = content.substring(3, endIdx);
  let bodyContent = content.substring(endIdx + 3).trim();

  const metadata = { ...defaults };

  for (const line of yamlStr.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(":")) continue;

    const colonIdx = trimmed.indexOf(":");
    const key = trimmed.substring(0, colonIdx).trim();
    const value = trimmed.substring(colonIdx + 1).trim();

    switch (key) {
      case "status":
        if (["todo", "in_progress", "done", "cancelled"].includes(value)) {
          metadata.status = value as TaskStatus;
        }
        break;
      case "priority":
        if (["low", "medium", "high", "urgent"].includes(value)) {
          metadata.priority = value as TaskPriority;
        }
        break;
      case "due":
        metadata.due_date = value;
        break;
      case "project":
        metadata.project_path = value;
        break;
      case "column":
        metadata.column = value;
        break;
      case "tags":
        const cleaned = value.replace(/^\[|\]$/g, "");
        metadata.tags = cleaned
          .split(",")
          .map((t) => t.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        break;
    }
  }

  // Extract title from first # heading in body
  let title = "";
  const titleMatch = bodyContent.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1];
    bodyContent = bodyContent.replace(/^#\s+.+\n*/, "").trim();
  }

  return { metadata, title, body: bodyContent };
}

export default TaskEditor;
