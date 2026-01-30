import { useState, useCallback } from "react";
import { X, Rocket, FolderOpen, Terminal, Globe } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { dbAddDevProject, type DevProject } from "../hooks/useApi";

interface DevProjectWizardProps {
  onClose: () => void;
  onCreated: (project: DevProject) => void;
  vaultPath: string;
}

export function DevProjectWizard({ onClose, onCreated, vaultPath }: DevProjectWizardProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [command, setCommand] = useState("bun dev");
  const [port, setPort] = useState(3000);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBrowse = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: vaultPath,
        title: "Select project folder",
      });

      if (selected && typeof selected === "string") {
        setPath(selected);
        // Auto-fill name from folder name if empty
        if (!name) {
          const folderName = selected.split(/[/\\]/).pop() || "";
          setName(folderName);
        }
      }
    } catch (e) {
      console.error("Failed to open folder dialog:", e);
    }
  }, [vaultPath, name]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    if (!path.trim()) {
      setError("Project path is required");
      return;
    }

    if (!command.trim()) {
      setError("Dev command is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const project = await dbAddDevProject(path.trim(), name.trim(), command.trim(), port);
      onCreated(project);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
    }
  }, [name, path, command, port, onCreated]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-app rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app">
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-app">Add Dev Project</h2>
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
          {/* Path */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              <FolderOpen className="w-4 h-4 inline mr-1" />
              Project Folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="flex-1 px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              />
              <button
                onClick={handleBrowse}
                className="px-3 py-2 bg-secondary border border-app rounded-lg text-app hover:bg-accent transition-colors"
              >
                Browse
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My App"
              className="w-full px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Command */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              <Terminal className="w-4 h-4 inline mr-1" />
              Dev Command
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="bun dev"
              className="w-full px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
            <p className="mt-1 text-xs text-muted">Command to start the development server</p>
          </div>

          {/* Port */}
          <div>
            <label className="block text-sm font-medium text-app mb-1.5">
              <Globe className="w-4 h-4 inline mr-1" />
              Port
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 3000)}
              min={1}
              max={65535}
              className="w-32 px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-app">
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted hover:text-app transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isCreating ? "Adding..." : "Add Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DevProjectWizard;
