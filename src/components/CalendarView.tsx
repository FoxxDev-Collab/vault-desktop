import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  FolderKanban,
  FileText,
  Inbox,
  RefreshCw,
} from "lucide-react";
import {
  dbGetTasks,
  dbGetProjects,
  dbIndexTasks,
  type Task,
  type Project,
} from "../hooks/useApi";

interface CalendarViewProps {
  onSelectItem: (path: string) => void;
  vaultPath?: string;
}

interface CalendarItem {
  id: string;
  title: string;
  path: string;
  date: Date;
  type: "task" | "project" | "note" | "inbox";
  status?: string;
  priority?: string;
  color?: string;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getStatusIcon(status?: string) {
  switch (status) {
    case "todo":
      return <Circle className="w-3 h-3 text-muted flex-shrink-0" />;
    case "in_progress":
      return <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />;
    case "done":
      return <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />;
    case "cancelled":
      return <AlertCircle className="w-3 h-3 text-gray-400 flex-shrink-0" />;
    default:
      return null;
  }
}

function getTypeIcon(type: CalendarItem["type"]) {
  switch (type) {
    case "task":
      return null; // Status icon handles this
    case "project":
      return <FolderKanban className="w-3 h-3 text-violet-500 flex-shrink-0" />;
    case "note":
      return <FileText className="w-3 h-3 text-emerald-500 flex-shrink-0" />;
    case "inbox":
      return <Inbox className="w-3 h-3 text-amber-500 flex-shrink-0" />;
    default:
      return null;
  }
}

function getTypeColor(type: CalendarItem["type"], priority?: string) {
  if (type === "task") {
    switch (priority) {
      case "urgent": return "bg-red-500/20 border-red-500/40 hover:bg-red-500/30";
      case "high": return "bg-orange-500/20 border-orange-500/40 hover:bg-orange-500/30";
      case "medium": return "bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30";
      default: return "bg-secondary/50 border-border hover:bg-secondary";
    }
  }
  switch (type) {
    case "project": return "bg-violet-500/20 border-violet-500/40 hover:bg-violet-500/30";
    case "note": return "bg-emerald-500/20 border-emerald-500/40 hover:bg-emerald-500/30";
    case "inbox": return "bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30";
    default: return "bg-secondary/50 border-border hover:bg-secondary";
  }
}

/**
 * Parse a date string (YYYY-MM-DD) as local time, not UTC.
 * This prevents the off-by-one-day bug caused by timezone conversion.
 */
function parseLocalDate(dateStr: string): Date {
  // Handle ISO strings with time component (e.g., "2026-01-27T00:00:00Z")
  const dateOnly = dateStr.split("T")[0];
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function CalendarView({ onSelectItem, vaultPath }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get first day of month and number of days
  const { firstDayOfMonth, daysInMonth, today } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    return {
      firstDayOfMonth: first.getDay(),
      daysInMonth: days,
      today: {
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
      },
    };
  }, [currentDate]);

  // Load all items with dates
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      // First index tasks to ensure DB is up to date
      if (vaultPath) {
        await dbIndexTasks(vaultPath);
      }

      // Load tasks
      const tasks = await dbGetTasks({});
      const calendarItems: CalendarItem[] = [];

      // Add tasks with due dates
      for (const task of tasks) {
        if (task.due_date) {
          calendarItems.push({
            id: `task-${task.id}`,
            title: task.title,
            path: task.path,
            date: parseLocalDate(task.due_date),
            type: "task",
            status: task.status,
            priority: task.priority,
          });
        }
      }

      // Load projects and add items with deadlines
      const projects = await dbGetProjects();
      for (const project of projects) {
        // Projects might have a deadline in their metadata
        // For now, we'll show the project creation as an event
        // You can extend this to parse project files for milestone dates
      }

      setItems(calendarItems);
    } catch (e) {
      console.error("Failed to load calendar items:", e);
    } finally {
      setLoading(false);
    }
  }, [vaultPath]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  // Get items for a specific day
  const getItemsForDay = (day: number) => {
    const key = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${day}`;
    return itemsByDate.get(key) || [];
  };

  // Get items for selected date
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return itemsByDate.get(key) || [];
  }, [selectedDate, itemsByDate]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Check if a day is today
  const isToday = (day: number) => {
    return (
      currentDate.getFullYear() === today.year &&
      currentDate.getMonth() === today.month &&
      day === today.day
    );
  };

  // Check if a day is selected
  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      currentDate.getFullYear() === selectedDate.getFullYear() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      day === selectedDate.getDate()
    );
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [firstDayOfMonth, daysInMonth]);

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <CalendarIcon className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold text-app">Calendar</h1>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col p-4 overflow-auto">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousMonth}
                className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-medium text-app min-w-[200px] text-center">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            >
              Today
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 flex-1">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="bg-secondary/20 rounded-lg" />;
              }

              const dayItems = getItemsForDay(day);
              const hasItems = dayItems.length > 0;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                  className={`
                    min-h-[80px] p-1 rounded-lg border cursor-pointer transition-colors
                    ${isToday(day) ? "border-primary bg-primary/10" : "border-border bg-secondary/20"}
                    ${isSelected(day) ? "ring-2 ring-primary ring-offset-1 ring-offset-app" : ""}
                    hover:bg-secondary/40
                  `}
                >
                  <div className={`
                    text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday(day) ? "bg-primary text-primary-foreground" : "text-app"}
                  `}>
                    {day}
                  </div>

                  {/* Item indicators */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem(item.path);
                        }}
                        className={`
                          text-xs px-1.5 py-0.5 rounded truncate border cursor-pointer
                          ${getTypeColor(item.type, item.priority)}
                        `}
                        title={item.title}
                      >
                        <div className="flex items-center gap-1">
                          {item.type === "task" ? getStatusIcon(item.status) : getTypeIcon(item.type)}
                          <span className="truncate">{item.title}</span>
                        </div>
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-xs text-muted px-1.5">
                        +{dayItems.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Panel */}
        <div className="w-80 border-l border-border flex flex-col bg-secondary/20">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-app">
              {selectedDate
                ? selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Select a date"}
            </h3>
            <p className="text-sm text-muted mt-1">
              {selectedDateItems.length} item{selectedDateItems.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-2">
            {selectedDateItems.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                {selectedDate ? "No items for this date" : "Click a date to see items"}
              </p>
            ) : (
              selectedDateItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.path)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-colors
                    ${getTypeColor(item.type, item.priority)}
                  `}
                >
                  <div className="flex items-start gap-2">
                    {item.type === "task" ? getStatusIcon(item.status) : getTypeIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-app truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted capitalize">{item.type}</span>
                        {item.priority && item.priority !== "medium" && (
                          <span className={`
                            text-xs px-1.5 py-0.5 rounded-full
                            ${item.priority === "urgent" ? "bg-red-500/20 text-red-500" :
                              item.priority === "high" ? "bg-orange-500/20 text-orange-500" :
                              "bg-gray-500/20 text-gray-400"}
                          `}>
                            {item.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-border flex items-center gap-6 text-xs text-muted">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
          <span>Urgent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500/50" />
          <span>High Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50" />
          <span>Medium Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-violet-500/30 border border-violet-500/50" />
          <span>Project</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" />
          <span>Note</span>
        </div>
      </div>
    </div>
  );
}
