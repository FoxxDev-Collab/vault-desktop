import { useState, useEffect, useCallback } from "react";
import {
  Inbox,
  FileText,
  CheckSquare,
  FolderInput,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  Calendar,
  Clock,
  MoreHorizontal,
  CheckCircle2,
  Square,
  ArrowUpDown,
  Plus,
} from "lucide-react";
import {
  getInboxItems,
  deleteFile,
  moveItem,
  taskCreate,
  readFile,
  quickCapture,
  dbIndexTasks,
  type FileNode,
} from "../hooks/useApi";
import { SkeletonInbox } from "./Skeleton";

type SortBy = "modified" | "name" | "size";
type SortOrder = "asc" | "desc";

interface InboxViewProps {
  onSelectFile: (path: string) => void;
  onFileDeleted?: () => void;
  vaultPath: string;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InboxView({ onSelectFile, onFileDeleted, vaultPath }: InboxViewProps) {
  const [items, setItems] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("modified");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState("");
  const [actionItem, setActionItem] = useState<FileNode | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FileNode | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureAsTask, setCaptureAsTask] = useState(false);

  // Load inbox items
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const inboxItems = await getInboxItems();
      setItems(inboxItems);
    } catch (e) {
      console.error("Failed to load inbox items:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Quick capture - add new note or task
  const handleQuickCapture = async () => {
    if (!newNoteContent.trim() || isCapturing) return;
    setIsCapturing(true);
    try {
      if (captureAsTask) {
        // Create as task in backlog
        await taskCreate(newNoteContent.trim(), { column: "backlog" });
        await dbIndexTasks();
      } else {
        // Create as note in inbox
        await quickCapture(newNoteContent.trim(), false);
      }
      setNewNoteContent("");
      await loadItems();
    } catch (e) {
      console.error("Failed to capture:", e);
    } finally {
      setIsCapturing(false);
    }
  };

  // Filter and sort items
  const filteredItems = items
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "modified":
          cmp = new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime();
          break;
        case "size":
          cmp = (b.size || 0) - (a.size || 0);
          break;
      }
      return sortOrder === "asc" ? -cmp : cmp;
    });

  // Toggle selection
  const toggleSelect = (path: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Select all
  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.path)));
    }
  };

  // Delete items
  const handleDelete = async (paths: string[]) => {
    if (!confirm(`Delete ${paths.length} item(s)? This cannot be undone.`)) return;

    for (const path of paths) {
      try {
        await deleteFile(path);
      } catch (e) {
        console.error("Failed to delete:", path, e);
      }
    }
    setSelectedItems(new Set());
    await loadItems();
    onFileDeleted?.();
  };

  // Convert to task
  const handleConvertToTask = async (item: FileNode) => {
    try {
      // Read the file content
      const fileContent = await readFile(item.path);
      const content = fileContent.content || "";

      // Extract title from filename (remove extension and timestamp prefix)
      let title = item.name.replace(/\.(md|task\.md)$/, "");
      // Remove common timestamp prefixes like "2026-01-25_" or "20260125_"
      title = title.replace(/^\d{4}-?\d{2}-?\d{2}[_\s-]?/, "").trim();
      if (!title) title = item.name;

      // Create task with the content as body
      await taskCreate(title, {
        column: "backlog",
      });

      // Delete the original file
      await deleteFile(item.path);

      await loadItems();
      onFileDeleted?.();
    } catch (e) {
      console.error("Failed to convert to task:", e);
      alert("Failed to convert to task: " + String(e));
    }
  };

  // Move items
  const handleMove = async (paths: string[], targetFolder: string) => {
    if (!targetFolder.trim()) return;

    for (const path of paths) {
      try {
        const fileName = path.split(/[/\\]/).pop() || "";
        const newPath = `${vaultPath}/${targetFolder}/${fileName}`;
        await moveItem(path, newPath);
      } catch (e) {
        console.error("Failed to move:", path, e);
      }
    }
    setSelectedItems(new Set());
    setShowMoveModal(false);
    setMoveTargetFolder("");
    await loadItems();
    onFileDeleted?.();
  };

  // Load preview
  const handlePreview = async (item: FileNode) => {
    setPreviewItem(item);
    try {
      const result = await readFile(item.path);
      setPreviewContent(result.content);
    } catch (e) {
      setPreviewContent("Failed to load preview");
    }
  };

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-app bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Inbox className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-app">Inbox</h1>
            <span className="text-sm text-muted">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={loadItems}
            disabled={loading}
            className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Quick Capture */}
        <div className="space-y-2 mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickCapture();
                }
              }}
              placeholder={captureAsTask ? "New task title..." : "Capture a quick note..."}
              className="flex-1 px-3 py-2 bg-secondary border border-app rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isCapturing}
            />
            <button
              onClick={handleQuickCapture}
              disabled={isCapturing || !newNoteContent.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {isCapturing ? "Adding..." : "Add"}
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCaptureAsTask(false)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                !captureAsTask
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted hover:text-app"
              }`}
            >
              <FileText className="w-3 h-3 inline mr-1" />
              Note
            </button>
            <button
              onClick={() => setCaptureAsTask(true)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                captureAsTask
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted hover:text-app"
              }`}
            >
              <CheckSquare className="w-3 h-3 inline mr-1" />
              Task
            </button>
          </div>
        </div>

        {/* Search and actions */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inbox..."
              className="w-full pl-9 pr-3 py-2 bg-secondary rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm hover:bg-accent transition-colors"
            >
              <ArrowUpDown className="w-4 h-4 text-muted" />
              Sort
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className="absolute top-full right-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                  {[
                    { value: "modified", label: "Date modified" },
                    { value: "name", label: "Name" },
                    { value: "size", label: "Size" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (sortBy === opt.value) {
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
                        } else {
                          setSortBy(opt.value as SortBy);
                          setSortOrder("desc");
                        }
                        setShowSortMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                        sortBy === opt.value ? "text-primary" : "text-muted"
                      }`}
                    >
                      {opt.label} {sortBy === opt.value && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bulk actions */}
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2 mt-3 p-2 bg-secondary/50 rounded-lg">
            <span className="text-sm text-muted">
              {selectedItems.size} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={() => {
                setShowMoveModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <FolderInput className="w-4 h-4" />
              Move
            </button>
            <button
              onClick={() => handleDelete(Array.from(selectedItems))}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Item list */}
        <div className={`flex-1 overflow-y-auto ${previewItem ? "border-r border-app" : ""}`}>
          {loading ? (
            <SkeletonInbox count={5} />
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted">
              <Inbox className="w-12 h-12 mb-3 opacity-50" />
              <span className="text-lg">Inbox is empty</span>
              <span className="text-sm mt-1">Quick captures will appear here</span>
            </div>
          ) : (
            <div className="divide-y divide-app">
              {/* Select all header */}
              <div className="px-4 py-2 bg-secondary/30 flex items-center gap-3">
                <button
                  onClick={selectAll}
                  className="p-0.5 text-muted hover:text-app transition-colors"
                >
                  {selectedItems.size === filteredItems.length ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <span className="text-xs text-muted">Select all</span>
              </div>

              {filteredItems.map((item) => (
                <div
                  key={item.path}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer ${
                    previewItem?.path === item.path ? "bg-accent/50" : ""
                  }`}
                  onClick={() => handlePreview(item)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.path);
                    }}
                    className="p-0.5 text-muted hover:text-app transition-colors"
                  >
                    {selectedItems.has(item.path) ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {/* Icon */}
                  {item.name.endsWith(".task.md") ? (
                    <CheckSquare className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-app truncate">{item.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(item.modified)}
                      </span>
                      {item.size && (
                        <span>{formatSize(item.size)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionItem(item);
                        setShowActionMenu(true);
                      }}
                      className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview panel */}
        {previewItem && (
          <div className="w-1/2 flex flex-col min-w-[300px]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-app bg-secondary/30">
              <span className="text-sm font-medium text-app truncate">{previewItem.name}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectFile(previewItem.path)}
                  className="px-3 py-1 text-sm text-primary hover:bg-accent rounded-lg transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => {
                    setPreviewItem(null);
                    setPreviewContent(null);
                  }}
                  className="p-1 text-muted hover:text-app rounded transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previewContent ? (
                <pre className="text-sm text-muted whitespace-pre-wrap font-mono">
                  {previewContent}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-muted">
                  Loading...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 border-t border-app bg-secondary/30">
              <button
                onClick={() => handleConvertToTask(previewItem)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Convert to Task
              </button>
              <button
                onClick={() => {
                  setShowMoveModal(true);
                  setSelectedItems(new Set([previewItem.path]));
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              >
                <FolderInput className="w-4 h-4" />
                Move
              </button>
              <button
                onClick={() => handleDelete([previewItem.path])}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action menu */}
      {showActionMenu && actionItem && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowActionMenu(false)} />
          <div
            className="fixed bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <button
              onClick={() => {
                onSelectFile(actionItem.path);
                setShowActionMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Open
            </button>
            <button
              onClick={() => {
                handleConvertToTask(actionItem);
                setShowActionMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              Convert to Task
            </button>
            <button
              onClick={() => {
                setSelectedItems(new Set([actionItem.path]));
                setShowMoveModal(true);
                setShowActionMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              <FolderInput className="w-4 h-4" />
              Move to folder...
            </button>
            <div className="border-t border-app my-1" />
            <button
              onClick={() => {
                handleDelete([actionItem.path]);
                setShowActionMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2 text-red-500"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Move modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-app rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-app">
              <h2 className="text-lg font-semibold text-app">Move to folder</h2>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveTargetFolder("");
                }}
                className="p-1.5 text-muted hover:text-app rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-app mb-2">
                Target folder (relative to vault)
              </label>
              <input
                type="text"
                value={moveTargetFolder}
                onChange={(e) => setMoveTargetFolder(e.target.value)}
                placeholder="e.g., Notes/Archive"
                className="w-full px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <p className="mt-2 text-xs text-muted">
                Enter the folder path where you want to move {selectedItems.size} item(s)
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-app bg-secondary/30">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMoveTargetFolder("");
                }}
                className="px-4 py-2 text-sm text-muted hover:text-app transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMove(Array.from(selectedItems), moveTargetFolder)}
                disabled={!moveTargetFolder.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <FolderInput className="w-4 h-4" />
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxView;
