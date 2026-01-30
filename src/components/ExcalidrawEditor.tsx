import { useState, useEffect, useCallback, useRef } from "react";
import { Excalidraw, exportToSvg, exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { Save, X, Download, Image } from "lucide-react";

interface ExcalidrawEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  fileName: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  isDark?: boolean;
}

interface ExcalidrawData {
  type: "excalidraw";
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
}

export function ExcalidrawEditor({
  content,
  onChange,
  onSave,
  onClose,
  fileName,
  isDirty,
  isSaving,
  lastSaved,
  isDark = true,
}: ExcalidrawEditorProps) {
  const [initialData, setInitialData] = useState<ExcalidrawData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const excalidrawRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // Parse initial content
  useEffect(() => {
    if (isInitializedRef.current) return;

    try {
      if (content.trim()) {
        const parsed = JSON.parse(content);
        setInitialData(parsed);
        setParseError(null);
      } else {
        // New file - create empty canvas
        setInitialData({
          type: "excalidraw",
          version: 2,
          source: "vault-desktop",
          elements: [],
          appState: {
            viewBackgroundColor: isDark ? "#1a1d24" : "#ffffff",
          },
        });
      }
      isInitializedRef.current = true;
    } catch (e) {
      setParseError("Failed to parse Excalidraw file");
      // Still initialize with empty canvas
      setInitialData({
        type: "excalidraw",
        version: 2,
        source: "vault-desktop",
        elements: [],
        appState: {},
      });
      isInitializedRef.current = true;
    }
  }, [content, isDark]);

  // Handle changes from Excalidraw
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      const data: ExcalidrawData = {
        type: "excalidraw",
        version: 2,
        source: "vault-desktop",
        elements: elements as ExcalidrawElement[],
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files,
      };
      onChange(JSON.stringify(data, null, 2));
    },
    [onChange]
  );

  // Export as SVG
  const exportSvg = async () => {
    if (!excalidrawRef.current) return;

    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    const files = excalidrawRef.current.getFiles();

    const svg = await exportToSvg({
      elements,
      appState: {
        ...appState,
        exportWithDarkMode: isDark,
      },
      files,
    });

    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.excalidraw$/i, ".svg");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export as PNG
  const exportPng = async () => {
    if (!excalidrawRef.current) return;

    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    const files = excalidrawRef.current.getFiles();

    const blob = await exportToBlob({
      elements,
      appState: {
        ...appState,
        exportWithDarkMode: isDark,
      },
      files,
      mimeType: "image/png",
      quality: 1,
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.excalidraw$/i, ".png");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!initialData) {
    return (
      <div className="flex items-center justify-center h-full bg-app">
        <div className="text-muted">Loading Excalidraw...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app z-10">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 text-violet-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6v6H9z" />
            </svg>
          </div>
          <span className="text-lg font-medium text-app">{fileName}</span>
          {isDirty && <span className="text-chart-2 text-sm">(unsaved)</span>}
          {lastSaved && !isDirty && (
            <span className="text-muted text-xs">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {parseError && (
            <span className="text-destructive text-xs mr-2">{parseError}</span>
          )}

          {/* Export buttons */}
          <button
            onClick={exportSvg}
            title="Export as SVG"
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <Download className="w-3 h-3" />
            SVG
          </button>
          <button
            onClick={exportPng}
            title="Export as PNG"
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <Image className="w-3 h-3" />
            PNG
          </button>

          <div className="w-px h-4 bg-app" />

          {/* Save button */}
          <button
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDirty
                ? "bg-primary hover:opacity-90 text-primary-foreground"
                : "bg-secondary text-muted cursor-not-allowed"
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas */}
      <div className="flex-1 overflow-hidden">
        <Excalidraw
          ref={excalidrawRef}
          initialData={initialData}
          onChange={handleChange}
          theme={isDark ? "dark" : "light"}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
              saveAsImage: false,
            },
          }}
        />
      </div>
    </div>
  );
}

export default ExcalidrawEditor;
