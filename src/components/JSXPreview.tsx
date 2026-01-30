import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as Babel from "@babel/standalone";
import * as React from "react";
import {
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Maximize2,
  Minimize2,
  Copy,
  ExternalLink,
  Terminal,
  Info,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Variable,
} from "lucide-react";
import * as Recharts from "recharts";
import * as LucideIcons from "lucide-react";
import {
  dbSearch,
  dbGetNotes,
  dbGetNotesByTag,
  dbGetTags,
  dbGetBacklinks,
  dbGetStats,
  dbQuery,
  readFile,
  type DbNote,
  type DbStats,
} from "../hooks/useApi";
import { DataTable } from "./DataTable";

// Re-export common React hooks and utilities for use in rendered components
const ReactExports = {
  // The React object itself (needed for React.createElement in classic runtime)
  React,
  // Hooks
  useState: React.useState,
  useEffect: React.useEffect,
  useCallback: React.useCallback,
  useMemo: React.useMemo,
  useRef: React.useRef,
  useReducer: React.useReducer,
  useContext: React.useContext,
  useLayoutEffect: React.useLayoutEffect,
  useImperativeHandle: React.useImperativeHandle,
  useDebugValue: React.useDebugValue,
  useDeferredValue: React.useDeferredValue,
  useTransition: React.useTransition,
  useId: React.useId,
  useSyncExternalStore: React.useSyncExternalStore,
  useInsertionEffect: React.useInsertionEffect,
  // Context
  createContext: React.createContext,
  // Components and utilities
  Fragment: React.Fragment,
  Children: React.Children,
  cloneElement: React.cloneElement,
  createElement: React.createElement,
  createRef: React.createRef,
  isValidElement: React.isValidElement,
  memo: React.memo,
  forwardRef: React.forwardRef,
  lazy: React.lazy,
  Suspense: React.Suspense,
  StrictMode: React.StrictMode,
  Component: React.Component,
  PureComponent: React.PureComponent,
};

// ============================================================================
// Vault API - Hooks and utilities for accessing vault data from JSX pages
// ============================================================================

interface VaultNote {
  id: number;
  path: string;
  name: string;
  content: string;
  frontmatter: Record<string, unknown> | null;
  wordCount: number;
  charCount: number;
  createdAt: string;
  modifiedAt: string;
  isFavorite: boolean;
}

interface VaultStats {
  notes: number;
  tags: number;
  links: number;
  favorites: number;
  totalWords: number;
}

// Cache for vault data to avoid repeated fetches during render
const vaultCache = {
  notes: null as VaultNote[] | null,
  stats: null as VaultStats | null,
  tags: null as [string, number][] | null,
  notesByTag: new Map<string, VaultNote[]>(),
  noteContent: new Map<string, { content: string; frontmatter: Record<string, unknown> | null }>(),
  lastFetch: 0,
};

