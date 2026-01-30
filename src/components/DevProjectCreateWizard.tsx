import { useState, useCallback, useRef } from "react";
import { X, Rocket, FolderPlus, Loader2, Check } from "lucide-react";
import { createFolder, dbAddDevProject, type DevProject } from "../hooks/useApi";
import { triggerRefresh } from "../hooks/useRefresh";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Strip ANSI escape codes for cleaner console output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\[[\d;]*[A-Za-z]/g, '') // Additional escape sequences
    .replace(/\]\d;[^\x07]*\x07/g, '') // OSC sequences (window titles)
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, ''); // Control characters except newline/CR
}

interface DevProjectCreateWizardProps {
  onClose: () => void;
  onCreated: (project: DevProject) => void;
  vaultPath: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  command: string; // bun create command (non-interactive)
  devCommand: string; // Default dev command
  port: number;
}

const TEMPLATES: Template[] = [
  {
    id: "vanilla-ts",
    name: "Vanilla TypeScript",
    description: "Minimal TypeScript project with Bun",
    command: "bun init -y",
    devCommand: "bun run index.ts",
    port: 3000,
  },
  {
    id: "react",
    name: "React + Vite",
    description: "React with Vite bundler and TypeScript",
    command: "bun create vite . --template react-ts --yes",
    devCommand: "bun run dev",
    port: 5173,
  },
  {
    id: "next",
    name: "Next.js",
    description: "Full-stack React framework",
    command: "bunx --yes create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias \"@/*\" --use-bun --yes",
    devCommand: "bun run dev",
    port: 3000,
  },
  {
    id: "hono",
    name: "Hono API",
    description: "Fast, lightweight web framework",
    command: "bun create hono . --template bun",
    devCommand: "bun run dev",
    port: 3000,
  },
  {
    id: "elysia",
    name: "Elysia API",
    description: "Ergonomic web framework for Bun",
    command: "bun create elysia .",
    devCommand: "bun run dev",
    port: 3000,
  },
];

type Step = "name" | "template" | "creating" | "done";

