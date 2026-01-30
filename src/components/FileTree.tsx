import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileType,
  File,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Kanban,
  FileCode,
  MonitorPlay,
  Star,
  GripVertical,
  GitBranch,
  PenTool,
} from "lucide-react";

export interface FileNode {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "folder";
  extension?: string;
  children?: FileNode[];
  modified?: string;
  size?: number;
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedPath?: string;
  onSelect: (node: FileNode) => void;
  onMove: (oldPath: string, newPath: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onCreateFile: (folderPath: string) => void;
  onCreateFolder: (folderPath: string) => void;
  defaultFoldersOpen?: boolean;
  foldersOpenDepth?: number;
  favorites?: Set<string>;
  onToggleFavorite?: (path: string) => void;
  /** Force all folders to expand (increment to trigger) */
  expandAllTrigger?: number;
  /** Force all folders to collapse (increment to trigger) */
  collapseAllTrigger?: number;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath?: string;
  focusedPath?: string;
  onSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  dragState: DragState;
  onDragStart: (node: FileNode, e: React.MouseEvent) => void;
  isExpanded: boolean;
  onToggleExpand: (path: string) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (path: string) => void;
  registerDropTarget: (path: string, element: HTMLElement | null, isFolder: boolean) => void;
}

interface DragState {
  isDragging: boolean;
  draggedNode: FileNode | null;
  dropTargetPath: string | null;
  mousePos: { x: number; y: number };
}

function TreeNode({
  node,
  depth,
  selectedPath,
  focusedPath,
  onSelect,
  onContextMenu,
  dragState,
  onDragStart,
  isExpanded,
  onToggleExpand,
  favorites,
  onToggleFavorite,
  registerDropTarget,
}: TreeNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);

  // Register this node as a drop target if it's a folder
  useEffect(() => {
    if (node.type === "folder") {
      registerDropTarget(node.path, nodeRef.current, true);
      return () => registerDropTarget(node.path, null, true);
    }
  }, [node.path, node.type, registerDropTarget]);

  const isSelected = selectedPath === node.path;
  const isFocused = focusedPath === node.path;
  const isDropTarget = dragState.dropTargetPath === node.path;
  const isFolder = node.type === "folder";
  const isFavorite = favorites?.has(node.path) ?? false;
  const isBeingDragged = dragState.draggedNode?.path === node.path;

  // Scroll into view when focused
  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isFocused]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      onToggleExpand(node.path);
    } else {
      onSelect(node);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag on left click on the grip handle
    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      onDragStart(node, e);
    }
  };

  const getIcon = () => {
    const iconClass = "w-4 h-4 flex-shrink-0";
    const lowerName = node.name.toLowerCase();

    if (isFolder) {
      return isExpanded ? (
        <FolderOpen className={`${iconClass} text-yellow-500`} />
      ) : (
        <Folder className={`${iconClass} text-yellow-500`} />
      );
    }

    // Check for special file types first
    if (lowerName.endsWith(".dashboard.json")) {
      return <LayoutDashboard className={`${iconClass} text-chart-1`} />;
    }
    if (lowerName.endsWith(".kanban.json") || lowerName.endsWith(".board.json")) {
      return <Kanban className={`${iconClass} text-chart-2`} />;
    }
    // Live page files
    if (lowerName.endsWith(".page.tsx") || lowerName.endsWith(".page.jsx") ||
        lowerName.endsWith(".render.tsx") || lowerName.endsWith(".render.jsx") ||
        lowerName.endsWith(".live.tsx") || lowerName.endsWith(".live.jsx")) {
      return <MonitorPlay className={`${iconClass} text-chart-5`} />;
    }
    // Mermaid diagram files
    if (lowerName.endsWith(".mermaid") || lowerName.endsWith(".mmd")) {
      return <GitBranch className={`${iconClass} text-purple-500`} />;
    }
    // Excalidraw drawing files
    if (lowerName.endsWith(".excalidraw")) {
      return <PenTool className={`${iconClass} text-violet-400`} />;
    }

    // Code files
    const codeExtensions = [".js", ".jsx", ".ts", ".tsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".cs", ".php", ".html", ".css", ".scss", ".vue", ".svelte", ".astro", ".sql", ".sh", ".bash", ".ps1"];
    if (codeExtensions.some(ext => lowerName.endsWith(ext))) {
      return <FileCode className={`${iconClass} text-chart-3`} />;
    }

    switch (node.extension) {
      case ".md":
        return <FileText className={`${iconClass} text-blue-400`} />;
      case ".json":
        return <FileJson className={`${iconClass} text-yellow-400`} />;
      case ".csv":
      case ".xlsx":
      case ".xls":
        return <FileSpreadsheet className={`${iconClass} text-green-500`} />;
      case ".docx":
      case ".doc":
        return <FileType className={`${iconClass} text-blue-500`} />;
      case ".yaml":
      case ".yml":
        return <FileJson className={`${iconClass} text-purple-400`} />;
      default:
        return <File className={`${iconClass} text-muted`} />;
    }
  };

  return (
    <div>
      <div
        ref={nodeRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={`
          group flex items-center gap-1 px-2 py-1.5 cursor-pointer select-none
          text-sm font-medium rounded-md transition-colors
          ${isSelected ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent text-sidebar-foreground"}
          ${isFocused && !isSelected ? "ring-2 ring-primary ring-inset" : ""}
          ${isDropTarget ? "bg-primary/30 ring-2 ring-primary ring-offset-1" : ""}
          ${isBeingDragged ? "opacity-50" : ""}
        `}
      >
        {/* Drag handle */}
        <span
          onMouseDown={handleMouseDown}
          className="w-4 h-4 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity flex-shrink-0"
          title="Drag to move"
        >
          <GripVertical className="w-3 h-3" />
        </span>

        {isFolder && (
          <span className="w-4 h-4 flex items-center justify-center -ml-1">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted" />
            )}
          </span>
        )}
        {!isFolder && <span className="w-4" />}
        {getIcon()}
        <span className="truncate flex-1">{node.name}</span>
        {!isFolder && isFavorite && (
          <Star className="w-3 h-3 text-yellow-500 fill-current flex-shrink-0" />
        )}
        {isFolder && node.children && node.children.length > 0 && (
          <span className="ml-auto text-xs text-muted tabular-nums">
            {node.children.length}
          </span>
        )}
      </div>
    </div>
  );
}

