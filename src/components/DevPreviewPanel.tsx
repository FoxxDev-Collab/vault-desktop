import { useState, useRef, useEffect } from "react";
import { Eye, RefreshCw, ExternalLink, X, Maximize2, Minimize2 } from "lucide-react";

interface DevPreviewPanelProps {
  url: string;
  onClose: () => void;
}

export function DevPreviewPanel({ url, onClose }: DevPreviewPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [size, setSize] = useState({ width: 500, height: 400 });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startPosRef.current.x - e.clientX;
      const deltaY = startPosRef.current.y - e.clientY;

      setSize({
        width: Math.max(300, Math.min(window.innerWidth * 0.8, startSizeRef.current.width + deltaX)),
        height: Math.max(200, Math.min(window.innerHeight * 0.8, startSizeRef.current.height + deltaY)),
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startSizeRef.current = { ...size };
    setIsResizing(true);
  };

  const refreshIframe = () => {
    const iframe = panelRef.current?.querySelector("iframe") as HTMLIFrameElement;
    if (iframe) {
      iframe.src = url;
    }
  };

  if (isMaximized) {
    return (
      <div className="fixed inset-0 z-50 bg-app flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-app bg-sidebar">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted" />
            <span className="text-sm font-medium">Preview</span>
            <span className="text-xs text-muted">{url}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refreshIframe}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Open in browser"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setIsMaximized(false)}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <iframe
          src={url}
          className="flex-1 w-full bg-white"
          title="Dev Preview"
        />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-50 bg-card border border-app rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ width: size.width, height: size.height }}
    >
      {/* Resize handle - top-left corner */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-10"
        title="Drag to resize"
      >
        <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-muted opacity-50" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-app bg-sidebar">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-muted flex-shrink-0" />
          <span className="text-sm font-medium">Preview</span>
          <span className="text-xs text-muted truncate">{url}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={refreshIframe}
            className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
            title="Open in browser"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => setIsMaximized(true)}
            className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        src={url}
        className="flex-1 w-full bg-white"
        title="Dev Preview"
      />
    </div>
  );
}

export default DevPreviewPanel;
