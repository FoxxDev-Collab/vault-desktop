import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import {
  X,
  Maximize2,
  Minimize2,
  TerminalSquare,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export type TerminalPosition = "bottom" | "right";
export type ShellType = "powershell" | "pwsh" | "cmd" | "bash" | "wsl" | "default";

const SHELL_OPTIONS: { id: ShellType; label: string }[] = [
  { id: "powershell", label: "PowerShell" },
  { id: "pwsh", label: "PowerShell Core" },
  { id: "cmd", label: "Command Prompt" },
  { id: "bash", label: "Bash" },
  { id: "wsl", label: "WSL" },
];

interface TerminalInstance {
  id: string;
  name: string;
  terminal: XTerm;
  fitAddon: FitAddon;
}

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position: TerminalPosition;
  onPositionChange: (position: TerminalPosition) => void;
  size: number;
  onSizeChange: (size: number) => void;
  isDark: boolean;
  workingDirectory?: string;
  onSpawnShell: (id: string, shellType?: string) => Promise<void>;
  onWriteShell: (id: string, data: string) => Promise<void>;
  onResizeShell: (id: string, rows: number, cols: number) => Promise<void>;
  onKillShell: (id: string) => Promise<void>;
  shellOutput?: { id: string; data: string } | null;
}

export function TerminalPanel({
  isOpen,
  onClose,
  position,
  onPositionChange,
  size,
  onSizeChange,
  isDark,
  workingDirectory,
  onSpawnShell,
  onWriteShell,
  onResizeShell,
  onKillShell,
  shellOutput,
}: TerminalPanelProps) {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showShellMenu, setShowShellMenu] = useState(false);
  const [shellMenuPos, setShellMenuPos] = useState({ top: 0, left: 0 });
  const shellMenuButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Get the active terminal
  const activeTerminal = terminals.find((t) => t.id === activeTerminalId);

  // Theme colors
  const theme = isDark
    ? {
        background: "#1a1d24",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        cursorAccent: "#1a1d24",
        selectionBackground: "#3b82f680",
        black: "#1a1d24",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#71717a",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      }
    : {
        background: "#ffffff",
        foreground: "#18181b",
        cursor: "#18181b",
        cursorAccent: "#ffffff",
        selectionBackground: "#3b82f640",
        black: "#18181b",
        red: "#dc2626",
        green: "#16a34a",
        yellow: "#ca8a04",
        blue: "#2563eb",
        magenta: "#9333ea",
        cyan: "#0891b2",
        white: "#f4f4f5",
        brightBlack: "#a1a1aa",
        brightRed: "#ef4444",
        brightGreen: "#22c55e",
        brightYellow: "#eab308",
        brightBlue: "#3b82f6",
        brightMagenta: "#a855f7",
        brightCyan: "#06b6d4",
        brightWhite: "#fafafa",
      };

  // Create a new terminal
  const createTerminal = useCallback(async (shellType?: ShellType) => {
    const id = `term-${Date.now()}`;
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
      theme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Get shell label for tab name
    const shellLabel = shellType
      ? SHELL_OPTIONS.find(s => s.id === shellType)?.label || shellType
      : "Terminal";

    const instance: TerminalInstance = {
      id,
      name: `${shellLabel} ${terminals.length + 1}`,
      terminal,
      fitAddon,
    };

    setTerminals((prev) => [...prev, instance]);
    setActiveTerminalId(id);

    // Spawn shell after terminal is mounted
    setTimeout(async () => {
      try {
        await onSpawnShell(id, shellType);
      } catch (e) {
        console.error("Failed to spawn shell:", e);
        terminal.writeln(`\r\n\x1b[31mFailed to spawn shell: ${e}\x1b[0m\r\n`);
      }
    }, 100);

    return instance;
  }, [terminals.length, theme, onSpawnShell]);

  // Close a terminal
  const closeTerminal = useCallback(
    async (id: string) => {
      try {
        await onKillShell(id);
      } catch (e) {
        console.error("Failed to kill shell:", e);
      }

      setTerminals((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        const terminal = prev.find((t) => t.id === id);
        if (terminal) {
          terminal.terminal.dispose();
        }
        return filtered;
      });

      // Switch to another terminal if this was active
      if (activeTerminalId === id) {
        setTerminals((prev) => {
          if (prev.length > 0) {
            setActiveTerminalId(prev[prev.length - 1].id);
          } else {
            setActiveTerminalId(null);
          }
          return prev;
        });
      }
    },
    [activeTerminalId, onKillShell]
  );

  // Mount terminal to DOM when active terminal changes
  useEffect(() => {
    if (!activeTerminal || !terminalContainerRef.current) return;

    const container = terminalContainerRef.current;

    // Clear container
    container.innerHTML = "";

    // Open terminal in container
    activeTerminal.terminal.open(container);

    // Fit to container
    setTimeout(() => {
      activeTerminal.fitAddon.fit();
    }, 0);

    // Handle input
    const disposable = activeTerminal.terminal.onData((data) => {
      onWriteShell(activeTerminal.id, data);
    });

    return () => {
      disposable.dispose();
    };
  }, [activeTerminal, onWriteShell]);

  // Handle shell output
  useEffect(() => {
    if (!shellOutput) return;

    const terminal = terminals.find((t) => t.id === shellOutput.id);
    if (terminal) {
      terminal.terminal.write(shellOutput.data);
    }
  }, [shellOutput, terminals]);

  // Update theme when isDark changes
  useEffect(() => {
    terminals.forEach((t) => {
      t.terminal.options.theme = theme;
    });
  }, [isDark, terminals, theme]);

  // Resize observer for fit - sync terminal size with PTY
  useEffect(() => {
    if (!terminalContainerRef.current || !activeTerminal) return;

    const syncSize = () => {
      setTimeout(() => {
        activeTerminal.fitAddon.fit();
        // Sync the new size with the PTY backend
        const { rows, cols } = activeTerminal.terminal;
        if (rows && cols) {
          onResizeShell(activeTerminal.id, rows, cols).catch(console.error);
        }
      }, 0);
    };

    resizeObserverRef.current = new ResizeObserver(syncSize);
    resizeObserverRef.current.observe(terminalContainerRef.current);

    // Initial sync
    syncSize();

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [activeTerminal, onResizeShell]);

  // Create first terminal when panel opens (default to PowerShell on Windows)
  useEffect(() => {
    if (isOpen && terminals.length === 0) {
      createTerminal("powershell");
    }
  }, [isOpen, terminals.length, createTerminal]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (position === "bottom") {
        const windowHeight = window.innerHeight;
        const newSize = windowHeight - e.clientY;
        onSizeChange(Math.max(150, Math.min(windowHeight - 200, newSize)));
      } else {
        const windowWidth = window.innerWidth;
        const newSize = windowWidth - e.clientX;
        onSizeChange(Math.max(200, Math.min(windowWidth - 400, newSize)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = position === "bottom" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, position, onSizeChange]);

  if (!isOpen) return null;

  const panelStyle =
    position === "bottom"
      ? {
          height: isMaximized ? "calc(100vh - 100px)" : size,
          width: "100%",
        }
      : {
          width: isMaximized ? "calc(100vw - 300px)" : size,
          height: "100%",
        };

  return (
    <div
      ref={containerRef}
      className={`flex ${position === "bottom" ? "flex-col border-t" : "flex-row border-l"} border-app bg-card`}
      style={panelStyle}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className={`${
          position === "bottom"
            ? "h-1 w-full cursor-row-resize hover:bg-primary"
            : "w-1 h-full cursor-col-resize hover:bg-primary"
        } bg-transparent transition-colors flex-shrink-0 ${isResizing ? "bg-primary" : ""}`}
      />

      {/* Main content wrapper - always flex-col so header is on top */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-1 bg-secondary border-b border-app flex-shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto">
            {/* Terminal tabs */}
            {terminals.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTerminalId(t.id)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeTerminalId === t.id
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app hover:bg-accent/50"
                }`}
              >
                <TerminalSquare className="w-3 h-3" />
                <span>{t.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(t.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}

            {/* New terminal button with shell dropdown */}
            <div className="relative">
              <button
                ref={shellMenuButtonRef}
                onClick={() => {
                  if (!showShellMenu && shellMenuButtonRef.current) {
                    const rect = shellMenuButtonRef.current.getBoundingClientRect();
                    setShellMenuPos({ top: rect.bottom + 4, left: rect.left });
                  }
                  setShowShellMenu(!showShellMenu);
                }}
                className="flex items-center gap-0.5 p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
                title="New Terminal"
              >
                <Plus className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {showShellMenu && (
              <>
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setShowShellMenu(false)}
                />
                <div
                  className="fixed bg-card border border-app rounded-lg shadow-xl z-[9999] min-w-[160px]"
                  style={{ top: shellMenuPos.top, left: shellMenuPos.left }}
                >
                  {SHELL_OPTIONS.map((shell) => (
                    <button
                      key={shell.id}
                      onClick={() => {
                        createTerminal(shell.id);
                        setShowShellMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      {shell.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Position toggle */}
            <button
              onClick={() => onPositionChange(position === "bottom" ? "right" : "bottom")}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title={position === "bottom" ? "Move to right" : "Move to bottom"}
            >
              {position === "bottom" ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Maximize/minimize */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Close Terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal content */}
        <div
          ref={terminalContainerRef}
          className="flex-1 overflow-hidden"
          style={{ backgroundColor: theme.background }}
        />

        {/* No terminals message */}
        {terminals.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted gap-3">
            <p className="text-sm">Select a shell to start:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SHELL_OPTIONS.map((shell) => (
                <button
                  key={shell.id}
                  onClick={() => createTerminal(shell.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent rounded-lg transition-colors"
                >
                  <TerminalSquare className="w-4 h-4" />
                  {shell.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TerminalPanel;
