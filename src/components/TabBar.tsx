import { X, FileText, Code2, Image, Film, Music, FileSpreadsheet, FileCode, LayoutDashboard, Kanban, Inbox, CalendarDays, CalendarClock, FolderKanban, ListChecks, Calendar } from "lucide-react";
import type { FileType } from "./Editor";

interface Tab {
  path: string;
  name: string;
  isDirty: boolean;
  fileType: FileType;
}

interface TabBarProps {
  tabs: Tab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
}

// Get small icon for tab
function getTabIcon(fileType: FileType) {
  switch (fileType) {
    case "md":
    case "txt":
      return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    case "code":
      return <Code2 className="w-3.5 h-3.5 text-green-500" />;
    case "json":
    case "yaml":
      return <FileCode className="w-3.5 h-3.5 text-amber-500" />;
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />;
    case "image":
      return <Image className="w-3.5 h-3.5 text-pink-500" />;
    case "video":
      return <Film className="w-3.5 h-3.5 text-purple-500" />;
    case "audio":
      return <Music className="w-3.5 h-3.5 text-cyan-500" />;
    case "pdf":
    case "docx":
      return <FileText className="w-3.5 h-3.5 text-red-500" />;
    case "html":
      return <Code2 className="w-3.5 h-3.5 text-orange-500" />;
    case "dashboard":
      return <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />;
    case "kanban":
      return <Kanban className="w-3.5 h-3.5 text-violet-500" />;
    case "mermaid":
      return <FileCode className="w-3.5 h-3.5 text-purple-500" />;
    case "excalidraw":
      return <FileCode className="w-3.5 h-3.5 text-violet-400" />;
    case "svg":
      return <FileCode className="w-3.5 h-3.5 text-emerald-400" />;
    case "task":
      return <CalendarDays className="w-3.5 h-3.5 text-blue-400" />;
    case "inbox":
      return <Inbox className="w-3.5 h-3.5 text-amber-500" />;
    case "tasks_today":
      return <CalendarDays className="w-3.5 h-3.5 text-orange-500" />;
    case "tasks_upcoming":
      return <CalendarClock className="w-3.5 h-3.5 text-blue-500" />;
    case "tasks_all":
      return <ListChecks className="w-3.5 h-3.5 text-green-500" />;
    case "project":
      return <FolderKanban className="w-3.5 h-3.5 text-violet-500" />;
    case "calendar":
      return <Calendar className="w-3.5 h-3.5 text-rose-500" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-muted" />;
  }
}

export function TabBar({ tabs, activeIndex, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center bg-card border-b border-app overflow-x-auto">
      {tabs.map((tab, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={tab.path}
            className={`group flex items-center gap-2 px-3 py-2 border-r border-app cursor-pointer transition-colors min-w-0 max-w-[200px] ${
              isActive
                ? "bg-app border-b-2 border-b-primary -mb-px"
                : "hover:bg-accent/50"
            }`}
            onClick={() => onSelect(index)}
          >
            {/* File icon */}
            <div className="flex-shrink-0">
              {getTabIcon(tab.fileType)}
            </div>

            {/* File name */}
            <span
              className={`text-sm truncate ${
                isActive ? "text-app" : "text-muted"
              }`}
              title={tab.path}
            >
              {tab.name}
            </span>

            {/* Dirty indicator */}
            {tab.isDirty && (
              <span className="w-2 h-2 rounded-full bg-chart-2 flex-shrink-0" />
            )}

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(index);
              }}
              className={`p-0.5 rounded transition-colors flex-shrink-0 ${
                isActive
                  ? "hover:bg-accent text-muted hover:text-app"
                  : "opacity-0 group-hover:opacity-100 hover:bg-accent text-muted hover:text-app"
              }`}
              title="Close tab"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default TabBar;
export type { Tab };
