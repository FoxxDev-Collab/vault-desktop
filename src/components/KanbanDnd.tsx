import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  GripVertical,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import type { Task, TaskPriority } from "../hooks/useApi";

interface KanbanDndProps {
  tasks: Task[];
  columns: string[];
  onMoveTask: (taskPath: string, newColumn: string) => Promise<void>;
  onSelectTask: (path: string) => void;
  onCreateTask?: (title: string, column: string) => Promise<void>;
  onDeleteTask?: (taskPath: string) => Promise<void>;
}

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case "urgent":
      return "border-l-red-500";
    case "high":
      return "border-l-orange-500";
    case "medium":
      return "border-l-blue-500";
    case "low":
      return "border-l-gray-400";
    default:
      return "border-l-gray-400";
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
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[priority]}`}>
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

function formatDueDate(dueDate: string | null): { text: string; color: string } | null {
  if (!dueDate) return null;

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

// Sortable task card
function SortableTaskCard({
  task,
  onClick,
  onDelete,
}: {
  task: Task;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.path,
    // Disable animations to prevent snap-back effect when moving between columns
    animateLayoutChanges: () => false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    // Only apply transition while actively dragging, not on drop
    transition: isDragging ? transition : undefined,
  };

  const due = formatDueDate(task.due_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-app rounded-lg p-3 cursor-pointer hover:border-primary transition-colors group border-l-4 ${getPriorityColor(task.priority)} ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:text-app cursor-grab active:cursor-grabbing transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-app line-clamp-2 mb-1.5">
              {task.title}
            </p>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
                title="Edit task"
              >
                <Pencil className="w-3 h-3" />
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {getPriorityBadge(task.priority)}
            {due && (
              <span className={`text-xs flex items-center gap-1 ${due.color}`}>
                <Calendar className="w-3 h-3" />
                {due.text}
              </span>
            )}
          </div>
          {task.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 bg-accent rounded text-muted"
                >
                  #{tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-xs text-muted">+{task.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Drag overlay card (shown while dragging)
function DragOverlayCard({ task }: { task: Task }) {
  const due = formatDueDate(task.due_date);

  return (
    <div
      className={`bg-card border border-primary rounded-lg p-3 shadow-xl border-l-4 ${getPriorityColor(task.priority)} rotate-2`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 p-0.5 text-muted">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-app line-clamp-2 mb-1.5">
            {task.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {getPriorityBadge(task.priority)}
            {due && (
              <span className={`text-xs flex items-center gap-1 ${due.color}`}>
                <Calendar className="w-3 h-3" />
                {due.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Column component
function KanbanColumn({
  id,
  title,
  tasks,
  onSelectTask,
  onCreateTask,
  onDeleteTask,
}: {
  id: string;
  title: string;
  tasks: Task[];
  onSelectTask: (path: string) => void;
  onCreateTask?: (title: string) => Promise<void>;
  onDeleteTask?: (taskPath: string) => Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Make the column a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  const handleCreate = async () => {
    if (!newTaskTitle.trim() || isCreating || !onCreateTask) return;
    setIsCreating(true);
    try {
      await onCreateTask(newTaskTitle.trim());
      setNewTaskTitle("");
      setIsAdding(false);
    } catch (e) {
      console.error("Failed to create task:", e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] max-w-[400px] flex flex-col bg-secondary/30 rounded-xl transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/50" : ""
      }`}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 border-b border-app">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-app capitalize">{title}</span>
          <span className="text-xs text-muted bg-accent px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        <SortableContext
          items={tasks.map((t) => t.path)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.path}
              task={task}
              onClick={() => onSelectTask(task.path)}
              onDelete={onDeleteTask ? () => onDeleteTask(task.path) : undefined}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isAdding && (
          <div className="h-20 flex items-center justify-center text-xs text-muted border-2 border-dashed border-app/30 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>

      {/* Add task section */}
      {onCreateTask && (
        <div className="p-2 border-t border-app">
          {isAdding ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewTaskTitle("");
                  }
                }}
                placeholder="Task title..."
                className="w-full px-3 py-2 bg-card border border-app rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                disabled={isCreating}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={isCreating || !newTaskTitle.trim()}
                  className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isCreating ? "Adding..." : "Add"}
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewTaskTitle("");
                  }}
                  disabled={isCreating}
                  className="px-3 py-1.5 text-sm text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Custom collision detection - prefer columns over tasks for cross-column moves
const customCollisionDetection: CollisionDetection = (args) => {
  // First check if pointer is within any droppable
  const pointerCollisions = pointerWithin(args);

  // If we have collisions, prioritize column droppables over task droppables
  if (pointerCollisions.length > 0) {
    // Check if any collision is a column (not a task path)
    const columnCollision = pointerCollisions.find(
      (collision) => !String(collision.id).includes("\\") && !String(collision.id).includes("/")
    );
    if (columnCollision) {
      return [columnCollision];
    }
    return pointerCollisions;
  }

  // Fall back to rect intersection if pointer not within
  return rectIntersection(args);
};

export function KanbanDnd({
  tasks,
  columns,
  onMoveTask,
  onSelectTask,
  onCreateTask,
  onDeleteTask,
}: KanbanDndProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduced from 8 for easier activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    for (const col of columns) {
      grouped[col] = [];
    }
    for (const task of tasks) {
      const col = task.column_name || columns[0] || "backlog";
      if (!grouped[col]) grouped[col] = [];
      grouped[col].push(task);
    }
    return grouped;
  }, [tasks, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.path === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskData = tasks.find((t) => t.path === active.id);
    if (!activeTaskData) return;

    // Determine target column
    let targetColumn: string | null = null;

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.path === over.id);
    if (overTask) {
      targetColumn = overTask.column_name;
    } else if (columns.includes(over.id as string)) {
      // Dropped on column directly
      targetColumn = over.id as string;
    }

    if (targetColumn && targetColumn !== activeTaskData.column_name) {
      await onMoveTask(activeTaskData.path, targetColumn);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-x-auto p-4">
        <div className="flex gap-4 h-full">
          {columns.map((column) => (
            <KanbanColumn
              key={column}
              id={column}
              title={column}
              tasks={tasksByColumn[column] || []}
              onSelectTask={onSelectTask}
              onCreateTask={onCreateTask ? (title: string) => onCreateTask(title, column) : undefined}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask && <DragOverlayCard task={activeTask} />}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanDnd;
