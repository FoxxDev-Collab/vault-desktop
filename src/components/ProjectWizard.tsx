import { useState, useCallback } from "react";
import {
  X,
  FolderKanban,
  Palette,
  FileText,
  Columns3,
} from "lucide-react";
import { projectCreate, type CreateProjectOptions } from "../hooks/useApi";

interface ProjectWizardProps {
  onClose: () => void;
  onCreated: (path: string) => void;
  defaultPath?: string;
}

const COLOR_OPTIONS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#6366f1", label: "Indigo" },
];

const DEFAULT_COLUMNS = ["backlog", "doing", "review", "done"];

export function ProjectWizard({ onClose, onCreated, defaultPath }: ProjectWizardProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [relativePath, setRelativePath] = useState(defaultPath || "Projects");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const options: CreateProjectOptions = {
        relative_path: relativePath.trim() || undefined,
        description: description.trim() || undefined,
        color,
      };

      const path = await projectCreate(name.trim(), options);
      onCreated(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
    }
  }, [name, description, color, relativePath, onCreated]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-app rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-app">Create Project</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website Redesign"
              className="w-full px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              Description <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={2}
              className="w-full px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              Location
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted text-sm">/</span>
              <input
                type="text"
                value={relativePath}
                onChange={(e) => setRelativePath(e.target.value)}
                placeholder="Projects"
                className="flex-1 px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-muted text-sm">/</span>
              <span className="text-muted text-sm truncate max-w-[100px]">
                {name || "Project Name"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Folder will be created at this location
            </p>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Color
              </div>
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    color === opt.value
                      ? "ring-2 ring-offset-2 ring-offset-card ring-primary scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: opt.value }}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          {/* Default columns info */}
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-muted mb-2">
              <Columns3 className="w-4 h-4" />
              Default Kanban Columns
            </div>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLUMNS.map((col) => (
                <span
                  key={col}
                  className="px-2 py-0.5 bg-accent text-xs rounded capitalize"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app bg-secondary/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-app transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FolderKanban className="w-4 h-4" />
            {isCreating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectWizard;
