import { useState, useEffect, useCallback, useRef } from "react";
import {
  Rocket,
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Settings,
  Terminal,
  Save,
  FolderOpen,
  FileCode,
  Globe,
  Trash2,
  Copy,
  Check,
  Code,
  Folder,
  Package,
  ChevronDown,
  Cpu,
  HardDrive,
  AlertCircle,
  Shield,
  AlertTriangle,
  ArrowUpCircle,
  XCircle,
  FileJson,
  Clock,
  History,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  dbGetDevProjects,
  dbUpdateDevProject,
  spawnShell,
  writeShell,
  killShell,
  dbSaveVulnerabilityScan,
  dbGetLatestVulnerabilityScan,
  dbGetVulnerabilityScanHistory,
  type DevProject,
  type VulnerabilityScan,
} from "../hooks/useApi";
import { useToast } from "./Toast";
import { triggerRefresh } from "../hooks/useRefresh";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// Strip ANSI escape codes for cleaner console output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\[[\d;]*[A-Za-z]/g, '') // Additional escape sequences
    .replace(/\]\d;[^\x07]*\x07/g, '') // OSC sequences (window titles)
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, ''); // Control characters except newline/CR
}

// Server state passed from parent (VaultApp via Editor)
interface ServerState {
  terminalId: string;
  port: number;
  status: "starting" | "running" | "stopped" | "error";
}

interface DevProjectViewProps {
  projectId: number;
  onClose: () => void;
  onUpdated?: () => void;
  // Optional: if provided, use parent's server state
  serverState?: ServerState | null;
  onStartServer?: () => void;
  onStopServer?: () => void;
}

type TabType = "console" | "preview" | "security" | "settings";