// Helper to flatten nodes into visible list based on expanded state
function flattenVisibleNodes(
  nodes: FileNode[],
  expandedPaths: Set<string>
): FileNode[] {
  const result: FileNode[] = [];

  const traverse = (nodeList: FileNode[]) => {
    for (const node of nodeList) {
      result.push(node);
      if (node.type === "folder" && expandedPaths.has(node.path) && node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(nodes);
  return result;
}

// Helper to find parent path
function getParentPath(path: string): string | null {
  const lastSlash = path.lastIndexOf("\\");
  if (lastSlash === -1) return null;
  return path.substring(0, lastSlash);
}

// Helper to initialize expanded paths based on depth
function initExpandedPaths(
  nodes: FileNode[],
  defaultOpen: boolean,
  maxDepth: number,
  currentDepth: number = 0
): Set<string> {
  const paths = new Set<string>();

  if (!defaultOpen || currentDepth >= maxDepth) return paths;

  for (const node of nodes) {
    if (node.type === "folder") {
      paths.add(node.path);
      if (node.children) {
        const childPaths = initExpandedPaths(node.children, defaultOpen, maxDepth, currentDepth + 1);
        childPaths.forEach(p => paths.add(p));
      }
    }
  }

  return paths;
}

export function FileTree({
  nodes,
  selectedPath,
  onSelect,
  onMove,
  onContextMenu,
  defaultFoldersOpen = true,
  foldersOpenDepth = 2,
  favorites,
  onToggleFavorite,
  expandAllTrigger,
  collapseAllTrigger,
}: FileTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropTargetsRef = useRef<Map<string, { element: HTMLElement; isFolder: boolean }>>(new Map());

  // Expanded folders state (managed at tree level for keyboard nav)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() =>
    initExpandedPaths(nodes, defaultFoldersOpen, foldersOpenDepth)
  );

  // Keyboard focus state (separate from selection)
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedNode: null,
    dropTargetPath: null,
    mousePos: { x: 0, y: 0 },
  });

  // Expand all when trigger changes
  useEffect(() => {
    if (expandAllTrigger && expandAllTrigger > 0) {
      const allFolderPaths = new Set<string>();
      const collectFolders = (nodeList: FileNode[]) => {
        for (const node of nodeList) {
          if (node.type === "folder") {
            allFolderPaths.add(node.path);
            if (node.children) collectFolders(node.children);
          }
        }
      };
      collectFolders(nodes);
      setExpandedPaths(allFolderPaths);
    }
  }, [expandAllTrigger, nodes]);

  // Collapse all when trigger changes
  useEffect(() => {
    if (collapseAllTrigger && collapseAllTrigger > 0) {
      setExpandedPaths(new Set());
    }
  }, [collapseAllTrigger]);

  // Build flattened visible nodes list
  const visibleNodes = useMemo(
    () => flattenVisibleNodes(nodes, expandedPaths),
    [nodes, expandedPaths]
  );

  // Build node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, FileNode>();
    const traverse = (nodeList: FileNode[]) => {
      for (const node of nodeList) {
        map.set(node.path, node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(nodes);
    return map;
  }, [nodes]);

  // Toggle folder expansion
  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (visibleNodes.length === 0) return;

    const currentIndex = focusedPath
      ? visibleNodes.findIndex(n => n.path === focusedPath)
      : -1;
    const currentNode = currentIndex >= 0 ? visibleNodes[currentIndex] : null;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex = currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0;
        setFocusedPath(visibleNodes[nextIndex].path);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1;
        setFocusedPath(visibleNodes[prevIndex].path);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (currentNode?.type === "folder") {
          if (!expandedPaths.has(currentNode.path)) {
            // Expand the folder
            handleToggleExpand(currentNode.path);
          } else if (currentNode.children?.length) {
            // Already expanded, move to first child
            setFocusedPath(currentNode.children[0].path);
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (currentNode?.type === "folder" && expandedPaths.has(currentNode.path)) {
          // Collapse the folder
          handleToggleExpand(currentNode.path);
        } else if (currentNode) {
          // Move to parent folder
          const parentPath = getParentPath(currentNode.path);
          if (parentPath && nodeMap.has(parentPath)) {
            setFocusedPath(parentPath);
          }
        }
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (currentNode) {
          if (currentNode.type === "folder") {
            handleToggleExpand(currentNode.path);
          } else {
            onSelect(currentNode);
          }
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        if (visibleNodes.length > 0) {
          setFocusedPath(visibleNodes[0].path);
        }
        break;
      }
      case "End": {
        e.preventDefault();
        if (visibleNodes.length > 0) {
          setFocusedPath(visibleNodes[visibleNodes.length - 1].path);
        }
        break;
      }
    }
  }, [visibleNodes, focusedPath, expandedPaths, handleToggleExpand, nodeMap, onSelect]);

  // Focus the container when clicking on it
  const handleContainerClick = useCallback(() => {
    containerRef.current?.focus();
    // If no focus, set to first node or selected node
    if (!focusedPath && visibleNodes.length > 0) {
      setFocusedPath(selectedPath || visibleNodes[0].path);
    }
  }, [focusedPath, selectedPath, visibleNodes]);

  // Register drop targets
  const registerDropTarget = useCallback((path: string, element: HTMLElement | null, isFolder: boolean) => {
    if (element) {
      dropTargetsRef.current.set(path, { element, isFolder });
    } else {
      dropTargetsRef.current.delete(path);
    }
  }, []);

  // Find which drop target the mouse is over
  const findDropTarget = useCallback((x: number, y: number): string | null => {
    for (const [path, { element, isFolder }] of dropTargetsRef.current) {
      if (!isFolder) continue;
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        // Don't allow dropping on self or descendants
        if (dragState.draggedNode &&
            (path === dragState.draggedNode.path ||
             path.startsWith(dragState.draggedNode.path + "\\"))) {
          continue;
        }
        return path;
      }
    }
    return null;
  }, [dragState.draggedNode]);

  // Handle drag start
  const handleDragStart = useCallback((node: FileNode, e: React.MouseEvent) => {
    setDragState({
      isDragging: true,
      draggedNode: node,
      dropTargetPath: null,
      mousePos: { x: e.clientX, y: e.clientY },
    });
  }, []);

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dropTarget = findDropTarget(e.clientX, e.clientY);
      setDragState(prev => ({
        ...prev,
        mousePos: { x: e.clientX, y: e.clientY },
        dropTargetPath: dropTarget,
      }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.draggedNode && dragState.dropTargetPath) {
        const newPath = `${dragState.dropTargetPath}\\${dragState.draggedNode.name}`;
        onMove(dragState.draggedNode.path, newPath);
      }
      setDragState({
        isDragging: false,
        draggedNode: null,
        dropTargetPath: null,
        mousePos: { x: 0, y: 0 },
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState.isDragging, dragState.draggedNode, dragState.dropTargetPath, findDropTarget, onMove]);

  // Recursive render function for tree structure
  const renderNode = (node: FileNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.path);

    return (
      <div key={node.path}>
        <TreeNode
          node={node}
          depth={depth}
          selectedPath={selectedPath}
          focusedPath={focusedPath || undefined}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          dragState={dragState}
          onDragStart={handleDragStart}
          isExpanded={isExpanded}
          onToggleExpand={handleToggleExpand}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          registerDropTarget={registerDropTarget}
        />
        {node.type === "folder" && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleContainerClick}
      className="py-2 min-h-full relative outline-none"
    >
      {nodes.map(node => renderNode(node, 0))}

      {/* Drag ghost/indicator */}
      {dragState.isDragging && dragState.draggedNode && (
        <div
          className="fixed pointer-events-none z-50 bg-sidebar border border-primary rounded-md px-3 py-1.5 shadow-lg text-sm font-medium flex items-center gap-2"
          style={{
            left: dragState.mousePos.x + 10,
            top: dragState.mousePos.y + 10,
          }}
        >
          <GripVertical className="w-3 h-3 text-muted" />
          {dragState.draggedNode.name}
          {dragState.dropTargetPath && (
            <span className="text-xs text-primary ml-2">
              → {dragState.dropTargetPath.split("\\").pop()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default FileTree;
