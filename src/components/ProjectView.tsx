import { useState, useEffect, useCallback } from "react";
import {
  FolderKanban,
  ListTodo,
  Kanban,
  ChevronLeft,
  RefreshCw,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
} from "lucide-react";
import {
  dbGetProject,
  dbGetProjectTasks,
  dbIndexTasks,
  taskCreate,
  taskUpdate,
  deleteFile,
  type Project,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "../hooks/useApi";
import { KanbanDnd } from "./KanbanDnd";
import { ConfirmModal } from "./Modal";
import { useToast } from "./Toast";
import { SkeletonKanban } from "./Skeleton";

type TabType = "tasks" | "board" | "files";

interface ProjectViewProps {
  projectPath: string;
  onBack: () => void;
  onSelectTask: (path: string) => void;
  onSelectFile: (path: string) => void;
}

function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case "todo":
      return <Circle className="w-4 h-4 text-muted" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-blue-500" />;
    case "done":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "cancelled":
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    default:
      return <Circle className="w-4 h-4" />;
  }
}

function getPriorityBadge(priority: TaskPriority) {
  const colors: Record<TaskPriority, string> = {
    low: "bg-gray-500/20 text-gray-400",
    medium: "bg-blue-500/20 text-blue-500",
    high: "bg-orange-500/20 text-orange-500",
    urgent: "bg-red-500/20 text-red-500",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[priority]}`}>
      {priority}
    </span>
  );
}

// Parse date string as local time to avoid timezone issues
function parseLocalDate(dateStr: string): Date {
  const dateOnly = dateStr.split("T")[0];
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDueDate(dueDate: string | null): { text: string; color: string } {
  if (!dueDate) return { text: "", color: "" };

  const due = parseLocalDate(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d overdue`, color: "text-red-500" };
  } else if (diffDays === 0) {
    return { text: "Today", color: "text-orange-500" };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", color: "text-yellow-500" };
  } else if (diffDays <= 7) {
    return { text: `${diffDays}d`, color: "text-muted" };
  } else {
    return { text: due.toLocaleDateString(), color: "text-muted" };
  }
}

