/**
 * Skeleton loading components for perceived performance
 * Uses CSS shimmer animation defined in index.css
 */

interface SkeletonProps {
  className?: string;
}

// Basic skeleton line
export function SkeletonLine({
  width = "100%",
  height = "1rem",
  className = ""
}: SkeletonProps & { width?: string; height?: string }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
}

// Multi-line text block
export function SkeletonBlock({
  lines = 3,
  className = ""
}: SkeletonProps & { lines?: number }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

// Card-shaped skeleton
export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`p-4 border border-app rounded-lg bg-card ${className}`}>
      <div className="flex items-start gap-3">
        <div className="skeleton w-5 h-5 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="70%" height="1.25rem" />
          <SkeletonLine width="40%" height="0.75rem" />
        </div>
      </div>
    </div>
  );
}

// List of skeleton items
export function SkeletonList({
  count = 3,
  className = ""
}: SkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// File tree skeleton
export function SkeletonFileTree({ className = "" }: SkeletonProps) {
  return (
    <div className={`space-y-1 p-2 ${className}`}>
      {/* Root level items */}
      <div className="flex items-center gap-2 py-1">
        <div className="skeleton w-4 h-4 rounded" />
        <SkeletonLine width="60%" height="0.875rem" />
      </div>
      <div className="flex items-center gap-2 py-1">
        <div className="skeleton w-4 h-4 rounded" />
        <SkeletonLine width="45%" height="0.875rem" />
      </div>
      {/* Nested items */}
      <div className="ml-4 space-y-1">
        <div className="flex items-center gap-2 py-1">
          <div className="skeleton w-4 h-4 rounded" />
          <SkeletonLine width="50%" height="0.875rem" />
        </div>
        <div className="flex items-center gap-2 py-1">
          <div className="skeleton w-4 h-4 rounded" />
          <SkeletonLine width="55%" height="0.875rem" />
        </div>
      </div>
      <div className="flex items-center gap-2 py-1">
        <div className="skeleton w-4 h-4 rounded" />
        <SkeletonLine width="70%" height="0.875rem" />
      </div>
    </div>
  );
}

// Kanban column skeleton
export function SkeletonKanbanColumn({ className = "" }: SkeletonProps) {
  return (
    <div className={`flex-shrink-0 w-72 bg-secondary/30 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <SkeletonLine width="40%" height="1rem" />
        <div className="skeleton w-5 h-5 rounded-full" />
      </div>
      <div className="space-y-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

// Kanban board skeleton
export function SkeletonKanban({ columns = 4, className = "" }: SkeletonProps & { columns?: number }) {
  return (
    <div className={`flex gap-4 overflow-x-auto p-4 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonKanbanColumn key={i} />
      ))}
    </div>
  );
}

// Calendar grid skeleton
export function SkeletonCalendar({ className = "" }: SkeletonProps) {
  return (
    <div className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine width="120px" height="1.5rem" />
        <div className="flex gap-2">
          <div className="skeleton w-8 h-8 rounded" />
          <div className="skeleton w-8 h-8 rounded" />
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonLine key={i} width="100%" height="1rem" />
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Task list skeleton
export function SkeletonTaskList({ count = 5, className = "" }: SkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-2 p-4 ${className}`}>
      {/* Quick add skeleton */}
      <div className="flex gap-2 mb-4">
        <SkeletonLine width="100%" height="2.5rem" />
        <div className="skeleton w-20 h-10 rounded-lg flex-shrink-0" />
      </div>
      {/* Task cards */}
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// Inbox skeleton
export function SkeletonInbox({ count = 5, className = "" }: SkeletonProps & { count?: number }) {
  return (
    <div className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine width="80px" height="1.5rem" />
        <div className="skeleton w-8 h-8 rounded" />
      </div>
      {/* Quick capture */}
      <div className="mb-4">
        <SkeletonLine width="100%" height="2.5rem" />
      </div>
      {/* Items */}
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-app rounded-lg">
            <div className="skeleton w-4 h-4 rounded" />
            <div className="flex-1 space-y-1">
              <SkeletonLine width="60%" height="1rem" />
              <SkeletonLine width="30%" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  SkeletonLine,
  SkeletonBlock,
  SkeletonCard,
  SkeletonList,
  SkeletonFileTree,
  SkeletonKanbanColumn,
  SkeletonKanban,
  SkeletonCalendar,
  SkeletonTaskList,
  SkeletonInbox,
};
