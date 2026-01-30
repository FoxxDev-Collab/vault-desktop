import { useState, useEffect } from "react";
import {
  X,
  Sun,
  Moon,
  Monitor,
  Type,
  Code2,
  Eye,
  FolderTree,
  Save,
  RotateCcw,
  FolderOpen,
  Columns,
  Edit3,
  HardDrive,
  Home,
  TerminalSquare,
  RotateCw,
  FileText,
  Inbox,
  CalendarDays,
  CalendarClock,
  Calendar,
  ListChecks,
  FolderKanban,
  ChevronDown,
} from "lucide-react";
import { VIRTUAL_PATHS } from "./Editor";

export interface AppSettings {
  // Appearance
  theme: "light" | "dark" | "system";
  accentColor: string;

  // Editor
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  defaultViewMode: "edit" | "preview" | "split";

  // Files
  showHiddenFiles: boolean;
  confirmDelete: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  defaultFoldersOpen: boolean;
  foldersOpenDepth: number;

  // Startup
  homePage: string | null;
  homePageName: string | null;
  startupBehavior: "home" | "restore" | "empty";

  // Terminal
  terminalPosition: "bottom" | "right";
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  accentColor: "blue",
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  defaultViewMode: "split",
  showHiddenFiles: false,
  confirmDelete: true,
  autoSave: false,
  autoSaveDelay: 5000,
  defaultFoldersOpen: true,
  foldersOpenDepth: 2,
  homePage: null,
  homePageName: null,
  startupBehavior: "empty",
  terminalPosition: "bottom",
};

const ACCENT_COLORS = [
  { id: "blue", color: "#3b82f6", name: "Blue" },
  { id: "purple", color: "#8b5cf6", name: "Purple" },
  { id: "green", color: "#22c55e", name: "Green" },
  { id: "orange", color: "#f97316", name: "Orange" },
  { id: "pink", color: "#ec4899", name: "Pink" },
  { id: "cyan", color: "#06b6d4", name: "Cyan" },
];

interface Project {
  id: number;
  path: string;
  name: string;
  color: string | null;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  vaultPath: string | null;
  onVaultPathChange: (path: string) => void;
  projects?: Project[];
}

