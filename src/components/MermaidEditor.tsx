import { useState, useEffect, useRef, useCallback } from "react";
import mermaid from "mermaid";
import {
  Save,
  X,
  Code2,
  Eye,
  Columns,
  Download,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { CodeEditor, type CodeEditorHandle } from "./CodeEditor";

interface MermaidEditorProps {
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

type ViewMode = "edit" | "preview" | "split";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "inherit",
});

export function MermaidEditor({
  content,
  onChange,
  onSave,
  onClose,
  fileName,
  isDirty,
  isSaving,
  lastSaved,
  isDark = true,
}: MermaidEditorProps) {
  const [mode, setMode] = useState<ViewMode>("split");
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<CodeEditorHandle>(null);
  const renderIdRef = useRef(0);

  // Update mermaid theme when dark mode changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    });
  }, [isDark]);

  // Render mermaid diagram
  const renderDiagram = useCallback(async () => {
    if (!content.trim()) {
      setSvgContent("");
      setError(null);
      return;
    }

    const currentRenderId = ++renderIdRef.current;

    try {
      // Validate syntax first
      await mermaid.parse(content);

      // Render if still current
      if (currentRenderId === renderIdRef.current) {
        const { svg } = await mermaid.render(`mermaid-${currentRenderId}`, content);
        if (currentRenderId === renderIdRef.current) {
          setSvgContent(svg);
          setError(null);
        }
      }
    } catch (e: any) {
      if (currentRenderId === renderIdRef.current) {
        setError(e.message || "Invalid mermaid syntax");
        // Keep the last valid SVG visible
      }
    }
  }, [content]);

  // Debounced render
  useEffect(() => {
    const timer = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timer);
  }, [renderDiagram]);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(3, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.25, s - 0.25));
  const resetZoom = () => setScale(1);

  // Export as SVG
  const exportSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.(mermaid|mmd)$/i, ".svg");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export as PNG
  const exportPng = async () => {
    if (!svgContent || !previewRef.current) return;

    const svgElement = previewRef.current.querySelector("svg");
    if (!svgElement) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = isDark ? "#1a1d24" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = fileName.replace(/\.(mermaid|mmd)$/i, ".png");
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
        }
      }, "image/png");

      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 text-purple-500">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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
          {/* View mode toggle */}
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setMode("edit")}
              title="Code only"
              className={`p-1.5 rounded-md transition-colors ${
                mode === "edit"
                  ? "bg-accent text-app"
                  : "text-muted hover:text-app"
              }`}
            >
              <Code2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode("split")}
              title="Split view"
              className={`p-1.5 rounded-md transition-colors ${
                mode === "split"
                  ? "bg-accent text-app"
                  : "text-muted hover:text-app"
              }`}
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode("preview")}
              title="Preview only"
              className={`p-1.5 rounded-md transition-colors ${
                mode === "preview"
                  ? "bg-accent text-app"
                  : "text-muted hover:text-app"
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom controls */}
          {(mode === "preview" || mode === "split") && (
            <>
              <div className="w-px h-4 bg-app" />
              <button
                onClick={zoomOut}
                disabled={scale <= 0.25}
                title="Zoom out"
                className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                disabled={scale >= 3}
                title="Zoom in"
                className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                title="Reset zoom"
                className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </>
          )}

          <div className="w-px h-4 bg-app" />

          {/* Export buttons */}
          <button
            onClick={exportSvg}
            disabled={!svgContent}
            title="Export as SVG"
            className="px-2 py-1 text-xs text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            SVG
          </button>
          <button
            onClick={exportPng}
            disabled={!svgContent}
            title="Export as PNG"
            className="px-2 py-1 text-xs text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
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

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        {(mode === "edit" || mode === "split") && (
          <div
            className={`${
              mode === "split" ? "w-1/2 border-r border-app" : "w-full"
            } h-full overflow-hidden`}
          >
            <CodeEditor
              ref={codeEditorRef}
              value={content}
              onChange={onChange}
              language="markdown"
              isDark={isDark}
            />
          </div>
        )}

        {/* Preview pane */}
        {(mode === "preview" || mode === "split") && (
          <div
            className={`${
              mode === "split" ? "w-1/2" : "w-full"
            } h-full overflow-auto flex flex-col`}
          >
            {error && (
              <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
            <div
              ref={previewRef}
              className="flex-1 overflow-auto p-4 flex items-center justify-center"
              style={{
                backgroundColor: isDark ? "#1a1d24" : "#f5f5f5",
              }}
            >
              {svgContent ? (
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.1s ease-out",
                  }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <div className="text-muted text-sm">
                  {content.trim() ? "Rendering..." : "Start typing mermaid code..."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted flex justify-between">
        <span>
          {content.length} characters | {content.split("\n").length} lines
        </span>
        <span>Ctrl+S to save | MERMAID</span>
      </div>
    </div>
  );
}

export default MermaidEditor;