// Vault hook factory - creates hooks that work in the JSX runtime
function createVaultHooks() {
  // Hook to get all notes
  function useNotes(options?: { tag?: string; limit?: number; sort?: string }): VaultNote[] {
    const [notes, setNotes] = React.useState<VaultNote[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      async function fetchNotes() {
        try {
          let result: DbNote[];
          if (options?.tag) {
            result = await dbGetNotesByTag(options.tag);
          } else {
            result = await dbGetNotes({
              limit: options?.limit,
              sort: options?.sort,
            });
          }
          setNotes(result.map(n => ({
            id: n.id,
            path: n.path,
            name: n.name,
            content: n.content,
            frontmatter: n.frontmatter,
            wordCount: n.word_count,
            charCount: n.char_count,
            createdAt: n.created_at,
            modifiedAt: n.modified_at,
            isFavorite: n.is_favorite,
          })));
        } catch (e) {
          console.error("[Vault] Failed to fetch notes:", e);
        } finally {
          setLoading(false);
        }
      }
      fetchNotes();
    }, [options?.tag, options?.limit, options?.sort]);

    return notes;
  }

  // Hook to get a specific note by path or name
  function useNote(pathOrName: string): { note: VaultNote | null; content: string | null; loading: boolean } {
    const [note, setNote] = React.useState<VaultNote | null>(null);
    const [content, setContent] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      async function fetchNote() {
        try {
          // First try to find by name in notes
          const notes = await dbGetNotes({ filter: pathOrName, limit: 1 });
          if (notes.length > 0) {
            const n = notes[0];
            setNote({
              id: n.id,
              path: n.path,
              name: n.name,
              content: n.content,
              frontmatter: n.frontmatter,
              wordCount: n.word_count,
              charCount: n.char_count,
              createdAt: n.created_at,
              modifiedAt: n.modified_at,
              isFavorite: n.is_favorite,
            });
            setContent(n.content);
          }
        } catch (e) {
          console.error("[Vault] Failed to fetch note:", e);
        } finally {
          setLoading(false);
        }
      }
      fetchNote();
    }, [pathOrName]);

    return { note, content, loading };
  }

  // Hook to search notes
  function useSearch(query: string, limit = 20): VaultNote[] {
    const [results, setResults] = React.useState<VaultNote[]>([]);

    React.useEffect(() => {
      if (!query || query.length < 2) {
        setResults([]);
        return;
      }

      async function search() {
        try {
          const searchResults = await dbSearch(query, limit);
          // Convert search results to notes
          const notes = await Promise.all(
            searchResults.map(async (r) => {
              const noteList = await dbGetNotes({ filter: r.name, limit: 1 });
              return noteList[0];
            })
          );
          setResults(notes.filter(Boolean).map(n => ({
            id: n.id,
            path: n.path,
            name: n.name,
            content: n.content,
            frontmatter: n.frontmatter,
            wordCount: n.word_count,
            charCount: n.char_count,
            createdAt: n.created_at,
            modifiedAt: n.modified_at,
            isFavorite: n.is_favorite,
          })));
        } catch (e) {
          console.error("[Vault] Search failed:", e);
        }
      }
      search();
    }, [query, limit]);

    return results;
  }

  // Hook to get vault statistics
  function useStats(): VaultStats | null {
    const [stats, setStats] = React.useState<VaultStats | null>(null);

    React.useEffect(() => {
      async function fetchStats() {
        try {
          const s = await dbGetStats();
          setStats({
            notes: s.notes,
            tags: s.tags,
            links: s.links,
            favorites: s.favorites,
            totalWords: s.total_words,
          });
        } catch (e) {
          console.error("[Vault] Failed to fetch stats:", e);
        }
      }
      fetchStats();
    }, []);

    return stats;
  }

  // Hook to get all tags with counts
  function useTags(): Array<{ tag: string; count: number }> {
    const [tags, setTags] = React.useState<Array<{ tag: string; count: number }>>([]);

    React.useEffect(() => {
      async function fetchTags() {
        try {
          const tagList = await dbGetTags();
          setTags(tagList.map(([tag, count]) => ({ tag, count })));
        } catch (e) {
          console.error("[Vault] Failed to fetch tags:", e);
        }
      }
      fetchTags();
    }, []);

    return tags;
  }

  // Hook to get backlinks for a note
  function useBacklinks(noteName: string): VaultNote[] {
    const [backlinks, setBacklinks] = React.useState<VaultNote[]>([]);

    React.useEffect(() => {
      async function fetchBacklinks() {
        try {
          const links = await dbGetBacklinks(noteName);
          setBacklinks(links.map(n => ({
            id: n.id,
            path: n.path,
            name: n.name,
            content: n.content,
            frontmatter: n.frontmatter,
            wordCount: n.word_count,
            charCount: n.char_count,
            createdAt: n.created_at,
            modifiedAt: n.modified_at,
            isFavorite: n.is_favorite,
          })));
        } catch (e) {
          console.error("[Vault] Failed to fetch backlinks:", e);
        }
      }
      if (noteName) fetchBacklinks();
    }, [noteName]);

    return backlinks;
  }

  // Hook to run a custom SQL query
  function useQuery<T = Record<string, unknown>>(sql: string): { data: T[]; loading: boolean; error: Error | null } {
    const [data, setData] = React.useState<T[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
      async function runQuery() {
        try {
          const result = await dbQuery(sql);
          setData(result.notes as T[]);
          setError(null);
        } catch (e) {
          console.error("[Vault] Query failed:", e);
          setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
          setLoading(false);
        }
      }
      if (sql) runQuery();
    }, [sql]);

    return { data, loading, error };
  }

  return {
    useNotes,
    useNote,
    useSearch,
    useStats,
    useTags,
    useBacklinks,
    useQuery,
  };
}

