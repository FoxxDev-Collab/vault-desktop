import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Zoom presets
const ZOOM_PRESETS = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1 },
  { label: "125%", value: 1.25 },
  { label: "150%", value: 1.5 },
  { label: "200%", value: 2 },
];

interface PdfViewerProps {
  data: ArrayBuffer;
  fileName?: string;
}

export function PdfViewer({ data, fileName }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);
  const [pageInputValue, setPageInputValue] = useState<string>("1");

  // Convert ArrayBuffer to Uint8Array for react-pdf
  const [pdfData, setPdfData] = useState<{ data: Uint8Array } | null>(null);

  useEffect(() => {
    if (data) {
      setPdfData({ data: new Uint8Array(data) });
    }
  }, [data]);

  // Sync page input value with page number
  useEffect(() => {
    setPageInputValue(pageNumber.toString());
  }, [pageNumber]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    setError(`Failed to load PDF: ${err.message}`);
  }

  const goToFirstPage = useCallback(() => setPageNumber(1), []);
  const goToLastPage = useCallback(() => setPageNumber(numPages), [numPages]);
  const goToPrevPage = useCallback(() => setPageNumber((p) => Math.max(1, p - 1)), []);
  const goToNextPage = useCallback(() => setPageNumber((p) => Math.min(numPages, p + 1)), [numPages]);
  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.25)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.25, s - 0.25)), []);
  const setZoomLevel = useCallback((level: number) => {
    setScale(level);
    setShowZoomDropdown(false);
  }, []);
  const rotate = useCallback(() => setRotation((r) => (r + 90) % 360), []);
  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);

  // Handle page input change
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputBlur = () => {
    const val = parseInt(pageInputValue);
    if (val >= 1 && val <= numPages) {
      setPageNumber(val);
    } else {
      setPageInputValue(pageNumber.toString());
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePageInputBlur();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "PageDown":
        case "ArrowRight":
          e.preventDefault();
          goToNextPage();
          break;
        case "PageUp":
        case "ArrowLeft":
          e.preventDefault();
          goToPrevPage();
          break;
        case "Home":
          e.preventDefault();
          goToFirstPage();
          break;
        case "End":
          e.preventDefault();
          goToLastPage();
          break;
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
  }, [goToNextPage, goToPrevPage, goToFirstPage, goToLastPage, zoomIn, zoomOut, rotate, isFullscreen]);

  // Handle scroll wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
  }, [zoomIn, zoomOut]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading PDF</p>
          <p className="text-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading PDF...</div>
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
            {fileName && `${fileName} - `}Page {pageNumber} of {numPages}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Page navigation */}
          <button
            onClick={goToFirstPage}
            disabled={pageNumber <= 1}
            title="First page (Home)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            title="Previous page (PageUp)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              className="w-10 px-1 py-0.5 text-xs text-center bg-app border border-input rounded"
            />
            <span className="text-xs text-muted">/ {numPages}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            title="Next page (PageDown)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={goToLastPage}
            disabled={pageNumber >= numPages}
            title="Last page (End)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-app mx-1" />

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.25}
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
              </div>
            )}
          </div>

          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            title="Zoom in (+)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors disabled:opacity-50"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-app mx-1" />

          {/* Rotate */}
          <button
            onClick={rotate}
            title="Rotate (R)"
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
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

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-neutral-800 flex justify-center p-4"
        onWheel={handleWheel}
      >
        <Document
          file={pdfData}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="text-muted">Loading PDF document...</div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            rotate={rotation}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-xl"
          />
        </Document>
      </div>

      {/* Footer */}
      <div className="px-3 py-1 bg-secondary border-t border-app text-xs text-muted flex justify-between">
        <span>Arrow/PageUp/PageDown: navigate | Home/End: first/last | +/- zoom | Ctrl+scroll: zoom | R rotate</span>
        <span>
          {rotation > 0 && `${rotation}° | `}
          {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  );
}

export default PdfViewer;