export function Settings({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  vaultPath,
  onVaultPathChange,
  projects = [],
}: SettingsProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeSection, setActiveSection] = useState<"appearance" | "editor" | "files" | "startup" | "vault">("appearance");
  const [newVaultPath, setNewVaultPath] = useState(vaultPath || "");
  const [showHomePageMenu, setShowHomePageMenu] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setNewVaultPath(vaultPath || "");
  }, [settings, vaultPath, isOpen]);

  const handleChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    onSettingsChange(DEFAULT_SETTINGS);
  };

  if (!isOpen) return null;

  const sections = [
    { id: "appearance" as const, label: "Appearance", icon: <Sun className="w-4 h-4" /> },
    { id: "editor" as const, label: "Editor", icon: <Code2 className="w-4 h-4" /> },
    { id: "files" as const, label: "Files", icon: <FolderTree className="w-4 h-4" /> },
    { id: "startup" as const, label: "Startup", icon: <Home className="w-4 h-4" /> },
    { id: "vault" as const, label: "Vault", icon: <HardDrive className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-app max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app">
          <h2 className="text-lg font-semibold text-app">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-app p-3 space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:text-app hover:bg-accent"
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>

          {/* Settings content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeSection === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-app mb-3">Theme</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "light", icon: <Sun className="w-5 h-5" />, label: "Light" },
                      { id: "dark", icon: <Moon className="w-5 h-5" />, label: "Dark" },
                      { id: "system", icon: <Monitor className="w-5 h-5" />, label: "System" },
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleChange("theme", theme.id as AppSettings["theme"])}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          localSettings.theme === theme.id
                            ? "border-primary bg-primary/10"
                            : "border-app hover:border-muted"
                        }`}
                      >
                        <div className={localSettings.theme === theme.id ? "text-primary" : "text-muted"}>
                          {theme.icon}
                        </div>
                        <span className={`text-sm ${localSettings.theme === theme.id ? "text-primary" : "text-app"}`}>
                          {theme.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-app mb-3">Accent Color</h3>
                  <div className="flex gap-3">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => handleChange("accentColor", color.id)}
                        title={color.name}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          localSettings.accentColor === color.id
                            ? "ring-2 ring-offset-2 ring-offset-card scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{
                          backgroundColor: color.color,
                          ringColor: color.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "editor" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-app mb-3">Default View Mode</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "edit", icon: <Edit3 className="w-5 h-5" />, label: "Edit" },
                      { id: "split", icon: <Columns className="w-5 h-5" />, label: "Split" },
                      { id: "preview", icon: <Eye className="w-5 h-5" />, label: "Preview" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => handleChange("defaultViewMode", mode.id as AppSettings["defaultViewMode"])}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          localSettings.defaultViewMode === mode.id
                            ? "border-primary bg-primary/10"
                            : "border-app hover:border-muted"
                        }`}
                      >
                        <div className={localSettings.defaultViewMode === mode.id ? "text-primary" : "text-muted"}>
                          {mode.icon}
                        </div>
                        <span className={`text-sm ${localSettings.defaultViewMode === mode.id ? "text-primary" : "text-app"}`}>
                          {mode.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Default view when opening markdown and page files
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-app mb-3">Font Size</h3>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="10"
                      max="24"
                      value={localSettings.fontSize}
                      onChange={(e) => handleChange("fontSize", parseInt(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-muted w-12 text-right font-mono">
                      {localSettings.fontSize}px
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-app mb-3">Tab Size</h3>
                  <div className="flex gap-2">
                    {[2, 4, 8].map((size) => (
                      <button
                        key={size}
                        onClick={() => handleChange("tabSize", size)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          localSettings.tabSize === size
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted hover:text-app"
                        }`}
                      >
                        {size} spaces
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Options</h3>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Type className="w-4 h-4 text-muted" />
                      <span className="text-sm text-app">Word Wrap</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.wordWrap}
                      onChange={(e) => handleChange("wordWrap", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Code2 className="w-4 h-4 text-muted" />
                      <span className="text-sm text-app">Line Numbers</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.lineNumbers}
                      onChange={(e) => handleChange("lineNumbers", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Eye className="w-4 h-4 text-muted" />
                      <span className="text-sm text-app">Minimap</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.minimap}
                      onChange={(e) => handleChange("minimap", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeSection === "files" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Folder Behavior</h3>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div>
                      <span className="text-sm text-app block">Expand Folders by Default</span>
                      <span className="text-xs text-muted">Automatically expand folders when loading</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.defaultFoldersOpen}
                      onChange={(e) => handleChange("defaultFoldersOpen", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>

                  {localSettings.defaultFoldersOpen && (
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-app">Expand Depth</span>
                        <span className="text-xs text-muted font-mono">
                          {localSettings.foldersOpenDepth} {localSettings.foldersOpenDepth === 1 ? "level" : "levels"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={localSettings.foldersOpenDepth}
                        onChange={(e) => handleChange("foldersOpenDepth", parseInt(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <p className="mt-1 text-xs text-muted">
                        How many levels deep to auto-expand
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">File Browser</h3>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div>
                      <span className="text-sm text-app block">Show Hidden Files</span>
                      <span className="text-xs text-muted">Display files starting with a dot</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.showHiddenFiles}
                      onChange={(e) => handleChange("showHiddenFiles", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div>
                      <span className="text-sm text-app block">Confirm Before Delete</span>
                      <span className="text-xs text-muted">Show confirmation dialog when deleting</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.confirmDelete}
                      onChange={(e) => handleChange("confirmDelete", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Auto Save</h3>

                  <label className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer">
                    <div>
                      <span className="text-sm text-app block">Enable Auto Save</span>
                      <span className="text-xs text-muted">Automatically save changes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={localSettings.autoSave}
                      onChange={(e) => handleChange("autoSave", e.target.checked)}
                      className="w-5 h-5 accent-primary rounded"
                    />
                  </label>

                  {localSettings.autoSave && (
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-app">Auto Save Delay</span>
                        <span className="text-xs text-muted font-mono">
                          {localSettings.autoSaveDelay / 1000}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="30000"
                        step="1000"
                        value={localSettings.autoSaveDelay}
                        onChange={(e) => handleChange("autoSaveDelay", parseInt(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === "startup" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Home Page</h3>
                  <p className="text-xs text-muted">
                    Set a view or file to open automatically when the vault loads
                  </p>

                  <div className="relative">
                    <button
                      onClick={() => setShowHomePageMenu(!showHomePageMenu)}
                      className="w-full p-3 bg-secondary rounded-lg flex items-center justify-between hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {localSettings.homePage === VIRTUAL_PATHS.INBOX ? (
                          <Inbox className="w-5 h-5 text-amber-500" />
                        ) : localSettings.homePage === VIRTUAL_PATHS.CALENDAR ? (
                          <Calendar className="w-5 h-5 text-rose-500" />
                        ) : localSettings.homePage === VIRTUAL_PATHS.TASKS_TODAY ? (
                          <CalendarDays className="w-5 h-5 text-orange-500" />
                        ) : localSettings.homePage === VIRTUAL_PATHS.TASKS_UPCOMING ? (
                          <CalendarClock className="w-5 h-5 text-blue-500" />
                        ) : localSettings.homePage === VIRTUAL_PATHS.TASKS_ALL ? (
                          <ListChecks className="w-5 h-5 text-green-500" />
                        ) : localSettings.homePage?.startsWith(VIRTUAL_PATHS.PROJECT_PREFIX) ? (
                          <FolderKanban className="w-5 h-5 text-violet-500" />
                        ) : localSettings.homePage ? (
                          <FileText className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Home className="w-5 h-5 text-muted" />
                        )}
                        <span className="text-sm text-app">
                          {localSettings.homePageName || "None (empty start)"}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted transition-transform ${showHomePageMenu ? "rotate-180" : ""}`} />
                    </button>

                    {showHomePageMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowHomePageMenu(false)} />
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-app rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                          {/* None option */}
                          <button
                            onClick={() => {
                              handleChange("homePage", null);
                              handleChange("homePageName", null);
                              setShowHomePageMenu(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                              !localSettings.homePage ? "bg-accent" : ""
                            }`}
                          >
                            <Home className="w-4 h-4 text-muted" />
                            <span className="text-sm">None (empty start)</span>
                          </button>

                          {/* Virtual Views */}
                          <div className="px-3 py-1.5 text-xs text-muted font-medium border-t border-app mt-1">
                            Views
                          </div>
                          <button
                            onClick={() => {
                              handleChange("homePage", VIRTUAL_PATHS.INBOX);
                              handleChange("homePageName", "Inbox");
                              setShowHomePageMenu(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                              localSettings.homePage === VIRTUAL_PATHS.INBOX ? "bg-accent" : ""
                            }`}
                          >
                            <Inbox className="w-4 h-4 text-amber-500" />
                            <span className="text-sm">Inbox</span>
                          </button>
                          <button
                            onClick={() => {
                              handleChange("homePage", VIRTUAL_PATHS.CALENDAR);
                              handleChange("homePageName", "Calendar");
                              setShowHomePageMenu(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                              localSettings.homePage === VIRTUAL_PATHS.CALENDAR ? "bg-accent" : ""
                            }`}
                          >
                            <Calendar className="w-4 h-4 text-rose-500" />
                            <span className="text-sm">Calendar</span>
                          </button>
                          <button
                            onClick={() => {
                              handleChange("homePage", VIRTUAL_PATHS.TASKS_TODAY);
                              handleChange("homePageName", "Today");
                              setShowHomePageMenu(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                              localSettings.homePage === VIRTUAL_PATHS.TASKS_TODAY ? "bg-accent" : ""
                            }`}
                          >
                            <CalendarDays className="w-4 h-4 text-orange-500" />
                            <span className="text-sm">Tasks - Today</span>
                          </button>
                          <button
                            onClick={() => {
                              handleChange("homePage", VIRTUAL_PATHS.TASKS_UPCOMING);
                              handleChange("homePageName", "Upcoming");
                              setShowHomePageMenu(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                              localSettings.homePage === VIRTUAL_PATHS.TASKS_UPCOMING ? "bg-accent" : ""
                            }`}
                          >
                            <CalendarClock className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">Tasks - Upcoming</span>
                          </button>
                          <button
                            onClick={() => {
                              handleChange("homePage", VIRTUAL_PATHS.TASKS_ALL);
                              handleChange("homePageName", "All Tasks");
                              setShowHomePageMenu(false);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                              localSettings.homePage === VIRTUAL_PATHS.TASKS_ALL ? "bg-accent" : ""
                            }`}
                          >
                            <ListChecks className="w-4 h-4 text-green-500" />
                            <span className="text-sm">Tasks - All</span>
                          </button>

                          {/* Projects */}
                          {projects.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs text-muted font-medium border-t border-app mt-1">
                                Projects
                              </div>
                              {projects.map((project) => {
                                const projectVirtualPath = `${VIRTUAL_PATHS.PROJECT_PREFIX}${project.path}`;
                                return (
                                  <button
                                    key={project.id}
                                    onClick={() => {
                                      handleChange("homePage", projectVirtualPath);
                                      handleChange("homePageName", project.name);
                                      setShowHomePageMenu(false);
                                    }}
                                    className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-accent transition-colors ${
                                      localSettings.homePage === projectVirtualPath ? "bg-accent" : ""
                                    }`}
                                  >
                                    <div
                                      className="w-4 h-4 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: project.color || "#8b5cf6" }}
                                    />
                                    <span className="text-sm truncate">{project.name}</span>
                                  </button>
                                );
                              })}
                            </>
                          )}

                          {/* Custom file note */}
                          <div className="px-3 py-2 text-xs text-muted border-t border-app mt-1">
                            To set a file as home page, right-click it in the file tree
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Startup Behavior</h3>
                  <p className="text-xs text-muted">
                    What to show when opening the vault
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "home", icon: <Home className="w-5 h-5" />, label: "Home Page", desc: "Open home page" },
                      { id: "restore", icon: <RotateCw className="w-5 h-5" />, label: "Restore", desc: "Restore last session" },
                      { id: "empty", icon: <FileText className="w-5 h-5" />, label: "Empty", desc: "Start with no files" },
                    ].map((behavior) => (
                      <button
                        key={behavior.id}
                        onClick={() => handleChange("startupBehavior", behavior.id as AppSettings["startupBehavior"])}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          localSettings.startupBehavior === behavior.id
                            ? "border-primary bg-primary/10"
                            : "border-app hover:border-muted"
                        }`}
                      >
                        <div className={localSettings.startupBehavior === behavior.id ? "text-primary" : "text-muted"}>
                          {behavior.icon}
                        </div>
                        <span className={`text-sm ${localSettings.startupBehavior === behavior.id ? "text-primary" : "text-app"}`}>
                          {behavior.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted">
                    {localSettings.startupBehavior === "home" && "Opens your home page file on startup"}
                    {localSettings.startupBehavior === "restore" && "Restores all tabs from your last session"}
                    {localSettings.startupBehavior === "empty" && "Starts with a clean workspace"}
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Terminal</h3>
                  <p className="text-xs text-muted">
                    Terminal panel position
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "bottom", icon: <TerminalSquare className="w-5 h-5" />, label: "Bottom" },
                      { id: "right", icon: <TerminalSquare className="w-5 h-5" />, label: "Right" },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => handleChange("terminalPosition", pos.id as AppSettings["terminalPosition"])}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          localSettings.terminalPosition === pos.id
                            ? "border-primary bg-primary/10"
                            : "border-app hover:border-muted"
                        }`}
                      >
                        <div className={localSettings.terminalPosition === pos.id ? "text-primary" : "text-muted"}>
                          {pos.icon}
                        </div>
                        <span className={`text-sm ${localSettings.terminalPosition === pos.id ? "text-primary" : "text-app"}`}>
                          {pos.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "vault" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-app">Vault Location</h3>
                  <p className="text-xs text-muted">
                    The folder where your files are stored
                  </p>

                  <div className="p-4 bg-secondary rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted mb-1">Current Location</p>
                        <p className="text-sm text-app font-mono truncate" title={vaultPath || ""}>
                          {vaultPath || "No vault selected"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-app mb-2">
                      Change Vault Path
                    </label>
                    <input
                      type="text"
                      value={newVaultPath}
                      onChange={(e) => setNewVaultPath(e.target.value)}
                      placeholder="D:\Path\To\Your\Vault"
                      className="w-full px-4 py-2.5 bg-app border border-input rounded-lg text-app font-mono text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Enter the full path to your notes folder
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (newVaultPath.trim() && newVaultPath !== vaultPath) {
                        onVaultPathChange(newVaultPath.trim());
                      }
                    }}
                    disabled={!newVaultPath.trim() || newVaultPath === vaultPath}
                    className="w-full py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Change Vault Location
                  </button>
                </div>

                <div className="p-4 bg-chart-2/10 border border-chart-2/30 rounded-lg">
                  <p className="text-sm text-chart-2">
                    <strong>Note:</strong> Changing the vault location will reload all files from the new path. Make sure the folder exists.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-app bg-muted/30">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-app transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to manage settings with Tauri backend persistence
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from Tauri backend on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const stored = await invoke<Record<string, unknown>>("get_settings");
        if (stored && Object.keys(stored).length > 0) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored } as AppSettings);
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_settings", { settings: newSettings });
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  return { settings, updateSettings, isLoaded };
}

export default Settings;