// Create the vault hooks instance
const VaultHooks = createVaultHooks();

// Vault object exposed to JSX pages
const Vault = {
  ...VaultHooks,
  // Helper to parse YAML frontmatter from content
  parseFrontmatter: (content: string): { frontmatter: Record<string, unknown>; body: string } => {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };
    try {
      // Simple YAML parsing for common cases
      const yaml = match[1];
      const frontmatter: Record<string, unknown> = {};
      yaml.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let value: unknown = line.slice(colonIdx + 1).trim();
          // Parse arrays like [item1, item2]
          if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(s => s.trim());
          }
          // Parse numbers
          else if (typeof value === 'string' && !isNaN(Number(value))) {
            value = Number(value);
          }
          // Parse booleans
          else if (value === 'true') value = true;
          else if (value === 'false') value = false;
          frontmatter[key] = value;
        }
      });
      return { frontmatter, body: match[2] };
    } catch {
      return { frontmatter: {}, body: content };
    }
  },
  // Helper to extract data from multiple notes
  aggregate: <T,>(notes: VaultNote[], extractor: (note: VaultNote) => T): T[] => {
    return notes.map(extractor);
  },
  // Helper to group notes by a frontmatter field
  groupBy: (notes: VaultNote[], field: string): Record<string, VaultNote[]> => {
    const groups: Record<string, VaultNote[]> = {};
    notes.forEach(note => {
      const value = String(note.frontmatter?.[field] || 'undefined');
      if (!groups[value]) groups[value] = [];
      groups[value].push(note);
    });
    return groups;
  },
  // Helper to sum a numeric field from frontmatter
  sum: (notes: VaultNote[], field: string): number => {
    return notes.reduce((acc, note) => {
      const val = note.frontmatter?.[field];
      return acc + (typeof val === 'number' ? val : 0);
    }, 0);
  },
  // Helper to calculate average
  avg: (notes: VaultNote[], field: string): number => {
    const values = notes
      .map(n => n.frontmatter?.[field])
      .filter((v): v is number => typeof v === 'number');
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  },
};

interface JSXPreviewProps {
  code: string;
  autoRun?: boolean;
  onError?: (error: Error | null) => void;
  isDark?: boolean;
}

interface TranspileResult {
  code: string | null;
  error: Error | null;
}

// Strip import statements since we provide React through scope
function stripImports(code: string): string {
  // Remove import statements for react (we inject these)
  // Matches: import { useState, useEffect } from "react";
  // Matches: import React from "react";
  // Matches: import * as React from "react";
  // Matches: import React, { useState } from "react";
  const lines = code.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    // Check if this line is a react import
    if (trimmed.startsWith('import ') && (trimmed.includes('"react"') || trimmed.includes("'react'"))) {
      return '// [import removed - React provided by runtime]';
    }
    return line;
  });
  return processedLines.join('\n');
}

