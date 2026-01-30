import { ChevronRight, Folder, Home } from "lucide-react";
import { useMemo } from "react";

interface BreadcrumbProps {
  filePath: string;
  vaultPath?: string;
  onNavigate?: (path: string) => void;
  maxSegments?: number;
}

export function Breadcrumb({
  filePath,
  vaultPath,
  onNavigate,
  maxSegments = 5,
}: BreadcrumbProps) {
  // Parse the file path into segments relative to vault
  const segments = useMemo(() => {
    // Get relative path from vault root
    let relativePath = filePath;
    if (vaultPath && filePath.startsWith(vaultPath)) {
      relativePath = filePath.slice(vaultPath.length);
      // Remove leading slash/backslash
      if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
        relativePath = relativePath.slice(1);
      }
    }

    // Split by both forward and back slashes
    const parts = relativePath.split(/[/\\]/).filter(Boolean);

    // Build full paths for each segment
    const result: { name: string; path: string; isFile: boolean }[] = [];
    let currentPath = vaultPath || "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}\\${part}` : part;
      result.push({
        name: part,
        path: currentPath,
        isFile: i === parts.length - 1,
      });
    }

    return result;
  }, [filePath, vaultPath]);

  // Truncate if too many segments
  const displaySegments = useMemo(() => {
    if (segments.length <= maxSegments) {
      return { truncated: false, segments };
    }
    // Keep first segment, ellipsis, and last (maxSegments - 2) segments
    const keepCount = maxSegments - 2;
    return {
      truncated: true,
      segments: [
        segments[0],
        ...segments.slice(-keepCount),
      ],
    };
  }, [segments, maxSegments]);

  const handleClick = (path: string, isFile: boolean) => {
    if (!isFile && onNavigate) {
      onNavigate(path);
    }
  };

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-0.5 text-xs text-muted overflow-hidden min-w-0">
      {/* Vault root indicator */}
      {vaultPath && onNavigate && (
        <>
          <button
            onClick={() => onNavigate(vaultPath)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent hover:text-app transition-colors flex-shrink-0"
            title="Go to vault root"
          >
            <Home className="w-3 h-3" />
          </button>
          <ChevronRight className="w-3 h-3 text-muted/50 flex-shrink-0" />
        </>
      )}

      {/* Truncation indicator */}
      {displaySegments.truncated && (
        <>
          <button
            onClick={() => handleClick(displaySegments.segments[0].path, displaySegments.segments[0].isFile)}
            className={`px-1.5 py-0.5 rounded truncate max-w-[120px] ${
              !displaySegments.segments[0].isFile && onNavigate
                ? "hover:bg-accent hover:text-app cursor-pointer"
                : "cursor-default"
            } transition-colors`}
            title={displaySegments.segments[0].name}
          >
            {displaySegments.segments[0].name}
          </button>
          <ChevronRight className="w-3 h-3 text-muted/50 flex-shrink-0" />
          <span className="px-1.5 py-0.5 text-muted/50">...</span>
          <ChevronRight className="w-3 h-3 text-muted/50 flex-shrink-0" />
        </>
      )}

      {/* Path segments */}
      {(displaySegments.truncated
        ? displaySegments.segments.slice(1)
        : displaySegments.segments
      ).map((segment, index, arr) => (
        <div key={segment.path} className="flex items-center gap-0.5 min-w-0">
          {(!displaySegments.truncated && index > 0) || (displaySegments.truncated && index > 0) ? (
            <ChevronRight className="w-3 h-3 text-muted/50 flex-shrink-0" />
          ) : null}

          {segment.isFile ? (
            // Current file (not clickable, highlighted)
            <span className="px-1.5 py-0.5 text-app font-medium truncate max-w-[200px]" title={segment.name}>
              {segment.name}
            </span>
          ) : (
            // Folder (clickable)
            <button
              onClick={() => handleClick(segment.path, segment.isFile)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded truncate max-w-[120px] ${
                onNavigate
                  ? "hover:bg-accent hover:text-app cursor-pointer"
                  : "cursor-default"
              } transition-colors`}
              title={segment.name}
            >
              <Folder className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{segment.name}</span>
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}

export default Breadcrumb;
