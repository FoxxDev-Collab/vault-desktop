import { useRef, useEffect, useState } from "react";
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

interface HtmlViewerProps {
  content: string;
  fileName?: string;
}

export function HtmlViewer({ content, fileName }: HtmlViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update iframe content when HTML changes
  useEffect(() => {
    if (iframeRef.current) {
      try {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(content);
          doc.close();
          setError(null);
        }
      } catch (e) {
        setError(`Failed to render HTML: ${e}`);
      }
    }
  }, [content]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
      }
    }
  };

  const handleOpenInBrowser = () => {
    // Create a blob URL and open in new window
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-destructive mb-2">Error rendering HTML</p>
          <p className="text-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? "fixed inset-0 z-50 bg-app" : ""}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary border-b border-app">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            HTML Preview {fileName && `- ${fileName}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            title="Refresh preview"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenInBrowser}
            title="Open in browser"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* iframe container */}
      <div className="flex-1 bg-white overflow-hidden">
        <iframe
          ref={iframeRef}
          title="HTML Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      </div>
    </div>
  );
}

export default HtmlViewer;