// Transpile JSX/TSX code using Babel
function transpileCode(code: string): TranspileResult {
  try {
    // Strip React imports since we provide them through scope
    let processedCode = stripImports(code);

    console.log("[JSXPreview] Code after stripping imports:", processedCode);

    // Check if there's a default export or we need to wrap it
    const hasDefaultExport = /export\s+default/.test(processedCode);
    const hasNamedExport = /export\s+(const|function|class|let|var)/.test(processedCode);

    if (!hasDefaultExport && !hasNamedExport) {
      // Assume the code is just JSX to render directly
      processedCode = `export default function Page() {\n  return (\n${processedCode}\n  );\n}`;
    }

    console.log("[JSXPreview] Code before Babel transform:", processedCode);

    const result = Babel.transform(processedCode, {
      presets: [
        ["react", { runtime: "classic" }],
        ["typescript", { isTSX: true, allExtensions: true }],
      ],
      plugins: [
        // Transform ES modules to CommonJS so exports work in our function wrapper
        "transform-modules-commonjs",
      ],
      filename: "component.tsx",
    });

    console.log("[JSXPreview] Babel output:", result.code);

    return { code: result.code || null, error: null };
  } catch (e) {
    console.error("[JSXPreview] Babel transpilation error:", e);
    return { code: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// Error Boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void; resetKey?: number },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode; onError: (error: Error) => void; resetKey?: number }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
    this.setState({ errorInfo });
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: { resetKey?: number }) {
    // Reset error state when resetKey changes
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Render Error</span>
          </div>
          <pre className="text-sm text-red-300 whitespace-pre-wrap mb-2">
            {this.state.error?.message}
          </pre>
          {this.state.error?.stack && (
            <details className="mt-2">
              <summary className="text-red-400 text-xs cursor-pointer">Stack trace</summary>
              <pre className="text-xs text-red-300/70 whitespace-pre-wrap mt-1">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Execute transpiled code and return the component
function executeCode(
  transpiledCode: string,
  scope: Record<string, unknown>
): React.ComponentType | null {
  try {
    // Debug: log the transpiled code
    console.log("[JSXPreview] Transpiled code:", transpiledCode);
    console.log("[JSXPreview] Scope keys:", Object.keys(scope));

    // Build destructuring statement for scope variables
    const scopeKeys = Object.keys(scope).filter(k => k !== 'exports');
    const destructureStatement = `const { ${scopeKeys.join(', ')} } = __scope__;`;

    // Build the execution function with proper exports handling
    // We pass the entire scope as a single object and destructure inside
    const wrappedCode = `
      "use strict";
      ${destructureStatement}
      var exports = {};
      var module = { exports: exports };

      ${transpiledCode}

      return exports.default || module.exports.default || null;
    `;

    console.log("[JSXPreview] Wrapped code:", wrappedCode);

    // Create and execute the function with scope as single parameter
    const execFn = new Function('__scope__', wrappedCode);
    const Component = execFn(scope);

    if (!Component) {
      console.warn("[JSXPreview] No component returned from code execution");
      console.warn("[JSXPreview] exports object:", "Check console for more details");
    }

    return Component;
  } catch (e) {
    console.error("[JSXPreview] Execution error:", e);
    console.error("[JSXPreview] Transpiled code was:", transpiledCode);
    throw e; // Re-throw so we can display the error
  }
}

// Console log entry type
interface ConsoleEntry {
  id: number;
  type: "log" | "warn" | "error" | "info";
  args: unknown[];
  timestamp: Date;
}

// Variable inspector entry
interface InspectorEntry {
  name: string;
  value: unknown;
  type: string;
}

export function JSXPreview({ code, autoRun = true, onError, isDark = true }: JSXPreviewProps) {
  const [isRunning, setIsRunning] = useState(autoRun);
  const [transpileResult, setTranspileResult] = useState<TranspileResult>({ code: null, error: null });
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Console output state
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorData, setInspectorData] = useState<InspectorEntry[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const consoleIdRef = useRef(0);

  // Transpile code when it changes
  useEffect(() => {
    if (code.trim()) {
      const result = transpileCode(code);
      setTranspileResult(result);
      setRuntimeError(null);

      if (result.error && onError) {
        onError(result.error);
      }
    } else {
      setTranspileResult({ code: null, error: null });
    }
  }, [code, onError]);

  // Create a captured console that logs to our state
  const capturedConsole = useMemo(() => {
    const createLogger = (type: ConsoleEntry["type"]) => (...args: unknown[]) => {
      // Also log to real console
      console[type]("[Preview]", ...args);
      // Capture to state
      const entry: ConsoleEntry = {
        id: consoleIdRef.current++,
        type,
        args,
        timestamp: new Date(),
      };
      setConsoleLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
    };

    return {
      log: createLogger("log"),
      info: createLogger("info"),
      warn: createLogger("warn"),
      error: createLogger("error"),
      clear: () => setConsoleLogs([]),
    };
  }, []);

  // Create scope for executed code - includes theme info, Vault API, and charting
  const scope = useMemo(() => ({
    ...ReactExports,
    // Theme utilities for rendered components
    isDark,
    theme: isDark ? "dark" : "light",
    // CSS class helpers
    themeClass: (lightClass: string, darkClass: string) => isDark ? darkClass : lightClass,

    // Vault API - access notes, tags, search, stats, and more
    Vault,

    // Recharts - all charting components for data visualization
    ...Recharts,
    // Also provide as namespace for explicit access
    Recharts,

    // Lucide icons - all icons available
    Icons: LucideIcons,
    // Spread common icons for direct use
    ...LucideIcons,

    // DataTable for tabular data display
    DataTable,

    exports: {} as Record<string, unknown>,
    console: capturedConsole,
  }), [isDark, capturedConsole]);

  // Get the component to render
  const [RenderedComponent, execError] = useMemo<[React.ComponentType | null, Error | null]>(() => {
    if (!isRunning || !transpileResult.code) return [null, null];

    try {
      const Component = executeCode(transpileResult.code, scope);
      return [Component, null];
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return [null, error];
    }
  }, [transpileResult.code, scope, isRunning, renderKey]);

  // Update runtime error when execution fails
  useEffect(() => {
    if (execError) {
      setRuntimeError(execError);
    }
  }, [execError]);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setRuntimeError(null);
    setConsoleLogs([]); // Clear console on new run
    setRenderKey((k) => k + 1);
  }, []);

  // Clear console
  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  // Format value for display
  const formatValue = (value: unknown, depth = 0): string => {
    if (depth > 3) return "...";
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      if (depth > 1) return `Array(${value.length})`;
      return `[${value.slice(0, 5).map(v => formatValue(v, depth + 1)).join(", ")}${value.length > 5 ? ", ..." : ""}]`;
    }
    if (typeof value === "object") {
      const keys = Object.keys(value);
      if (keys.length === 0) return "{}";
      if (depth > 1) return `Object(${keys.length})`;
      return `{ ${keys.slice(0, 3).map(k => `${k}: ${formatValue((value as Record<string, unknown>)[k], depth + 1)}`).join(", ")}${keys.length > 3 ? ", ..." : ""} }`;
    }
    return String(value);
  };

  // Get console entry icon
  const getConsoleIcon = (type: ConsoleEntry["type"]) => {
    switch (type) {
      case "info": return <Info className="w-3.5 h-3.5 text-blue-400" />;
      case "warn": return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
      case "error": return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return <ChevronRight className="w-3.5 h-3.5 text-muted" />;
    }
  };

  const handleRefresh = useCallback(() => {
    setRuntimeError(null);
    setRenderKey((k) => k + 1);
  }, []);

  const handleRuntimeError = useCallback((error: Error) => {
    setRuntimeError(error);
    if (onError) onError(error);
  }, [onError]);

  const hasError = transpileResult.error || runtimeError;
  const errorMessage = transpileResult.error?.message || runtimeError?.message;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full ${
        isFullscreen ? "fixed inset-0 z-50 bg-app" : ""
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
        <div className="flex items-center gap-2">
          {hasError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Error</span>
            </div>
          ) : isRunning ? (
            <div className="flex items-center gap-2 text-chart-3">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Running</span>
            </div>
          ) : (
            <span className="text-sm text-muted">Ready</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-chart-3 text-white rounded-lg hover:opacity-90 transition-colors"
            title="Run code"
          >
            <Play className="w-4 h-4" />
            Run
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-app mx-1" />

          {/* Console toggle */}
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg transition-colors ${
              showConsole ? "bg-primary text-white" : "text-muted hover:text-app hover:bg-accent"
            }`}
            title="Toggle Console"
          >
            <Terminal className="w-4 h-4" />
            {consoleLogs.length > 0 && (
              <span className={`text-xs px-1.5 rounded-full ${showConsole ? "bg-white/20" : "bg-muted"}`}>
                {consoleLogs.length}
              </span>
            )}
          </button>

          {/* Inspector toggle */}
          <button
            onClick={() => setShowInspector(!showInspector)}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg transition-colors ${
              showInspector ? "bg-primary text-white" : "text-muted hover:text-app hover:bg-accent"
            }`}
            title="Toggle Variable Inspector"
          >
            <Eye className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-app mx-1" />

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-app">
        {hasError ? (
          <div className="p-6">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
              <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertCircle className="w-6 h-6" />
                <span className="text-lg font-semibold">
                  {transpileResult.error ? "Transpile Error" : "Runtime Error"}
                </span>
              </div>
              <pre className="text-sm text-destructive whitespace-pre-wrap font-mono bg-destructive/5 p-4 rounded-lg overflow-auto">
                {errorMessage}
              </pre>
            </div>
          </div>
        ) : !isRunning ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto mb-4 text-muted opacity-50" />
              <p className="text-lg text-muted">Click "Run" to preview your component</p>
              <p className="text-sm text-muted mt-2">Or enable auto-run in settings</p>
            </div>
          </div>
        ) : RenderedComponent ? (
          <div className={`p-6 ${isDark ? "dark" : "light"}`}>
            <ErrorBoundary key={renderKey} resetKey={renderKey} onError={handleRuntimeError}>
              <RenderedComponent />
            </ErrorBoundary>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-app border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Console Panel */}
      {showConsole && (
        <div className="h-48 border-t border-app bg-card flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-app bg-secondary">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted" />
              <span className="text-sm font-medium text-app">Console</span>
              <span className="text-xs text-muted">({consoleLogs.length} entries)</span>
            </div>
            <button
              onClick={handleClearConsole}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Clear console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto font-mono text-xs">
            {consoleLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted">
                Console output will appear here
              </div>
            ) : (
              consoleLogs.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-2 px-3 py-1 border-b border-app/50 hover:bg-accent/50 ${
                    entry.type === "error" ? "bg-red-500/10" :
                    entry.type === "warn" ? "bg-yellow-500/10" : ""
                  }`}
                >
                  <span className="mt-0.5 flex-shrink-0">{getConsoleIcon(entry.type)}</span>
                  <span className="flex-1 text-app whitespace-pre-wrap break-all">
                    {entry.args.map((arg, i) => (
                      <span key={i}>
                        {i > 0 && " "}
                        <span className={
                          typeof arg === "string" ? "text-green-400" :
                          typeof arg === "number" ? "text-blue-400" :
                          typeof arg === "boolean" ? "text-purple-400" :
                          arg === null || arg === undefined ? "text-muted" :
                          "text-app"
                        }>
                          {formatValue(arg)}
                        </span>
                      </span>
                    ))}
                  </span>
                  <span className="text-muted text-[10px] flex-shrink-0">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Variable Inspector Panel */}
      {showInspector && (
        <div className="h-48 border-t border-app bg-card flex flex-col">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-app bg-secondary">
            <Eye className="w-4 h-4 text-muted" />
            <span className="text-sm font-medium text-app">Inspector</span>
          </div>
          <div className="flex-1 overflow-auto p-3 font-mono text-xs">
            <div className="space-y-2">
              <div className="text-muted mb-2">Available in scope:</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-secondary rounded">
                  <span className="text-primary font-medium">Vault</span>
                  <div className="text-muted mt-1">
                    useNotes, useNote, useSearch, useTags, useStats, useBacklinks, useQuery
                  </div>
                </div>
                <div className="p-2 bg-secondary rounded">
                  <span className="text-primary font-medium">Recharts</span>
                  <div className="text-muted mt-1">
                    LineChart, BarChart, PieChart, AreaChart, XAxis, YAxis, Tooltip, Legend
                  </div>
                </div>
                <div className="p-2 bg-secondary rounded">
                  <span className="text-primary font-medium">Icons</span>
                  <div className="text-muted mt-1">
                    500+ Lucide icons (Icons.FileText, Icons.Folder, etc.)
                  </div>
                </div>
                <div className="p-2 bg-secondary rounded">
                  <span className="text-primary font-medium">React</span>
                  <div className="text-muted mt-1">
                    useState, useEffect, useMemo, useCallback, useRef
                  </div>
                </div>
                <div className="p-2 bg-secondary rounded">
                  <span className="text-primary font-medium">Theme</span>
                  <div className="text-muted mt-1">
                    isDark: {isDark ? "true" : "false"}, theme: "{isDark ? "dark" : "light"}"
                  </div>
                </div>
                <div className="p-2 bg-secondary rounded">
                  <span className="text-primary font-medium">DataTable</span>
                  <div className="text-muted mt-1">
                    Rich table component with sorting, filtering, pagination
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info bar */}
      <div className="px-4 py-2 bg-card border-t border-app text-xs text-muted overflow-x-auto">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-primary font-medium">Vault:</span>
          <span>useNotes, useNote, useSearch, useTags, useStats, useBacklinks, useQuery, groupBy, sum, avg</span>
          <span className="text-primary font-medium">Charts:</span>
          <span>LineChart, BarChart, PieChart, AreaChart, etc.</span>
          <span className="text-primary font-medium">Icons:</span>
          <span>Icons.* (500+ icons)</span>
          <span className="text-primary font-medium">DataTable:</span>
          <span>Rich table component</span>
        </div>
      </div>
    </div>
  );
}

export default JSXPreview;
