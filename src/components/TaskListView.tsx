import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Filter,
  Search,
  RefreshCw,
  ChevronDown,
  FolderKanban,
  CalendarDays,
  CalendarClock,
  ListTodo,
} from "lucide-react";
import {
  dbGetTasks,
  dbGetTasksToday,
  dbGetTasksUpcoming,
  dbGetProjects,
  dbIndexTasks,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskFilter,
  type Project,
} from "../hooks/useApi";
import { SkeletonTaskList } from "./Skeleton";

type ViewType = "today" | "upcoming" | "all";

interface TaskListViewProps {
  onSelectTask: (path: string) => void;
  initialView?: ViewType;
}

const STATUS_OPTIONS: { value: TaskStatus | "all"; label: string; icon: typeof Circle; color: string }[] = [
  { value: "all", label: "All", icon: ListTodo, color: "text-muted" },
  { value: "todo", label: "To Do", icon: Circle, color: "text-muted" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-blue-500" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-green-500" },
  { value: "cancelled", label: "Cancelled", icon: AlertCircle, color: "text-gray-400" },
];

const PRIORITY_OPTIONS: { value: TaskPriority | "all"; label: string; color: string }[] = [
  { value: "all", label: "All", color: "text-muted" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
  { value: "high", label: "High", color: "text-orange-500" },
  { value: "medium", label: "Medium", color: "text-blue-500" },
  { value: "low", label: "Low", color: "text-gray-400" },
];

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

export function TaskListView({ onSelectTask, initialView = "today" }: TaskListViewProps) {
  const [view, setView] = useState<ViewType>(initialView);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  // Load tasks based on view
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      let result: Task[];
      switch (view) {
        case "today":
          result = await dbGetTasksToday();
          break;
        case "upcoming":
          result = await dbGetTasksUpcoming(7);
          break;
        case "all":
        default:
          const filter: TaskFilter = {};
          if (statusFilter !== "all") filter.status = statusFilter;
          if (priorityFilter !== "all") filter.priority = priorityFilter;
          if (projectFilter !== "all") filter.project_path = projectFilter;
          result = await dbGetTasks(filter);
          break;
      }
      setTasks(result);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    } finally {
      setLoading(false);
    }
  }, [view, statusFilter, priorityFilter, projectFilter]);

  // Load projects
  useEffect(() => {
    dbGetProjects("active").then(setProjects).catch(console.error);
  }, []);

  // Reload tasks when filters change
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Reindex and reload
  const handleReindex = async () => {
    setLoading(true);
    try {
      await dbIndexTasks();
      await loadTasks();
    } catch (e) {
      console.error("Failed to reindex:", e);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

  // Group tasks by status for "all" view
  const groupedTasks = useMemo(() => {
    if (view !== "all") return null;

    const groups: Record<string, Task[]> = {
      in_progress: [],
      todo: [],
      done: [],
      cancelled: [],
    };

    for (const task of filteredTasks) {
      groups[task.status]?.push(task);
    }

    return groups;
  }, [filteredTasks, view]);

  const currentProject = projects.find((p) => p.path === projectFilter);

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-app bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* View selector */}
            <div className="flex bg-secondary rounded-lg p-1">
              <button
                onClick={() => setView("today")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  view === "today"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Today
              </button>
              <button
                onClick={() => setView("upcoming")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  view === "upcoming"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <CalendarClock className="w-4 h-4" />
                Upcoming
              </button>
              <button
                onClick={() => setView("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  view === "all"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <ListTodo className="w-4 h-4" />
                All
              </button>
            </div>
          </div>

          <button
            onClick={handleReindex}
            disabled={loading}
            className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            title="Reindex tasks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-2 bg-secondary rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {view === "all" && (
            <>
              {/* Status filter */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm hover:bg-accent transition-colors"
                >
                  <Filter className="w-4 h-4 text-muted" />
                  Status
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute top-full right-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setStatusFilter(opt.value);
                            setShowStatusMenu(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
                            statusFilter === opt.value ? "bg-accent" : ""
                          } ${opt.color}`}
                        >
                          <opt.icon className="w-4 h-4" />
                          <span className="text-sm">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Priority filter */}
              <div className="relative">
                <button
                  onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm hover:bg-accent transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-muted" />
                  Priority
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showPriorityMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPriorityMenu(false)} />
                    <div className="absolute top-full right-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setPriorityFilter(opt.value);
                            setShowPriorityMenu(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
                            priorityFilter === opt.value ? "bg-accent" : ""
                          } ${opt.color}`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Project filter */}
              <div className="relative">
                <button
                  onClick={() => setShowProjectMenu(!showProjectMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm hover:bg-accent transition-colors"
                >
                  <FolderKanban className="w-4 h-4 text-muted" />
                  {currentProject?.name || "Project"}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showProjectMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
                    <div className="absolute top-full right-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 min-w-[180px] max-h-60 overflow-y-auto">
                      <button
                        onClick={() => {
                          setProjectFilter("all");
                          setShowProjectMenu(false);
                        }}
                        className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
                          projectFilter === "all" ? "bg-accent" : ""
                        }`}
                      >
                        <span className="text-sm">All Projects</span>
                      </button>
                      {projects.map((proj) => (
                        <button
                          key={proj.id}
                          onClick={() => {
                            setProjectFilter(proj.path);
                            setShowProjectMenu(false);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-accent transition-colors ${
                            projectFilter === proj.path ? "bg-accent" : ""
                          }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: proj.color || "#3b82f6" }}
                          />
                          <span className="text-sm truncate">{proj.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonTaskList count={5} />
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted">
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm">No tasks found</span>
          </div>
        ) : view === "all" && groupedTasks ? (
          // Grouped view for "all"
          <div className="p-4 space-y-6">
            {Object.entries(groupedTasks).map(([status, statusTasks]) => {
              if (statusTasks.length === 0) return null;
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === status);

              return (
                <div key={status}>
                  <div className={`flex items-center gap-2 mb-2 ${statusOpt?.color || ""}`}>
                    {statusOpt && <statusOpt.icon className="w-4 h-4" />}
                    <span className="text-sm font-medium capitalize">{statusOpt?.label || status}</span>
                    <span className="text-xs text-muted">({statusTasks.length})</span>
                  </div>
                  <div className="space-y-2">
                    {statusTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onClick={() => onSelectTask(task.path)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Simple list for today/upcoming
          <div className="p-4 space-y-2">
            {filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onSelectTask(task.path)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Task card component
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
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
            {due.text && (
              <span className={`flex items-center gap-1 ${due.color}`}>
                <Calendar className="w-3 h-3" />
                {due.text}
              </span>
            )}
            {task.project_path && (
              <span className="flex items-center gap-1">
                <FolderKanban className="w-3 h-3" />
                {task.project_path.split("/").pop()}
              </span>
            )}
            {task.tags.length > 0 && (
              <span className="truncate">{task.tags.map((t) => `#${t}`).join(" ")}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default TaskListView;