export function ProjectView({
  projectPath,
  onBack,
  onSelectTask,
  onSelectFile,
}: ProjectViewProps) {
  // Validate projectPath - if empty, something is wrong with how the project was opened
  if (!projectPath || projectPath.trim() === "") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <FolderKanban className="w-12 h-12 mb-3 opacity-50" />
        <span>Project path is invalid</span>
        <span className="text-sm mt-1">The project could not be opened correctly.</span>
        <span className="text-xs mt-2 text-red-500">Debug: projectPath = "{projectPath}"</span>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm bg-secondary rounded-lg hover:bg-accent transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("board");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const toast = useToast();

  // Load project and tasks
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectData, projectTasks] = await Promise.all([
        dbGetProject(projectPath),
        dbGetProjectTasks(projectPath),
      ]);
      setProject(projectData);
      setTasks(projectTasks);
    } catch (e) {
      console.error("Failed to load project:", e);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create new task in project
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || creatingTask) return;

    setCreatingTask(true);
    try {
      const path = await taskCreate(newTaskTitle.trim(), {
        project_path: projectPath,
        column: "backlog",
      });
      setNewTaskTitle("");
      // Refresh tasks
      const projectTasks = await dbGetProjectTasks(projectPath);
      setTasks(projectTasks);
      toast.success("Task created");
    } catch (e) {
      toast.error("Failed to create task");
      console.error("Failed to create task:", e);
    } finally {
      setCreatingTask(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await dbIndexTasks();
      await loadData();
    } catch (e) {
      console.error("Failed to refresh:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="h-full bg-app">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="skeleton w-6 h-6 rounded" />
          <div className="skeleton w-48 h-6 rounded" />
        </div>
        <SkeletonKanban columns={4} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <FolderKanban className="w-12 h-12 mb-3 opacity-50" />
        <span>Project not found</span>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-sm bg-secondary rounded-lg hover:bg-accent transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-app bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color || "#3b82f6" }}
            />
            <h1 className="text-xl font-semibold text-app">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {project.description && (
          <p className="text-sm text-muted mb-3 ml-12">{project.description}</p>
        )}

        {/* Tabs */}
        <div className="flex gap-1 ml-12">
          <button
            onClick={() => setActiveTab("board")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === "board"
                ? "bg-accent text-app"
                : "text-muted hover:text-app hover:bg-accent/50"
            }`}
          >
            <Kanban className="w-4 h-4" />
            Board
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === "tasks"
                ? "bg-accent text-app"
                : "text-muted hover:text-app hover:bg-accent/50"
            }`}
          >
            <ListTodo className="w-4 h-4" />
            List
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "board" ? (
          // Kanban Board with Drag & Drop
          <KanbanDnd
            tasks={tasks}
            columns={[...(project.columns || ["backlog", "doing", "review", "done"]), ...(!project.columns?.includes("archived") ? ["archived"] : [])]}
            onMoveTask={async (taskPath, newColumn) => {
              // Map column to status for sync
              const columnToStatus: Record<string, TaskStatus> = {
                backlog: "todo",
                doing: "in_progress",
                review: "in_progress",
                done: "done",
                archived: "cancelled",
              };
              const newStatus = columnToStatus[newColumn] || "todo";

              // Optimistic update - update UI immediately
              setTasks((prev) =>
                prev.map((t) =>
                  t.path === taskPath
                    ? { ...t, column_name: newColumn, status: newStatus }
                    : t
                )
              );
              try {
                // Update both column and status together
                await taskUpdate(taskPath, { column: newColumn, status: newStatus });
                // Re-index to sync database with file changes
                await dbIndexTasks();
                toast.success(`Moved to ${newColumn}`);
              } catch (e) {
                toast.error("Failed to move task");
                console.error("Failed to move task:", e);
                // Revert on failure - reload from database
                const projectTasks = await dbGetProjectTasks(projectPath);
                setTasks(projectTasks);
              }
            }}
            onSelectTask={onSelectTask}
            onCreateTask={async (title, column) => {
              try {
                await taskCreate(title, {
                  project_path: projectPath,
                  column,
                });
                // Re-index tasks to pick up new one
                await dbIndexTasks();
                const projectTasks = await dbGetProjectTasks(projectPath);
                setTasks(projectTasks);
                toast.success("Task created");
              } catch (e) {
                toast.error("Failed to create task");
                console.error("Failed to create task:", e);
              }
            }}
            onDeleteTask={(taskPath) => {
              const task = tasks.find((t) => t.path === taskPath);
              if (task) setTaskToDelete(task);
            }}
          />
        ) : (
          // Task List
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {/* Quick add */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTask();
                }}
                placeholder="New task title..."
                className="flex-1 px-3 py-2 bg-secondary border border-app rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleCreateTask}
                disabled={creatingTask || !newTaskTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Tasks grouped by status */}
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted">
                <ListTodo className="w-12 h-12 mb-3 opacity-50" />
                <span>No tasks yet</span>
                <span className="text-sm mt-1">Create your first task above</span>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskListCard
                  key={task.id}
                  task={task}
                  onClick={() => onSelectTask(task.path)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete Task Confirmation */}
      <ConfirmModal
        title="Delete Task"
        message={`Delete "${taskToDelete?.title}"? This action cannot be undone.`}
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => {
          // Capture values before modal closes and clears state
          const taskPath = taskToDelete?.path;
          if (!taskPath) return;

          // Optimistic update - remove from UI immediately
          setTasks((prev) => prev.filter((t) => t.path !== taskPath));

          // Run async deletion
          (async () => {
            try {
              await deleteFile(taskPath);
              // Re-index and refresh to ensure sync
              await dbIndexTasks();
              const projectTasks = await dbGetProjectTasks(projectPath);
              setTasks(projectTasks);
              toast.info("Task deleted");
            } catch (e) {
              toast.error("Failed to delete task");
              console.error("Failed to delete task:", e);
              // Refresh to restore state if delete failed
              const projectTasks = await dbGetProjectTasks(projectPath);
              setTasks(projectTasks);
            }
          })();
        }}
        confirmLabel="Delete Task"
        danger
      />
    </div>
  );
}

// Task list card component
function TaskListCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const due = formatDueDate(task.due_date);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-card border border-app rounded-lg hover:border-primary transition-colors"
    >
      <div className="flex items-start gap-3">
        {getStatusIcon(task.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-app truncate">{task.title}</span>
            {getPriorityBadge(task.priority)}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="capitalize">{task.column_name}</span>
            {due.text && (
              <span className={`flex items-center gap-1 ${due.color}`}>
                <Calendar className="w-3 h-3" />
                {due.text}
              </span>
            )}
            {task.tags.length > 0 && (
              <span className="truncate">
                {task.tags.map((t) => `#${t}`).join(" ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default ProjectView;