export function DevProjectCreateWizard({ onClose, onCreated, vaultPath }: DevProjectCreateWizardProps) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [createdProject, setCreatedProject] = useState<DevProject | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Sanitize project name for folder
  const folderName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-");
  const projectPath = `${vaultPath}\\${folderName}`;

  const runCommand = useCallback(async (
    command: string,
    cwd: string,
    description: string
  ): Promise<boolean> => {
    return new Promise(async (resolve) => {
      const terminalId = `create-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let completed = false;
      let outputBuffer = "";

      setLogs(prev => [...prev, `$ ${command}`]);

      const cleanup = async () => {
        try {
          await invoke("kill_shell", { id: terminalId });
        } catch {
          // Shell may have already exited
        }
      };

      // Track prompts we've already responded to
      const answeredPrompts = new Set<string>();

      // Set up listener for output
      const unlisten = await listen<{ id: string; data: string; closed?: boolean }>("terminal-output", async (event) => {
        if (event.payload.id === terminalId) {
          // Check if shell closed
          if (event.payload.closed) {
            if (!completed) {
              completed = true;
              unlisten();
              resolve(true); // Shell exited, command finished
            }
            return;
          }

          // Strip ANSI codes for cleaner display
          const cleanData = stripAnsi(event.payload.data);
          outputBuffer += cleanData;
          const lines = cleanData.split("\n").filter(l => l.trim());
          if (lines.length > 0) {
            setLogs(prev => [...prev, ...lines.slice(0, 10)]); // Limit log spam
          }

          // Detect interactive prompts and auto-respond
          const lower = outputBuffer.toLowerCase();

          // Vite rolldown prompt - send Enter to accept default "No"
          if ((lower.includes("rolldown-vite") || lower.includes("use rolldown")) && !answeredPrompts.has("rolldown")) {
            answeredPrompts.add("rolldown");
            setLogs(prev => [...prev, "(Auto-selecting: No)"]);
            try {
              await invoke("write_shell", { id: terminalId, data: "\r" });
            } catch {}
          }

          // "Install with bun and start now?" prompt - send Enter to accept default "Yes"
          if ((lower.includes("install with bun") || lower.includes("start now")) && !answeredPrompts.has("install")) {
            answeredPrompts.add("install");
            setLogs(prev => [...prev, "(Auto-selecting: Yes)"]);
            try {
              await invoke("write_shell", { id: terminalId, data: "\r" });
            } catch {}
          }

          // Generic yes/no prompts - send Enter to accept default
          if ((lower.includes("(y/n)") || lower.includes("[y/n]") || lower.includes("● yes")) && !answeredPrompts.has("yn")) {
            answeredPrompts.add("yn");
            setLogs(prev => [...prev, "(Auto-accepting default)"]);
            try {
              await invoke("write_shell", { id: terminalId, data: "\r" });
            } catch {}
          }

          // Check for completion indicators
          if (
            lower.includes("done") ||
            lower.includes("created") ||
            lower.includes("success") ||
            lower.includes("installed") ||
            lower.includes("happy hacking") ||
            lower.includes("packages installed")
          ) {
            if (!completed) {
              completed = true;
              setTimeout(() => {
                unlisten();
                cleanup();
                resolve(true);
              }, 1000); // Give it a moment to finish
            }
          }
        }
      });

      unlistenRef.current = unlisten;

      try {
        // Spawn shell
        await invoke("spawn_shell", {
          id: terminalId,
          workingDir: cwd,  // Use workingDir to match Rust snake_case -> camelCase
          shellType: "default"
        });

        // Write the command
        await invoke("write_shell", {
          id: terminalId,
          data: `${command}\r`
        });

        // Timeout after 90 seconds
        setTimeout(async () => {
          if (!completed) {
            completed = true;
            await cleanup();
            // Even if we timeout, check if files were created
            try {
              await invoke("read_file", { path: `${cwd}\\package.json` });
              resolve(true); // package.json exists, consider it success
            } catch {
              resolve(false);
            }
          }
        }, 90000);

      } catch (e) {
        console.error(`Failed to run ${description}:`, e);
        await cleanup();
        resolve(false);
      }
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!folderName) {
      setError("Project name is required");
      return;
    }

    setStep("creating");
    setLogs([`Creating project "${name}"...`]);
    setError(null);

    try {
      // 1. Create the folder
      setLogs(prev => [...prev, `Creating folder: ${folderName}/`]);
      await createFolder(folderName);

      // Small delay to ensure folder is created
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Run bun create/init in the folder
      setLogs(prev => [...prev, `Initializing ${selectedTemplate.name}...`]);

      const initSuccess = await runCommand(
        selectedTemplate.command,
        projectPath,
        "project initialization"
      );

      if (!initSuccess) {
        // Check if package.json was created anyway
        try {
          await invoke("read_file", { path: `${projectPath}\\package.json` });
          setLogs(prev => [...prev, "Project files created."]);
        } catch {
          throw new Error("Failed to initialize project. Check if bun is installed.");
        }
      }

      // 3. Install dependencies (only if not vanilla)
      if (selectedTemplate.id !== "vanilla-ts") {
        setLogs(prev => [...prev, "Installing dependencies..."]);
        await runCommand("bun install", projectPath, "dependency installation");
      }

      setLogs(prev => [...prev, "Finalizing..."]);

      // 4. Add to dev projects database
      const project = await dbAddDevProject(
        projectPath,
        name.trim(),
        selectedTemplate.devCommand,
        selectedTemplate.port
      );

      // Refresh file tree and dev projects list
      triggerRefresh('files');
      triggerRefresh('devProjects');

      setCreatedProject(project);
      setStep("done");
      setLogs(prev => [...prev, "Done! Your project is ready."]);

    } catch (e) {
      console.error("Failed to create project:", e);
      setError(String(e));
      setLogs(prev => [...prev, `Error: ${e}`]);
    }
  }, [folderName, name, projectPath, selectedTemplate, runCommand]);

  const handleFinish = useCallback(() => {
    if (createdProject) {
      onCreated(createdProject);
    }
    onClose();
  }, [createdProject, onCreated, onClose]);

  const handleClose = useCallback(() => {
    // Clean up any running listeners
    if (unlistenRef.current) {
      unlistenRef.current();
    }
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-app rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app flex-shrink-0">
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-app">Create Dev Project</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={step === "creating"}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === "name" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-awesome-app"
                  autoFocus
                  className="w-full px-3 py-2 bg-secondary border border-app rounded-lg text-app focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      setStep("template");
                    }
                  }}
                />
                {folderName && (
                  <p className="mt-1 text-xs text-muted">
                    Folder: <code className="bg-secondary px-1 rounded">{folderName}/</code>
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "template" && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Select a template for "{name}"</p>
              <div className="space-y-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedTemplate.id === template.id
                        ? "border-primary bg-primary/10"
                        : "border-app hover:bg-accent"
                    }`}
                  >
                    <div className="font-medium">{template.name}</div>
                    <div className="text-sm text-muted">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(step === "creating" || step === "done") && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {step === "creating" ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                <span className="font-medium">
                  {step === "creating" ? "Creating project..." : "Project created!"}
                </span>
              </div>

              {/* Log output */}
              <div className="bg-black rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs text-green-400">
                {logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap">{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-app flex-shrink-0">
          <div className="text-sm text-muted">
            {step === "name" && "Step 1 of 2"}
            {step === "template" && "Step 2 of 2"}
            {step === "creating" && "Creating..."}
            {step === "done" && "Complete"}
          </div>
          <div className="flex gap-3">
            {step === "name" && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-muted hover:text-app transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep("template")}
                  disabled={!name.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              </>
            )}
            {step === "template" && (
              <>
                <button
                  onClick={() => setStep("name")}
                  className="px-4 py-2 text-muted hover:text-app transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <FolderPlus className="w-4 h-4 inline mr-2" />
                  Create Project
                </button>
              </>
            )}
            {step === "done" && (
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Open Project
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevProjectCreateWizard;
