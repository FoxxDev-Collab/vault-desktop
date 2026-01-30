import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Link,
  Image,
  Table,
  Minus,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileText,
  Type,
  Pilcrow,
  CornerDownLeft,
  Highlighter,
  Subscript,
  Superscript,
  ListTree,
  ChevronDown,
  Save,
  X,
  Edit3,
  Columns,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  isDirty?: boolean;
  isSaving?: boolean;
  fileName?: string;
  onClose?: () => void;
  lastSaved?: Date | null;
  isDark?: boolean;
  showPreview?: boolean;
  onTogglePreview?: () => void;
}

interface ToolbarButton {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
  active?: boolean;
}

interface ToolbarDropdown {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: { label: string; action: () => void }[];
}

// History for undo/redo
interface HistoryEntry {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

export function MarkdownEditor({
  content,
  onChange,
  onSave,
  isDirty = false,
  isSaving = false,
  fileName,
  onClose,
  lastSaved,
  isDark = true,
  showPreview = false,
  onTogglePreview,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([{ content, selectionStart: 0, selectionEnd: 0 }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);

  // View mode: "edit" | "split" | "preview"
  const [viewMode, setViewMode] = useState<"edit" | "split" | "preview">(showPreview ? "split" : "split");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; submenu?: string } | null>(null);

  // Cursor position state
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Update cursor position
  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, pos);
    const lines = textBeforeCursor.split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    setCursorPosition({ line, column });
  }, [content]);

  // Save to history
  const saveToHistory = useCallback((newContent: string) => {
    const textarea = textareaRef.current;
    const entry: HistoryEntry = {
      content: newContent,
      selectionStart: textarea?.selectionStart ?? 0,
      selectionEnd: textarea?.selectionEnd ?? 0,
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), entry].slice(-50)); // Keep last 50
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Get selection info
  const getSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { start: 0, end: 0, text: "", before: "", after: "" };

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);

    return { start, end, text, before, after };
  }, [content]);

  // Insert text at cursor
  const insertText = useCallback((
    textBefore: string,
    textAfter: string = "",
    placeholder: string = ""
  ) => {
    const { start, end, text, before, after } = getSelection();
    const selectedText = text || placeholder;
    const newContent = before + textBefore + selectedText + textAfter + after;

    onChange(newContent);
    saveToHistory(newContent);

    // Set cursor position after insert
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const newPos = start + textBefore.length + (text ? text.length : 0);
        textarea.focus();
        textarea.setSelectionRange(
          start + textBefore.length,
          start + textBefore.length + selectedText.length
        );
      }
    }, 0);
  }, [getSelection, onChange, saveToHistory]);

  // Wrap selection with text
  const wrapSelection = useCallback((wrapper: string, endWrapper?: string) => {
    const end = endWrapper ?? wrapper;
    const { text } = getSelection();
    insertText(wrapper, end, text || "text");
  }, [getSelection, insertText]);

  // Insert at line start
  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { start, before, after, text, end } = getSelection();

    // Find the start of the current line
    const lineStart = before.lastIndexOf("\n") + 1;
    const linePrefix = content.substring(lineStart, start);

    // Check if line already has this prefix
    if (linePrefix.startsWith(prefix)) {
      // Remove prefix
      const newContent = content.substring(0, lineStart) + content.substring(lineStart + prefix.length);
      onChange(newContent);
      saveToHistory(newContent);
    } else {
      // Add prefix
      const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
      onChange(newContent);
      saveToHistory(newContent);
    }
  }, [content, getSelection, onChange, saveToHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const entry = history[historyIndex - 1];
      onChange(entry.content);
      setHistoryIndex(prev => prev - 1);
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
        }
      }, 0);
    }
  }, [history, historyIndex, onChange]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const entry = history[historyIndex + 1];
      onChange(entry.content);
      setHistoryIndex(prev => prev + 1);
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd);
        }
      }, 0);
    }
  }, [history, historyIndex, onChange]);

  // Toolbar actions
  const actions = {
    bold: () => wrapSelection("**"),
    italic: () => wrapSelection("*"),
    underline: () => wrapSelection("<u>", "</u>"),
    strikethrough: () => wrapSelection("~~"),
    highlight: () => wrapSelection("=="),
    subscript: () => wrapSelection("<sub>", "</sub>"),
    superscript: () => wrapSelection("<sup>", "</sup>"),

    h1: () => insertAtLineStart("# "),
    h2: () => insertAtLineStart("## "),
    h3: () => insertAtLineStart("### "),
    h4: () => insertAtLineStart("#### "),
    h5: () => insertAtLineStart("##### "),
    h6: () => insertAtLineStart("###### "),

    bulletList: () => insertAtLineStart("- "),
    numberedList: () => insertAtLineStart("1. "),
    taskList: () => insertAtLineStart("- [ ] "),

    quote: () => insertAtLineStart("> "),
    codeInline: () => wrapSelection("`"),
    codeBlock: () => insertText("```\n", "\n```", "code here"),

    link: () => {
      const { text } = getSelection();
      if (text) {
        insertText("[", "](url)", "");
      } else {
        insertText("[", "](url)", "link text");
      }
    },

    image: () => insertText("![", "](image-url)", "alt text"),

    table: () => {
      const tableTemplate = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
      insertText("\n" + tableTemplate + "\n", "", "");
    },

    horizontalRule: () => insertText("\n---\n", "", ""),

    lineBreak: () => insertText("  \n", "", ""),
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save (works regardless of focus)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (onSave && isDirty && !isSaving) {
          onSave();
        }
        return;
      }

      // Other shortcuts only when textarea is focused
      if (!textareaRef.current || document.activeElement !== textareaRef.current) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            actions.bold();
            break;
          case "i":
            e.preventDefault();
            actions.italic();
            break;
          case "u":
            e.preventDefault();
            actions.underline();
            break;
          case "k":
            e.preventDefault();
            actions.link();
            break;
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case "y":
            e.preventDefault();
            redo();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, undo, redo, onSave, isDirty, isSaving]);

  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    onChange(newContent);
    // Debounce history save
  };

  // Handle blur to save to history
  const handleBlur = () => {
    saveToHistory(content);
  };

  // Toolbar button component
  const ToolbarBtn = ({
    icon: Icon,
    label,
    onClick,
    active = false,
    disabled = false,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-primary text-white"
          : disabled
            ? "text-muted/50 cursor-not-allowed"
            : "text-muted hover:text-app hover:bg-accent"
      }`}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  // Divider component
  const Divider = () => (
    <div className="w-px h-6 bg-app mx-1" />
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      {fileName && (
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-muted" />
            <span className="text-lg font-medium text-app">{fileName}</span>
            {isDirty && (
              <span className="text-chart-2 text-sm">(unsaved)</span>
            )}
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
                onClick={() => setViewMode("edit")}
                title="Edit mode"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "edit"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("split")}
                title="Split view"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "split"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("preview")}
                title="Preview mode"
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "preview"
                    ? "bg-accent text-app"
                    : "text-muted hover:text-app"
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>

            {/* Save button */}
            {onSave && (
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
            )}

            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ribbon Toolbar - only show in edit or split mode */}
      {(viewMode === "edit" || viewMode === "split") && (
      <div className="bg-card border-b border-app">
        {/* Main toolbar row */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap">
          {/* Undo/Redo */}
          <ToolbarBtn
            icon={Undo2}
            label="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={historyIndex <= 0}
          />
          <ToolbarBtn
            icon={Redo2}
            label="Redo (Ctrl+Y)"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          />

          <Divider />

          {/* Text formatting */}
          <ToolbarBtn icon={Bold} label="Bold (Ctrl+B)" onClick={actions.bold} />
          <ToolbarBtn icon={Italic} label="Italic (Ctrl+I)" onClick={actions.italic} />
          <ToolbarBtn icon={Underline} label="Underline (Ctrl+U)" onClick={actions.underline} />
          <ToolbarBtn icon={Strikethrough} label="Strikethrough" onClick={actions.strikethrough} />
          <ToolbarBtn icon={Highlighter} label="Highlight" onClick={actions.highlight} />

          <Divider />

          {/* Headings dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors"
            >
              <Heading1 className="w-4 h-4" />
              <span>Heading</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showHeadingMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowHeadingMenu(false)}
                />
                <div className="absolute top-full left-0 mt-1 py-1 bg-card border border-app rounded-lg shadow-xl z-50 min-w-[120px]">
                  <button onClick={() => { actions.h1(); setShowHeadingMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="text-2xl font-bold">H1</span>
                    <span className="text-muted text-sm">Heading 1</span>
                  </button>
                  <button onClick={() => { actions.h2(); setShowHeadingMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="text-xl font-bold">H2</span>
                    <span className="text-muted text-sm">Heading 2</span>
                  </button>
                  <button onClick={() => { actions.h3(); setShowHeadingMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="text-lg font-bold">H3</span>
                    <span className="text-muted text-sm">Heading 3</span>
                  </button>
                  <button onClick={() => { actions.h4(); setShowHeadingMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="text-base font-bold">H4</span>
                    <span className="text-muted text-sm">Heading 4</span>
                  </button>
                  <button onClick={() => { actions.h5(); setShowHeadingMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="text-sm font-bold">H5</span>
                    <span className="text-muted text-sm">Heading 5</span>
                  </button>
                  <button onClick={() => { actions.h6(); setShowHeadingMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="text-xs font-bold">H6</span>
                    <span className="text-muted text-sm">Heading 6</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <Divider />

          {/* Lists */}
          <ToolbarBtn icon={List} label="Bullet List" onClick={actions.bulletList} />
          <ToolbarBtn icon={ListOrdered} label="Numbered List" onClick={actions.numberedList} />
          <ToolbarBtn icon={CheckSquare} label="Task List" onClick={actions.taskList} />

          <Divider />

          {/* Block elements */}
          <ToolbarBtn icon={Quote} label="Quote" onClick={actions.quote} />
          <ToolbarBtn icon={Code} label="Inline Code" onClick={actions.codeInline} />
          <ToolbarBtn icon={FileText} label="Code Block" onClick={actions.codeBlock} />

          <Divider />

          {/* Insert dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowInsertMenu(!showInsertMenu)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors"
            >
              <Image className="w-4 h-4" />
              <span>Insert</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showInsertMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowInsertMenu(false)}
                />
                <div className="absolute top-full left-0 mt-1 py-1 bg-card border border-app rounded-lg shadow-xl z-50 min-w-[150px]">
                  <button onClick={() => { actions.link(); setShowInsertMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Link className="w-4 h-4" />
                    <span>Link</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+K</span>
                  </button>
                  <button onClick={() => { actions.image(); setShowInsertMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Image className="w-4 h-4" />
                    <span>Image</span>
                  </button>
                  <button onClick={() => { actions.table(); setShowInsertMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Table className="w-4 h-4" />
                    <span>Table</span>
                  </button>
                  <button onClick={() => { actions.horizontalRule(); setShowInsertMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Minus className="w-4 h-4" />
                    <span>Horizontal Rule</span>
                  </button>
                  <button onClick={() => { actions.lineBreak(); setShowInsertMenu(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <CornerDownLeft className="w-4 h-4" />
                    <span>Line Break</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <ToolbarBtn icon={Link} label="Link (Ctrl+K)" onClick={actions.link} />
          <ToolbarBtn icon={Table} label="Table" onClick={actions.table} />
        </div>

        {/* Quick tips bar */}
        <div className="px-3 py-1 text-xs text-muted border-t border-app bg-secondary/50">
          <span className="font-medium">Tips:</span>
          {" "}Select text then click a button to format •
          <code className="bg-app px-1 rounded mx-1">**bold**</code>
          <code className="bg-app px-1 rounded mx-1">*italic*</code>
          <code className="bg-app px-1 rounded mx-1"># Heading</code>
          <code className="bg-app px-1 rounded mx-1">- list item</code>
          <code className="bg-app px-1 rounded mx-1">[link](url)</code>
        </div>
      </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Text editor with line numbers - show in edit or split mode */}
        {(viewMode === "edit" || viewMode === "split") && (
        <div className={`${viewMode === "split" ? "w-1/2 border-r border-app" : "w-full"} flex flex-col overflow-hidden`}>
          <div className="flex-1 flex overflow-hidden">
            {/* Line numbers */}
            <div
              className="flex-shrink-0 bg-secondary/50 text-muted text-right select-none font-mono text-sm border-r border-app overflow-hidden"
              style={{ width: "3.5rem" }}
            >
              <div
                className="py-4 pr-3"
                style={{
                  transform: `translateY(-${textareaRef.current?.scrollTop || 0}px)`,
                }}
              >
                {content.split("\n").map((_, i) => (
                  <div key={i} className="leading-[1.625rem]">
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                handleChange(e);
                updateCursorPosition();
              }}
              onBlur={handleBlur}
              onClick={updateCursorPosition}
              onKeyUp={updateCursorPosition}
              onSelect={updateCursorPosition}
              onScroll={(e) => {
                // Force re-render to sync line numbers
                const target = e.target as HTMLTextAreaElement;
                const lineNumbers = target.previousElementSibling as HTMLElement;
                if (lineNumbers) {
                  const inner = lineNumbers.firstElementChild as HTMLElement;
                  if (inner) {
                    inner.style.transform = `translateY(-${target.scrollTop}px)`;
                  }
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY });
              }}
              className="flex-1 py-4 pl-4 pr-4 bg-app text-app font-mono text-sm resize-none focus:outline-none leading-[1.625rem]"
              placeholder="Start writing your markdown here..."
              spellCheck={false}
            />
          </div>
        </div>
        )}

        {/* Preview - show in split or preview mode */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div className={`${viewMode === "preview" ? "w-full" : "w-1/2"} overflow-auto p-6 bg-app`}>
            <MarkdownViewer content={content} isDark={isDark} enableLiveCode={true} />
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu(null);
              }}
            />
            <div
              className="fixed z-50 min-w-[200px] py-1 bg-card border border-app rounded-lg shadow-2xl"
              style={{
                left: Math.min(contextMenu.x, window.innerWidth - 220),
                top: Math.min(contextMenu.y, window.innerHeight - 400),
              }}
            >
              {/* Format submenu */}
              {contextMenu.submenu === "format" ? (
                <>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: undefined })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-muted text-sm"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                    <span>Back</span>
                  </button>
                  <div className="h-px bg-app my-1" />
                  <button onClick={() => { actions.bold(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Bold className="w-4 h-4" />
                    <span>Bold</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+B</span>
                  </button>
                  <button onClick={() => { actions.italic(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Italic className="w-4 h-4" />
                    <span>Italic</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+I</span>
                  </button>
                  <button onClick={() => { actions.underline(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Underline className="w-4 h-4" />
                    <span>Underline</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+U</span>
                  </button>
                  <button onClick={() => { actions.strikethrough(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Strikethrough className="w-4 h-4" />
                    <span>Strikethrough</span>
                  </button>
                  <button onClick={() => { actions.highlight(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Highlighter className="w-4 h-4" />
                    <span>Highlight</span>
                  </button>
                  <button onClick={() => { actions.codeInline(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Code className="w-4 h-4" />
                    <span>Inline Code</span>
                  </button>
                </>
              ) : contextMenu.submenu === "heading" ? (
                <>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: undefined })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-muted text-sm"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                    <span>Back</span>
                  </button>
                  <div className="h-px bg-app my-1" />
                  <button onClick={() => { actions.h1(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="w-4 text-lg font-bold">H1</span>
                    <span>Heading 1</span>
                  </button>
                  <button onClick={() => { actions.h2(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="w-4 text-base font-bold">H2</span>
                    <span>Heading 2</span>
                  </button>
                  <button onClick={() => { actions.h3(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="w-4 text-sm font-bold">H3</span>
                    <span>Heading 3</span>
                  </button>
                  <button onClick={() => { actions.h4(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="w-4 text-xs font-bold">H4</span>
                    <span>Heading 4</span>
                  </button>
                  <button onClick={() => { actions.h5(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="w-4 text-xs font-bold">H5</span>
                    <span>Heading 5</span>
                  </button>
                  <button onClick={() => { actions.h6(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <span className="w-4 text-xs font-bold">H6</span>
                    <span>Heading 6</span>
                  </button>
                </>
              ) : contextMenu.submenu === "list" ? (
                <>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: undefined })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-muted text-sm"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                    <span>Back</span>
                  </button>
                  <div className="h-px bg-app my-1" />
                  <button onClick={() => { actions.bulletList(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <List className="w-4 h-4" />
                    <span>Bullet List</span>
                  </button>
                  <button onClick={() => { actions.numberedList(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <ListOrdered className="w-4 h-4" />
                    <span>Numbered List</span>
                  </button>
                  <button onClick={() => { actions.taskList(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <CheckSquare className="w-4 h-4" />
                    <span>Task List</span>
                  </button>
                </>
              ) : contextMenu.submenu === "insert" ? (
                <>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: undefined })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-muted text-sm"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                    <span>Back</span>
                  </button>
                  <div className="h-px bg-app my-1" />
                  <button onClick={() => { actions.link(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Link className="w-4 h-4" />
                    <span>Link</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+K</span>
                  </button>
                  <button onClick={() => { actions.image(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Image className="w-4 h-4" />
                    <span>Image</span>
                  </button>
                  <button onClick={() => { actions.table(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Table className="w-4 h-4" />
                    <span>Table</span>
                  </button>
                  <button onClick={() => { actions.codeBlock(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <FileText className="w-4 h-4" />
                    <span>Code Block</span>
                  </button>
                  <button onClick={() => { actions.horizontalRule(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Minus className="w-4 h-4" />
                    <span>Horizontal Rule</span>
                  </button>
                  <button onClick={() => { actions.quote(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Quote className="w-4 h-4" />
                    <span>Blockquote</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Main context menu */}
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: "format" })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app"
                  >
                    <Bold className="w-4 h-4" />
                    <span>Format</span>
                    <ChevronDown className="w-4 h-4 ml-auto -rotate-90" />
                  </button>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: "heading" })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app"
                  >
                    <Heading1 className="w-4 h-4" />
                    <span>Heading</span>
                    <ChevronDown className="w-4 h-4 ml-auto -rotate-90" />
                  </button>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: "list" })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app"
                  >
                    <List className="w-4 h-4" />
                    <span>List</span>
                    <ChevronDown className="w-4 h-4 ml-auto -rotate-90" />
                  </button>
                  <button
                    onClick={() => setContextMenu({ ...contextMenu, submenu: "insert" })}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app"
                  >
                    <Image className="w-4 h-4" />
                    <span>Insert</span>
                    <ChevronDown className="w-4 h-4 ml-auto -rotate-90" />
                  </button>

                  <div className="h-px bg-app my-1" />

                  {/* Quick actions */}
                  <button onClick={() => { actions.bold(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Bold className="w-4 h-4" />
                    <span>Bold</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+B</span>
                  </button>
                  <button onClick={() => { actions.italic(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Italic className="w-4 h-4" />
                    <span>Italic</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+I</span>
                  </button>
                  <button onClick={() => { actions.link(); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-accent text-app">
                    <Link className="w-4 h-4" />
                    <span>Link</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+K</span>
                  </button>

                  <div className="h-px bg-app my-1" />

                  {/* Undo/Redo */}
                  <button
                    onClick={() => { undo(); setContextMenu(null); }}
                    disabled={historyIndex <= 0}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-left ${historyIndex <= 0 ? 'text-muted/50' : 'hover:bg-accent text-app'}`}
                  >
                    <Undo2 className="w-4 h-4" />
                    <span>Undo</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+Z</span>
                  </button>
                  <button
                    onClick={() => { redo(); setContextMenu(null); }}
                    disabled={historyIndex >= history.length - 1}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-left ${historyIndex >= history.length - 1 ? 'text-muted/50' : 'hover:bg-accent text-app'}`}
                  >
                    <Redo2 className="w-4 h-4" />
                    <span>Redo</span>
                    <span className="ml-auto text-muted text-xs">Ctrl+Y</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs text-muted bg-card border-t border-app">
        <div className="flex items-center gap-4">
          <span className="text-app font-medium">Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
          <span className="text-muted">|</span>
          <span>{content.length} characters</span>
          <span>{content.split(/\s+/).filter(w => w).length} words</span>
          <span>{content.split("\n").length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Markdown</span>
          <span className="text-primary">
            • {viewMode === "edit" ? "Edit" : viewMode === "split" ? "Split View" : "Preview"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default MarkdownEditor;
