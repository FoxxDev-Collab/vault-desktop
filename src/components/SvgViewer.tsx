import { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  Move,
  RefreshCw,
  Download,
  Sun,
  Moon,
} from "lucide-react";

interface SvgViewerProps {
  content: string;
  fileName?: string;
}

export function SvgViewer({ content, fileName }: SvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [darkBg, setDarkBg] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate SVG content
  useEffect(() => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "image/svg+xml");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        setError("Invalid SVG: " + parseError.textContent?.slice(0, 100));
      } else {
        setError(null);
      }
    } catch (e) {
      setError(`Failed to parse SVG: ${e}`);
    }
  }, [content]);

  const zoomIn = () => setScale((s) => Math.min(5, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.1, s - 0.25));
  const rotate = () => setRotation((r) => (r + 90) % 360);
  const resetView = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const toggleBackground = () => setDarkBg(!darkBg);

  // Handle mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle scroll for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(0.1, Math.min(5, s + delta)));
  };

  // Download SVG
  const handleDownload = () => {
    const blob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "image.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download as PNG
  const handleDownloadPng = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = (fileName || "image").replace(/\.svg$/i, "") + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    img.src = url;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-destructive mb-2">Error rendering SVG</p>
          <p className="text-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full ${
        isFullscreen ? "fixed inset-0 z-50 bg-app" : ""
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary border-b border-app">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            SVG Preview {fileName && `- ${fileName}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.1}
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
            disabled={scale >= 5}
            title="Zoom in"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-app mx-1" />

          {/* Rotate */}
          <button
            onClick={rotate}
            title="Rotate 90°"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            onClick={resetView}
            title="Reset view"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-app mx-1" />

          {/* Background toggle */}
          <button
            onClick={toggleBackground}
            title={darkBg ? "Light background" : "Dark background"}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            {darkBg ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            title="Download SVG"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
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

      {/* SVG Content */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center cursor-grab ${
          isDragging ? "cursor-grabbing" : ""
        } ${darkBg ? "bg-neutral-800" : "bg-white"}`}
        style={{
          // Checkerboard pattern for transparency
          backgroundImage: darkBg
            ? "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)"
            : "linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1 bg-secondary border-t border-app text-xs text-muted flex justify-between">
        <span>Drag to pan | Scroll to zoom</span>
        <span>
          {rotation > 0 && `${rotation}° | `}
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
}

export default SvgViewer;
