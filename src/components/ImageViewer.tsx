import { useState, useRef, useEffect, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  RefreshCw,
  Download,
  Sun,
  Moon,
  FlipHorizontal,
  FlipVertical,
  ChevronDown,
} from "lucide-react";

// Zoom presets
const ZOOM_PRESETS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2 },
  { label: "300%", value: 3 },
  { label: "400%", value: 4 },
];

interface ImageViewerProps {
  data: ArrayBuffer;
  fileName: string;
  mimeType?: string;
}

export function ImageViewer({ data, fileName, mimeType }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [darkBg, setDarkBg] = useState(true);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);

  // Create object URL from ArrayBuffer
  useEffect(() => {
    if (data) {
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const mime = mimeType || getMimeType(ext);
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = url;

      return () => URL.revokeObjectURL(url);
    }
  }, [data, fileName, mimeType]);

  function getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      ico: "image/x-icon",
      tiff: "image/tiff",
      tif: "image/tiff",
    };
    return mimeTypes[ext] || "image/png";
  }

  const zoomIn = useCallback(() => setScale((s) => Math.min(10, s + 0.25)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.1, s - 0.25)), []);
  const setActualSize = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);
  const setZoomLevel = useCallback((level: number) => {
    setScale(level);
    setShowZoomDropdown(false);
  }, []);
  const rotate = useCallback(() => setRotation((r) => (r + 90) % 360), []);
  const toggleFlipH = useCallback(() => setFlipH((f) => !f), []);
  const toggleFlipV = useCallback(() => setFlipV((f) => !f), []);
  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPosition({ x: 0, y: 0 });
  }, []);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);
  const toggleBackground = useCallback(() => setDarkBg((d) => !d), []);

  // Fit image to container
  const fitToScreen = useCallback(() => {
    if (containerRef.current && imageSize.width && imageSize.height) {
      const container = containerRef.current.getBoundingClientRect();
      const padding = 40;
      const availableWidth = container.width - padding;
      const availableHeight = container.height - padding;

      const scaleX = availableWidth / imageSize.width;
      const scaleY = availableHeight / imageSize.height;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
      setPosition({ x: 0, y: 0 });
    }
  }, [imageSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          break;
        case "0":
          e.preventDefault();
          setActualSize();
          break;
        case "f":
        case "F":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            fitToScreen();
          }
          break;
        case "r":
        case "R":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            rotate();
          }
          break;
        case "Escape":
          if (isFullscreen) {
            e.preventDefault();
            setIsFullscreen(false);
          }
          setShowZoomDropdown(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomIn, zoomOut, setActualSize, fitToScreen, rotate, isFullscreen]);

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
    setScale((s) => Math.max(0.1, Math.min(10, s + delta)));
  };

  // Download image
  const handleDownload = () => {
    if (imageUrl) {
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading image...</div>
      </div>
    );
  }

  const transform = `
    translate(${position.x}px, ${position.y}px)
    scale(${scale})
    rotate(${rotation}deg)
    scaleX(${flipH ? -1 : 1})
    scaleY(${flipV ? -1 : 1})
  `;

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
            {fileName}
            {imageSize.width > 0 && (
              <span className="ml-2 text-muted">
                {imageSize.width} x {imageSize.height}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.1}
            title="Zoom out (-)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowZoomDropdown(!showZoomDropdown)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-app hover:bg-accent rounded transition-colors min-w-[60px] justify-center"
              title="Select zoom level"
            >
              <span>{Math.round(scale * 100)}%</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showZoomDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-app rounded-lg shadow-lg py-1 z-50 min-w-[80px]">
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setZoomLevel(preset.value)}
                    className={`w-full px-3 py-1 text-xs text-left hover:bg-accent transition-colors ${
                      Math.abs(scale - preset.value) < 0.01
                        ? "text-primary font-medium"
                        : "text-muted hover:text-app"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="border-t border-app my-1" />
                <button
                  onClick={() => { setActualSize(); setShowZoomDropdown(false); }}
                  className="w-full px-3 py-1 text-xs text-left text-muted hover:text-app hover:bg-accent transition-colors"
                >
                  Actual Size (0)
                </button>
                <button
                  onClick={() => { fitToScreen(); setShowZoomDropdown(false); }}
                  className="w-full px-3 py-1 text-xs text-left text-muted hover:text-app hover:bg-accent transition-colors"
                >
                  Fit to Screen (F)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={zoomIn}
            disabled={scale >= 10}
            title="Zoom in (+)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-app mx-1" />

          {/* Transform controls */}
          <button
            onClick={rotate}
            title="Rotate 90°"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFlipH}
            title="Flip horizontal"
            className={`p-1.5 hover:bg-accent rounded transition-colors ${
              flipH ? "text-primary" : "text-muted hover:text-app"
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFlipV}
            title="Flip vertical"
            className={`p-1.5 hover:bg-accent rounded transition-colors ${
              flipV ? "text-primary" : "text-muted hover:text-app"
            }`}
          >
            <FlipVertical className="w-4 h-4" />
          </button>

          <button
            onClick={fitToScreen}
            title="Fit to screen"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

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
            title="Download image"
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

      {/* Image Content */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center cursor-grab ${
          isDragging ? "cursor-grabbing" : ""
        }`}
        style={{
          backgroundColor: darkBg ? "#1a1a1a" : "#ffffff",
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
        <img
          src={imageUrl}
          alt={fileName}
          className="max-w-none"
          style={{
            transform,
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
          draggable={false}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1 bg-secondary border-t border-app text-xs text-muted flex justify-between">
        <span>Drag to pan | Scroll to zoom | +/- zoom | 0 actual | F fit | R rotate</span>
        <span>
          {rotation > 0 && `${rotation}° | `}
          {flipH && "H-Flip | "}
          {flipV && "V-Flip | "}
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
}

export default ImageViewer;