export function DevProjectView({
  projectId,
  onClose,
  onUpdated,
  serverState: parentServerState,
  onStartServer: parentStartServer,
  onStopServer: parentStopServer,
}: DevProjectViewProps) {
  const [project, setProject] = useState<DevProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("console");
  // Local state (used when no parent state is provided)
  const [localServerStatus, setLocalServerStatus] = useState<"stopped" | "starting" | "running" | "error">("stopped");
  const [localTerminalId, setLocalTerminalId] = useState<string | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  // Use parent state if available, otherwise use local state
  const serverStatus = parentServerState?.status ?? localServerStatus;
  const terminalId = parentServerState?.terminalId ?? localTerminalId;
  const [editedName, setEditedName] = useState("");
  const [editedCommand, setEditedCommand] = useState("");
  const [editedPort, setEditedPort] = useState(3000);
  const [editedAutoStart, setEditedAutoStart] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [showScriptsMenu, setShowScriptsMenu] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [portInUse, setPortInUse] = useState(false);
  const [processStats, setProcessStats] = useState<{ cpu: number; memory: number } | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [healthShellId, setHealthShellId] = useState<string | null>(null);
  const [outdatedCount, setOutdatedCount] = useState<number | null>(null);
  const [vulnCount, setVulnCount] = useState<number | null>(null);
  const [sbomGenerated, setSbomGenerated] = useState(false);
  const [sbomData, setSbomData] = useState<{ components: any[]; metadata?: any } | null>(null);
  const [vulnData, setVulnData] = useState<{ matches: any[] } | null>(null);
  const [scanHistory, setScanHistory] = useState<VulnerabilityScan[]>([]);
  const [showHealthMenu, setShowHealthMenu] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const scriptsMenuRef = useRef<HTMLDivElement>(null);
  const healthMenuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Track previous terminal IDs for cleanup
  const prevLocalTerminalIdRef = useRef<string | null>(null);
  const prevHealthShellIdRef = useRef<string | null>(null);

  // Reset all project-specific state when projectId changes
  useEffect(() => {
    // Kill any running shells from previous project (only local ones, not parent-managed)
    if (prevLocalTerminalIdRef.current) {
      killShell(prevLocalTerminalIdRef.current).catch(() => {});
    }
    if (prevHealthShellIdRef.current) {
      killShell(prevHealthShellIdRef.current).catch(() => {});
    }

    // Clear console and terminal state
    setConsoleOutput([]);
    setLocalServerStatus("stopped");
    setLocalTerminalId(null);

    // Clear security/health data
    setVulnData(null);
    setSbomData(null);
    setVulnCount(null);
    setOutdatedCount(null);
    setSbomGenerated(false);
    setScanHistory([]);

    // Clear scripts (will be reloaded for new project)
    setScripts({});

    // Reset UI state
    setActiveTab("console");
    setShowScriptsMenu(false);
    setShowHealthMenu(false);
    setIsInstalling(false);
    setIsCheckingDeps(false);
    setHealthShellId(null);
    setPortInUse(false);
    setProcessStats(null);
    setCopied(false);
    setHasChanges(false);

    // Reset refs
    prevLocalTerminalIdRef.current = null;
    prevHealthShellIdRef.current = null;
  }, [projectId]);

  // Keep refs updated for cleanup on project switch
  useEffect(() => {
    prevLocalTerminalIdRef.current = localTerminalId;
  }, [localTerminalId]);

  useEffect(() => {
    prevHealthShellIdRef.current = healthShellId;
  }, [healthShellId]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scriptsMenuRef.current && !scriptsMenuRef.current.contains(e.target as Node)) {
        setShowScriptsMenu(false);
      }
      if (healthMenuRef.current && !healthMenuRef.current.contains(e.target as Node)) {
        setShowHealthMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load package.json scripts
  useEffect(() => {
    if (!project?.path) return;
    const loadScripts = async () => {
      try {
        const fileResult = await invoke<{ content?: string; binary: boolean }>("read_file", { path: `${project.path}\\package.json` });
        if (!fileResult.content) return;
        const pkg = JSON.parse(fileResult.content);
        if (pkg.scripts) {
          setScripts(pkg.scripts);
        }
      } catch {
        // No package.json or invalid
      }
    };
    loadScripts();
  }, [project?.path]);

  // Load existing vulnerability scan and history from database on mount
  useEffect(() => {
    if (!projectId) return;
    const loadExistingScans = async () => {
      try {
        // Load latest scan for current display
        const scan = await dbGetLatestVulnerabilityScan(projectId);
        if (scan) {
          setVulnCount(scan.totalCount);
          // Parse and set scan data if available
          if (scan.scanData) {
            try {
              const data = JSON.parse(scan.scanData);
              setVulnData(data);
            } catch {
              // Invalid JSON, ignore
            }
          }
        }

        // Load scan history (last 20 scans)
        const history = await dbGetVulnerabilityScanHistory(projectId, 20);
        setScanHistory(history);
      } catch (e) {
        console.error("Failed to load vulnerability scan:", e);
      }
    };
    loadExistingScans();
  }, [projectId]);

  // Check port availability before starting
  const checkPort = useCallback(async (port: number): Promise<boolean> => {
    try {
      const inUse = await invoke<boolean>("check_port_in_use", { port });
      setPortInUse(inUse);
      return !inUse;
    } catch {
      // If command doesn't exist, assume port is available
      return true;
    }
  }, []);

  // Poll process stats when server is running
  useEffect(() => {
    if (serverStatus !== "running" || !terminalId) {
      setProcessStats(null);
      return;
    }

    let cancelled = false;

    const pollStats = async () => {
      try {
        // First get the PID for the terminal
        const pid = await invoke<number | null>("get_shell_pid", { id: terminalId });
        if (pid && !cancelled) {
          const stats = await invoke<{ cpu: number; memory: number }>("get_process_stats", { pid });
          if (!cancelled) {
            setProcessStats(stats);
          }
        }
      } catch {
        // Process may have exited or command not available
      }
    };

    // Initial delay to let process start
    const initialDelay = setTimeout(pollStats, 2000);
    const interval = setInterval(pollStats, 5000); // Poll every 5 seconds

    return () => {
      cancelled = true;
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [serverStatus, terminalId]);

  // Open in VS Code
  const openInVSCode = useCallback(async () => {
    if (!project?.path) return;
    try {
      await invoke("run_command", { command: "code", args: [project.path] });
      toast.success("Opening in VS Code...");
    } catch (e) {
      toast.error("Failed to open VS Code. Is it installed?");
    }
  }, [project?.path, toast]);

  // Open in File Explorer
  const openInExplorer = useCallback(async () => {
    if (!project?.path) return;
    try {
      await invoke("run_command", { command: "explorer", args: [project.path] });
    } catch (e) {
      toast.error("Failed to open folder");
    }
  }, [project?.path, toast]);

  // Install dependencies
  const installDependencies = useCallback(async () => {
    if (!project?.path || isInstalling) return;

    setIsInstalling(true);
    setConsoleOutput(prev => [...prev, "\n--- Installing dependencies ---\n", "$ bun install\n"]);

    const id = `install-${Date.now()}`;

    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        if (cleanData.trim()) {
          setConsoleOutput(prev => [...prev, cleanData]);
        }
        if (event.payload.closed) {
          setIsInstalling(false);
          setConsoleOutput(prev => [...prev, "\n--- Installation complete ---\n"]);
          unlisten();
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");
      await writeShell(id, "bun install\r");

      // Auto-close after 60 seconds if not closed
      setTimeout(async () => {
        try {
          await killShell(id);
        } catch {}
        setIsInstalling(false);
      }, 60000);
    } catch (e) {
      toast.error("Failed to install dependencies");
      setIsInstalling(false);
      unlisten();
    }
  }, [project?.path, isInstalling, toast]);

  // Run a script from package.json
  const runScript = useCallback(async (scriptName: string) => {
    if (!project?.path) return;
    setShowScriptsMenu(false);

    setConsoleOutput(prev => [...prev, `\n--- Running script: ${scriptName} ---\n`, `$ bun run ${scriptName}\n`]);

    const id = `script-${Date.now()}`;

    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        if (cleanData.trim()) {
          setConsoleOutput(prev => [...prev, cleanData]);
        }
        if (event.payload.closed) {
          setConsoleOutput(prev => [...prev, `\n--- Script "${scriptName}" finished ---\n`]);
          unlisten();
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");
      await writeShell(id, `bun run ${scriptName}\r`);
    } catch (e) {
      toast.error(`Failed to run script: ${scriptName}`);
      unlisten();
    }
  }, [project?.path, toast]);

  // Check for outdated dependencies
  const checkOutdated = useCallback(async () => {
    if (!project?.path || isCheckingDeps) return;
    setShowHealthMenu(false);
    setIsCheckingDeps(true);
    setConsoleOutput(prev => [...prev, "\n--- Checking for outdated packages ---\n", "$ bun outdated\n"]);

    const id = `outdated-${Date.now()}`;
    setHealthShellId(id);
    let output = "";
    let checkComplete = false;

    const finishCheck = (outdated: number) => {
      if (checkComplete) return;
      checkComplete = true;
      setOutdatedCount(outdated);
      setIsCheckingDeps(false);
      setHealthShellId(null);
      setConsoleOutput(prev => [...prev, `\n--- Found ${outdated} outdated package(s) ---\n`]);
    };

    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        output += cleanData;
        if (cleanData.trim()) {
          setConsoleOutput(prev => [...prev, cleanData]);
        }

        // Detect completion
        const isComplete =
          output.includes("--- CHECK DONE ---") ||
          output.includes("All packages are up to date") ||
          event.payload.closed;

        if (isComplete && !checkComplete) {
          // Parse output to count outdated packages
          const lines = output.split("\n").filter(l => l.trim() && !l.includes("bun outdated") && !l.includes("Package"));
          const outdated = lines.filter(l => l.includes("│") || l.match(/\d+\.\d+/)).length;
          finishCheck(outdated > 0 ? outdated : 0);
          unlisten();
          killShell(id).catch(() => {});
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");
      await writeShell(id, "bun outdated & echo --- CHECK DONE --- & exit\r");

      setTimeout(async () => {
        if (!checkComplete) {
          try { await killShell(id); } catch {}
          finishCheck(0);
          setConsoleOutput(prev => [...prev, "\n--- Check timed out ---\n"]);
        }
      }, 30000);
    } catch (e) {
      toast.error("Failed to check outdated packages");
      setIsCheckingDeps(false);
      setHealthShellId(null);
      unlisten();
    }
  }, [project?.path, isCheckingDeps, toast]);

  // Cancel any running health check
  const cancelHealthCheck = useCallback(async () => {
    if (healthShellId) {
      try {
        await killShell(healthShellId);
      } catch {}
      setHealthShellId(null);
    }
    setIsCheckingDeps(false);
    setConsoleOutput(prev => [...prev, "\n--- Scan cancelled ---\n"]);
  }, [healthShellId]);

  // Check for vulnerabilities using Grype - simple approach:
  // 1. Run grype with JSON output (includes both vulns AND artifact/component info)
  // 2. Wait for completion
  // 3. Read and parse the output file
  const checkVulnerabilities = useCallback(async () => {
    if (!project?.path || isCheckingDeps) return;
    setShowHealthMenu(false);
    setIsCheckingDeps(true);
    setSbomGenerated(false);
    setConsoleOutput(prev => [...prev, "\n--- Security Scan ---\n"]);

    const id = `audit-${Date.now()}`;
    setHealthShellId(id);
    let output = "";
    let scanComplete = false;

    const finishScan = async () => {
      if (scanComplete) return;
      scanComplete = true;

      // Wait for file to be fully written
      await new Promise(r => setTimeout(r, 500));

      // Read the scan results JSON
      try {
        const scanPath = `${project.path}\\.sbom\\scan.json`;
        const fileResult = await invoke<{ content?: string; binary: boolean; data?: string; path: string }>("read_file", { path: scanPath });
        if (!fileResult.content) {
          throw new Error("Empty scan results");
        }
        const scanData = JSON.parse(fileResult.content);

        // Set vulnerability data
        setVulnData(scanData);
        const matchCount = scanData.matches?.length || 0;
        setVulnCount(matchCount);

        // Build component list from artifacts in the scan
        // Grype JSON includes artifact info for each match, plus source describes what was scanned
        const componentSet = new Map<string, any>();
        scanData.matches?.forEach((m: any) => {
          const artifact = m.artifact;
          if (artifact?.name) {
            const key = `${artifact.name}@${artifact.version}`;
            if (!componentSet.has(key)) {
              componentSet.set(key, artifact);
            }
          }
        });

        // Create a simplified "sbom-like" structure for the UI
        const components = Array.from(componentSet.values());
        setSbomData({ components, metadata: scanData.source });
        setSbomGenerated(true);

        // Count by severity
        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, negligible: 0 };
        scanData.matches?.forEach((m: any) => {
          const sev = m.vulnerability?.severity?.toLowerCase() || 'unknown';
          if (sev === 'critical') bySeverity.critical++;
          else if (sev === 'high') bySeverity.high++;
          else if (sev === 'medium') bySeverity.medium++;
          else if (sev === 'low') bySeverity.low++;
          else bySeverity.negligible++;
        });

        // Save to database and refresh history
        try {
          await dbSaveVulnerabilityScan(
            projectId,
            matchCount,
            bySeverity.critical,
            bySeverity.high,
            bySeverity.medium,
            bySeverity.low,
            bySeverity.negligible,
            fileResult.content
          );
          // Refresh scan history
          const history = await dbGetVulnerabilityScanHistory(projectId, 20);
          setScanHistory(history);
        } catch (dbErr) {
          console.error("Failed to save scan to database:", dbErr);
        }

        if (matchCount === 0) {
          setConsoleOutput(prev => [...prev, "\n✓ No vulnerabilities found\n"]);
        } else {
          setConsoleOutput(prev => [...prev,
            `\n⚠ Found ${matchCount} vulnerabilities:\n`,
            `   Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}\n`
          ]);
        }
      } catch (e) {
        console.error("Failed to read scan results:", e);
        setVulnData(null);
        setSbomData(null);
        setConsoleOutput(prev => [...prev, `\nFailed to parse scan results: ${e}\n`]);
      }

      setConsoleOutput(prev => [...prev, "--- Scan complete ---\n"]);
      setIsCheckingDeps(false);
      setHealthShellId(null);
    };

    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        output += cleanData;

        if (cleanData.trim()) {
          setConsoleOutput(prev => [...prev, cleanData]);
        }

        // Detect scan completion - we echo GRYPE_SCAN_COMPLETE after grype finishes
        const isComplete =
          output.includes("GRYPE_SCAN_COMPLETE") ||
          event.payload.closed;

        if (isComplete && !scanComplete) {
          unlisten();
          killShell(id).catch(() => {});
          finishScan();
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");

      // Create output folder and run single grype command (exclude node_modules for speed)
      // Use shell redirection: stdout (JSON) goes to file, stderr (progress) shows in console
      // Echo GRYPE_SCAN_COMPLETE at end so we can detect completion
      await writeShell(id, `mkdir .sbom 2>nul && .tools\\grype.exe dir:. -o json --exclude "**/node_modules/**" --exclude "**/.git/**" >.sbom\\scan.json && echo GRYPE_SCAN_COMPLETE\r`);

      // Timeout fallback
      setTimeout(async () => {
        if (!scanComplete) {
          try { await killShell(id); } catch {}
          await finishScan();
          setConsoleOutput(prev => [...prev, "\n--- Scan timed out ---\n"]);
        }
      }, 90000);
    } catch (e) {
      toast.error("Failed to run security scan");
      setIsCheckingDeps(false);
      setHealthShellId(null);
      unlisten();
    }
  }, [project?.path, isCheckingDeps, toast]);

  // Update all dependencies
  const updateDependencies = useCallback(async () => {
    if (!project?.path || isCheckingDeps) return;
    setShowHealthMenu(false);
    setIsCheckingDeps(true);
    setConsoleOutput(prev => [...prev, "\n--- Updating dependencies ---\n", "$ bun update\n"]);

    const id = `update-${Date.now()}`;
    setHealthShellId(id);
    let updateComplete = false;

    const finishUpdate = () => {
      if (updateComplete) return;
      updateComplete = true;
      setConsoleOutput(prev => [...prev, "\n--- Update complete ---\n"]);
      setOutdatedCount(0);
      setIsCheckingDeps(false);
      setHealthShellId(null);
    };

    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        if (cleanData.trim()) {
          setConsoleOutput(prev => [...prev, cleanData]);
        }

        const isComplete =
          cleanData.includes("--- UPDATE DONE ---") ||
          event.payload.closed;

        if (isComplete && !updateComplete) {
          finishUpdate();
          unlisten();
          killShell(id).catch(() => {});
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");
      await writeShell(id, "bun update & echo --- UPDATE DONE --- & exit\r");

      setTimeout(async () => {
        if (!updateComplete) {
          try { await killShell(id); } catch {}
          finishUpdate();
        }
      }, 120000);
    } catch (e) {
      toast.error("Failed to update dependencies");
      setIsCheckingDeps(false);
      setHealthShellId(null);
      unlisten();
    }
  }, [project?.path, isCheckingDeps, toast]);

  // Copy console output to clipboard
  const copyConsoleOutput = useCallback(async () => {
    const text = consoleOutput.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error("Failed to copy to clipboard");
    }
  }, [consoleOutput, toast]);

  // Load project from database
  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const projects = await dbGetDevProjects();
      const found = projects.find(p => p.id === projectId);
      if (found) {
        setProject(found);
        setEditedName(found.name);
        setEditedCommand(found.command);
        setEditedPort(found.port);
        setEditedAutoStart(found.autoStart);
      }
    } catch (e) {
      console.error("Failed to load dev project:", e);
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Track changes
  useEffect(() => {
    if (!project) return;
    const changed =
      editedName !== project.name ||
      editedCommand !== project.command ||
      editedPort !== project.port ||
      editedAutoStart !== project.autoStart;
    setHasChanges(changed);
  }, [project, editedName, editedCommand, editedPort, editedAutoStart]);

  // Listen for terminal output (works with both parent and local terminalId)
  useEffect(() => {
    if (!terminalId) return;

    const unlisten = listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === terminalId) {
        const cleanData = stripAnsi(event.payload.data);
        if (cleanData.trim()) {
          setConsoleOutput(prev => {
            const lines = [...prev, cleanData];
            // Keep last 1000 lines
            return lines.slice(-1000);
          });
        }

        // Auto-scroll console
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }

        // Detect server ready (only update local state - parent manages its own)
        if (!parentServerState) {
          const data = cleanData.toLowerCase();
          if (data.includes("ready") || data.includes("listening") || data.includes("started") || data.includes("localhost:")) {
            setLocalServerStatus("running");
          }
        }
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [terminalId, parentServerState]);

  // Start server - use parent callback if available
  const startServer = useCallback(async () => {
    // If parent provides start callback, use it
    if (parentStartServer) {
      parentStartServer();
      return;
    }

    // Otherwise use local state management
    if (!project || serverStatus !== "stopped") return;

    const id = `devproject-${Date.now()}`;
    setConsoleOutput([`$ ${project.command}\n`]);
    setLocalServerStatus("starting");

    // Set up listener BEFORE spawning shell to avoid race condition
    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        if (cleanData.trim()) {
          setConsoleOutput(prev => {
            const lines = [...prev, cleanData];
            return lines.slice(-1000);
          });
        }

        // Auto-scroll console
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }

        // Detect server ready
        const data = cleanData.toLowerCase();
        if (data.includes("ready") || data.includes("listening") || data.includes("started") || data.includes("localhost:")) {
          setLocalServerStatus("running");
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");
      await writeShell(id, `${project.command}\r`);
      setLocalTerminalId(id);

      // Fallback: assume running after 5 seconds if no signal detected
      setTimeout(() => {
        setLocalServerStatus(prev => prev === "starting" ? "running" : prev);
      }, 5000);

      toast.success(`Starting ${project.name}...`);
    } catch (e) {
      console.error("Failed to start server:", e);
      setLocalServerStatus("error");
      unlisten(); // Clean up listener on error
      toast.error("Failed to start server");
    }
  }, [project, serverStatus, parentStartServer, toast]);

  // Stop server - use parent callback if available
  const stopServer = useCallback(async () => {
    // If parent provides stop callback, use it
    if (parentStopServer) {
      parentStopServer();
      return;
    }

    // Otherwise use local state management
    if (!terminalId) return;

    try {
      await killShell(terminalId);
      setLocalServerStatus("stopped");
      setLocalTerminalId(null);
      setConsoleOutput(prev => [...prev, "\n--- Server stopped ---\n"]);
      toast.info("Server stopped");
    } catch (e) {
      console.error("Failed to stop server:", e);
      toast.error("Failed to stop server");
    }
  }, [terminalId, toast]);

  // Restart server
  const restartServer = useCallback(async () => {
    if (!project) return;

    setConsoleOutput(prev => [...prev, "\n--- Restarting server ---\n"]);

    // Stop current server if running
    if (terminalId) {
      try {
        await killShell(terminalId);
        setLocalTerminalId(null);
      } catch {
        // Shell may already be stopped
      }
    }

    // Brief delay before restart
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start fresh
    const id = `devproject-${Date.now()}`;
    setConsoleOutput(prev => [...prev, `$ ${project.command}\n`]);
    setLocalServerStatus("starting");

    // Set up listener BEFORE spawning shell
    const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", (event) => {
      if (event.payload.id === id) {
        const cleanData = stripAnsi(event.payload.data);
        if (cleanData.trim()) {
          setConsoleOutput(prev => {
            const lines = [...prev, cleanData];
            return lines.slice(-1000);
          });
        }

        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }

        const data = cleanData.toLowerCase();
        if (data.includes("ready") || data.includes("listening") || data.includes("started") || data.includes("localhost:")) {
          setLocalServerStatus("running");
        }
      }
    });

    try {
      await spawnShell(id, project.path, "default");
      await writeShell(id, `${project.command}\r`);
      setLocalTerminalId(id);

      setTimeout(() => {
        setLocalServerStatus(prev => prev === "starting" ? "running" : prev);
      }, 5000);

      toast.success(`Restarting ${project.name}...`);
    } catch (e) {
      console.error("Failed to restart server:", e);
      setLocalServerStatus("error");
      unlisten();
      toast.error("Failed to restart server");
    }
  }, [project, terminalId, toast]);

  // Save config to database
  const saveConfig = useCallback(async () => {
    if (!project) return;

    try {
      await dbUpdateDevProject(project.id, editedName, editedCommand, editedPort, editedAutoStart);
      setHasChanges(false);
      await loadProject();
      triggerRefresh('devProjects'); // Notify sidebar to refresh
      onUpdated?.();
      toast.success("Configuration saved");
    } catch (e) {
      console.error("Failed to save config:", e);
      toast.error("Failed to save configuration");
    }
  }, [project, editedName, editedCommand, editedPort, editedAutoStart, loadProject, onUpdated, toast]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-app">
        <div className="p-6 animate-pulse">
          <div className="h-8 w-48 bg-secondary rounded mb-4" />
          <div className="h-4 w-96 bg-secondary rounded" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <Rocket className="w-12 h-12 mb-3 opacity-50" />
        <span>Project not found</span>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 text-sm bg-secondary rounded-lg hover:bg-accent transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const previewUrl = `http://localhost:${project.port}`;

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-app">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                serverStatus === "running" ? "bg-green-500" :
                serverStatus === "starting" ? "bg-amber-500 animate-pulse" :
                serverStatus === "error" ? "bg-red-500" :
                "bg-gray-400"
              }`} />
              <h1 className="text-xl font-semibold">{project.name}</h1>
              <span className="text-sm text-muted">:{project.port}</span>
            </div>
            <div className="flex items-center gap-2">
              {serverStatus === "stopped" ? (
                <button
                  onClick={startServer}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Server
                </button>
              ) : (
                <>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-accent rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Browser
                  </a>
                  <button
                    onClick={restartServer}
                    disabled={serverStatus === "starting"}
                    className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-accent rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${serverStatus === "starting" ? "animate-spin" : ""}`} />
                    Restart
                  </button>
                  <button
                    onClick={stopServer}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Info row with path, command, and stats */}
          <div className="mt-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 text-muted">
              <span className="flex items-center gap-1">
                <FolderOpen className="w-4 h-4" />
                {project.path}
              </span>
              <span className="flex items-center gap-1">
                <FileCode className="w-4 h-4" />
                {project.command}
              </span>
            </div>
            {/* Process stats when running */}
            {serverStatus === "running" && processStats && (
              <div className="flex items-center gap-4 text-muted">
                <span className="flex items-center gap-1" title="CPU Usage">
                  <Cpu className="w-4 h-4" />
                  {processStats.cpu.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1" title="Memory Usage">
                  <HardDrive className="w-4 h-4" />
                  {(processStats.memory / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
            )}
          </div>

          {/* Quick Access & Dev Workflow toolbar */}
          <div className="mt-3 flex items-center justify-between">
            {/* Quick Access */}
            <div className="flex items-center gap-2">
              <button
                onClick={openInVSCode}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors"
                title="Open in VS Code"
              >
                <Code className="w-4 h-4" />
                VS Code
              </button>
              <button
                onClick={openInExplorer}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors"
                title="Open in File Explorer"
              >
                <Folder className="w-4 h-4" />
                Explorer
              </button>
            </div>

            {/* Dev Workflow */}
            <div className="flex items-center gap-2">
              {/* Install Dependencies */}
              <button
                onClick={installDependencies}
                disabled={isInstalling}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                title="Install Dependencies (bun install)"
              >
                <Package className={`w-4 h-4 ${isInstalling ? "animate-pulse" : ""}`} />
                {isInstalling ? "Installing..." : "Install"}
              </button>

              {/* Scripts Dropdown */}
              {Object.keys(scripts).length > 0 && (
                <div className="relative" ref={scriptsMenuRef}>
                  <button
                    onClick={() => setShowScriptsMenu(!showScriptsMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-secondary hover:bg-accent rounded-lg transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Run Script
                    <ChevronDown className={`w-3 h-3 transition-transform ${showScriptsMenu ? "rotate-180" : ""}`} />
                  </button>
                  {showScriptsMenu && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-app rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {Object.entries(scripts).map(([name, cmd]) => (
                        <button
                          key={name}
                          onClick={() => runScript(name)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex flex-col"
                        >
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-muted truncate">{cmd}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Health/Dependencies Dropdown */}
              <div className="relative" ref={healthMenuRef}>
                {/* When scanning, show cancel button instead of dropdown */}
                {isCheckingDeps ? (
                  <button
                    onClick={cancelHealthCheck}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm bg-amber-500/20 text-amber-400 hover:bg-red-500/30 rounded-lg transition-colors"
                    title="Click to cancel scan"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Scanning...
                    <XCircle className="w-4 h-4 ml-1 hover:text-red-400" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowHealthMenu(!showHealthMenu)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${
                      vulnCount && vulnCount > 0
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        : outdatedCount && outdatedCount > 0
                          ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                          : sbomGenerated
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-secondary hover:bg-accent"
                    }`}
                  >
                    {vulnCount && vulnCount > 0 ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : sbomGenerated ? (
                      <Shield className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Health
                    {(outdatedCount !== null && outdatedCount > 0) || (vulnCount !== null && vulnCount > 0) ? (
                      <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                        vulnCount && vulnCount > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                      }`}>
                        {(vulnCount || 0) + (outdatedCount || 0)}
                      </span>
                    ) : sbomGenerated ? (
                      <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-green-500 text-white">✓</span>
                    ) : null}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showHealthMenu ? "rotate-180" : ""}`} />
                  </button>
                )}
                {showHealthMenu && !isCheckingDeps && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-app rounded-lg shadow-lg z-50">
                    <button
                      onClick={checkOutdated}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 rounded-t-lg"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <div className="flex-1">
                        <span>Check Updates</span>
                        {outdatedCount !== null && (
                          <span className={`ml-2 text-xs ${outdatedCount > 0 ? "text-amber-400" : "text-green-400"}`}>
                            {outdatedCount > 0 ? `${outdatedCount} outdated` : "Up to date"}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={checkVulnerabilities}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      <div className="flex-1">
                        <span>Security Audit + SBOM</span>
                        {vulnCount !== null && (
                          <span className={`ml-2 text-xs ${vulnCount > 0 ? "text-red-400" : "text-green-400"}`}>
                            {vulnCount > 0 ? `${vulnCount} issues` : "Secure"}
                          </span>
                        )}
                      </div>
                    </button>
                    {sbomGenerated && (
                      <button
                        onClick={async () => {
                          setShowHealthMenu(false);
                          try {
                            await invoke("run_command", { command: "code", args: [`${project.path}\\.sbom\\scan.json`] });
                          } catch {
                            toast.error("Failed to open scan results");
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-green-400"
                      >
                        <FileJson className="w-4 h-4" />
                        <span>View Scan Results (JSON)</span>
                      </button>
                    )}
                    {outdatedCount !== null && outdatedCount > 0 && (
                      <button
                        onClick={updateDependencies}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 border-t border-app text-primary"
                      >
                        <Package className="w-4 h-4" />
                        Update All Packages
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Port warning */}
          {portInUse && serverStatus === "stopped" && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              Port {project.port} appears to be in use. The server may fail to start.
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-1">
          <button
            onClick={() => setActiveTab("console")}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === "console"
                ? "bg-secondary text-app border-b-2 border-primary"
                : "text-muted hover:text-app hover:bg-accent"
            }`}
          >
            <Terminal className="w-4 h-4 inline mr-2" />
            Console
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === "preview"
                ? "bg-secondary text-app border-b-2 border-primary"
                : "text-muted hover:text-app hover:bg-accent"
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === "security"
                ? "bg-secondary text-app border-b-2 border-primary"
                : "text-muted hover:text-app hover:bg-accent"
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Security
            {vulnCount !== null && vulnCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">{vulnCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === "settings"
                ? "bg-secondary text-app border-b-2 border-primary"
                : "text-muted hover:text-app hover:bg-accent"
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
            {hasChanges && <span className="ml-1 w-2 h-2 bg-amber-500 rounded-full inline-block" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "console" && (
          <div className="h-full flex flex-col">
            {/* Console toolbar */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-secondary border-b border-app">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted" />
                <span className="text-sm text-muted">Console Output</span>
                {consoleOutput.length > 0 && (
                  <span className="text-xs text-muted">({consoleOutput.length} lines)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyConsoleOutput}
                  disabled={consoleOutput.length === 0}
                  className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => setConsoleOutput([])}
                  disabled={consoleOutput.length === 0}
                  className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Clear console"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>
            {/* Console output */}
            <div
              ref={consoleRef}
              className="flex-1 overflow-auto bg-black p-4 font-mono text-sm text-green-400"
            >
              {consoleOutput.length === 0 ? (
                <div className="text-gray-500">
                  Server not started. Click "Start Server" to begin.
                </div>
              ) : (
                consoleOutput.map((line, i) => (
                  <pre key={i} className="whitespace-pre-wrap">{line}</pre>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-secondary border-b border-app">
              <Globe className="w-4 h-4 text-muted" />
              <span className="text-sm text-muted">{previewUrl}</span>
              <button
                onClick={() => {
                  const iframe = document.getElementById("devproject-preview") as HTMLIFrameElement;
                  if (iframe) iframe.src = previewUrl;
                }}
                className="p-1 text-muted hover:text-app rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {serverStatus === "running" ? (
              <iframe
                id="devproject-preview"
                src={previewUrl}
                className="flex-1 w-full bg-white"
                title="Dev Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Start the server to see the preview</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "security" && (
          <div className="h-full overflow-auto p-6">
            {/* Scan Summary */}
            {sbomData && (
              <div className="mb-6 p-4 bg-secondary rounded-lg">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Affected Packages
                </h3>
                <p className="text-2xl font-bold">{sbomData.components?.length || 0} <span className="text-sm font-normal text-muted">packages with vulnerabilities</span></p>
                {sbomData.metadata?.target && (
                  <p className="text-xs text-muted mt-1">Scanned: {sbomData.metadata.target}</p>
                )}
              </div>
            )}

            {/* Vulnerability Summary */}
            {vulnData && vulnData.matches && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Vulnerabilities ({vulnData.matches.length})
                </h3>

                {/* Severity breakdown */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {['Critical', 'High', 'Medium', 'Low'].map(severity => {
                    const count = vulnData.matches.filter((m: any) =>
                      m.vulnerability?.severity?.toLowerCase() === severity.toLowerCase()
                    ).length;
                    const colors: Record<string, string> = {
                      Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
                      High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                      Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                      Low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                    };
                    return (
                      <div key={severity} className={`p-3 rounded-lg border ${colors[severity]}`}>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs">{severity}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Vulnerability list */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {vulnData.matches.map((match: any, idx: number) => {
                    const vuln = match.vulnerability || {};
                    const artifact = match.artifact || {};
                    const severityColors: Record<string, string> = {
                      critical: 'text-red-400',
                      high: 'text-orange-400',
                      medium: 'text-amber-400',
                      low: 'text-blue-400',
                      negligible: 'text-gray-400',
                    };
                    return (
                      <div key={idx} className="p-3 bg-secondary rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{artifact.name}@{artifact.version}</div>
                            <div className="text-sm text-muted">{vuln.id}</div>
                          </div>
                          <span className={`text-sm font-medium ${severityColors[vuln.severity?.toLowerCase()] || 'text-gray-400'}`}>
                            {vuln.severity}
                          </span>
                        </div>
                        {vuln.fix?.versions && vuln.fix.versions.length > 0 && (
                          <div className="mt-2 text-sm text-green-400">
                            Fix available: {vuln.fix.versions.join(', ')}
                          </div>
                        )}
                        {vuln.description && (
                          <div className="mt-2 text-sm text-muted line-clamp-2">{vuln.description}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Scan History
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {scanHistory.map((scan, idx) => {
                    const prevScan = scanHistory[idx + 1];
                    const trend = prevScan ? scan.totalCount - prevScan.totalCount : 0;
                    const scanDate = new Date(scan.scanDate);
                    const isLatest = idx === 0;

                    return (
                      <div
                        key={scan.id}
                        className={`p-3 rounded-lg border ${isLatest ? 'bg-primary/10 border-primary/30' : 'bg-secondary border-transparent'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted" />
                            <span className="text-sm">
                              {scanDate.toLocaleDateString()} {scanDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isLatest && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">Latest</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {trend !== 0 && (
                              <span className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {trend > 0 ? '+' : ''}{trend}
                              </span>
                            )}
                            {trend === 0 && prevScan && (
                              <span className="flex items-center gap-1 text-xs text-muted">
                                <Minus className="w-3 h-3" />
                                No change
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-medium">
                            {scan.totalCount === 0 ? (
                              <span className="text-green-400">No vulnerabilities</span>
                            ) : (
                              <span>{scan.totalCount} vulnerabilities</span>
                            )}
                          </span>
                          {scan.totalCount > 0 && (
                            <div className="flex items-center gap-2 text-muted">
                              {scan.criticalCount > 0 && <span className="text-red-400">C:{scan.criticalCount}</span>}
                              {scan.highCount > 0 && <span className="text-orange-400">H:{scan.highCount}</span>}
                              {scan.mediumCount > 0 && <span className="text-amber-400">M:{scan.mediumCount}</span>}
                              {scan.lowCount > 0 && <span className="text-blue-400">L:{scan.lowCount}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No data state */}
            {!vulnData && !sbomData && scanHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted">
                <Shield className="w-12 h-12 mb-3 opacity-50" />
                <p>Run a Security Audit to see results</p>
                <p className="text-sm mt-1">Use the Health menu to scan for vulnerabilities</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-xl space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-app rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Dev Command</label>
                <input
                  type="text"
                  value={editedCommand}
                  onChange={(e) => setEditedCommand(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary border border-app rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  placeholder="bun dev"
                />
                <p className="mt-1 text-xs text-muted">The command to start the dev server</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Port</label>
                <input
                  type="number"
                  value={editedPort}
                  onChange={(e) => setEditedPort(parseInt(e.target.value) || 3000)}
                  className="w-32 px-3 py-2 bg-secondary border border-app rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted">The port the dev server runs on</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoStart"
                  checked={editedAutoStart}
                  onChange={(e) => setEditedAutoStart(e.target.checked)}
                  className="w-4 h-4 rounded border-app"
                />
                <label htmlFor="autoStart" className="text-sm">
                  Auto-start when vault opens
                </label>
              </div>

              <div className="pt-4 border-t border-app">
                <button
                  onClick={saveConfig}
                  disabled={!hasChanges}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    hasChanges
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-secondary text-muted cursor-not-allowed"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DevProjectView;
