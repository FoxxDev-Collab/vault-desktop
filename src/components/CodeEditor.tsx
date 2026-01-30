import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import Editor from "@monaco-editor/react";
import type { editor, Monaco } from "monaco-editor";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: "vs-dark" | "vs" | "vault-dark" | "vault-light";
  isDark?: boolean;
  readOnly?: boolean;
  wordWrap?: boolean;
}

// Exposed methods via ref
export interface CodeEditorHandle {
  format: () => void;
  copy: () => void;
  getValue: () => string;
}

// Map file extensions to Monaco language IDs
export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    ps1: "powershell",
    dockerfile: "dockerfile",
    makefile: "makefile",
    toml: "toml",
    ini: "ini",
    conf: "ini",
    env: "ini",
    graphql: "graphql",
    gql: "graphql",
    vue: "vue",
    svelte: "svelte",
    astro: "astro",
    prisma: "prisma",
  };
  return languageMap[ext] || "plaintext";
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    value,
    onChange,
    language = "plaintext",
    theme,
    isDark = true,
    readOnly = false,
    wordWrap = true,
  },
  ref
) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    format: () => {
      if (editorRef.current) {
        editorRef.current.getAction("editor.action.formatDocument")?.run();
      }
    },
    copy: () => {
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        const model = editorRef.current.getModel();
        if (model) {
          // If there's a selection, copy selection; otherwise copy all
          const text = selection && !selection.isEmpty()
            ? model.getValueInRange(selection)
            : model.getValue();
          navigator.clipboard.writeText(text);
        }
      }
    },
    getValue: () => {
      return editorRef.current?.getModel()?.getValue() || "";
    },
  }), []);

  // Determine effective theme
  const effectiveTheme = theme || (isDark ? "vault-dark" : "vault-light");

  const handleEditorDidMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editorInstance;

    // Configure editor settings
    editorInstance.updateOptions({
      // Line numbers
      lineNumbers: "on",
      lineNumbersMinChars: 4,
      lineDecorationsWidth: 10,
      renderLineHighlight: "all",
      renderLineHighlightOnlyWhenFocus: false,

      // Font settings
      fontSize: 14,
      lineHeight: 22,
      fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', Consolas, monospace",
      fontLigatures: true,
      fontWeight: "400",

      // Editor behavior
      tabSize: 2,
      insertSpaces: true,
      wordWrap: wordWrap ? "on" : "off",
      wrappingIndent: "indent",
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      autoSurround: "languageDefined",
      formatOnPaste: true,
      formatOnType: true,

      // Visual enhancements
      minimap: {
        enabled: true,
        maxColumn: 80,
        renderCharacters: false,
        showSlider: "mouseover",
      },
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      cursorStyle: "line",
      cursorWidth: 2,

      // Layout
      automaticLayout: true,
      padding: { top: 16, bottom: 16 },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false,
        alwaysConsumeMouseWheel: false,
      },
      mouseWheelScrollSensitivity: 1,
      fastScrollSensitivity: 5,

      // Code intelligence
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        bracketPairsHorizontal: true,
        highlightActiveBracketPair: true,
        indentation: true,
        highlightActiveIndentation: true,
      },

      // Folding
      folding: true,
      foldingStrategy: "indentation",
      showFoldingControls: "mouseover",

      // Suggestions
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      acceptSuggestionOnEnter: "on",

      // Find/Replace
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: "multiline",
        seedSearchStringFromSelection: "selection",
      },
    });

    // Define custom theme that matches our app
    monaco.editor.defineTheme("vault-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "C586C0" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "type", foreground: "4EC9B0" },
        { token: "function", foreground: "DCDCAA" },
        { token: "variable", foreground: "9CDCFE" },
      ],
      colors: {
        "editor.background": "#1a1d24",
        "editor.foreground": "#D4D4D4",
        "editor.lineHighlightBackground": "#2a2d35",
        "editor.selectionBackground": "#264F78",
        "editorCursor.foreground": "#AEAFAD",
        "editorWhitespace.foreground": "#3B3B3B",
        "editorIndentGuide.background1": "#404040",
        "editorIndentGuide.activeBackground1": "#707070",
        "editor.selectionHighlightBackground": "#ADD6FF26",
      },
    });

    monaco.editor.defineTheme("vault-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "008000", fontStyle: "italic" },
        { token: "keyword", foreground: "AF00DB" },
        { token: "string", foreground: "A31515" },
        { token: "number", foreground: "098658" },
        { token: "type", foreground: "267F99" },
        { token: "function", foreground: "795E26" },
        { token: "variable", foreground: "001080" },
      ],
      colors: {
        "editor.background": "#FAFAFA",
        "editor.foreground": "#1E1E1E",
        "editor.lineHighlightBackground": "#F0F0F0",
        "editor.selectionBackground": "#ADD6FF",
        "editorCursor.foreground": "#000000",
        "editorWhitespace.foreground": "#CCCCCC",
        "editorIndentGuide.background1": "#D3D3D3",
        "editorIndentGuide.activeBackground1": "#939393",
      },
    });

    // Apply theme
    monaco.editor.setTheme(effectiveTheme);

    // Add keyboard shortcuts
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Trigger save - handled by parent
    });
  };

  const handleChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      onChange(newValue);
    }
  };

  // Update theme when it changes
  useEffect(() => {
    if (editorRef.current) {
      import("monaco-editor").then((monaco) => {
        monaco.editor.setTheme(effectiveTheme);
      });
    }
  }, [effectiveTheme]);

  // Update word wrap when it changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        wordWrap: wordWrap ? "on" : "off",
      });
    }
  }, [wordWrap]);

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={effectiveTheme}
        options={{
          readOnly,
          domReadOnly: readOnly,
          scrollBeyondLastLine: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-app">
            <div className="w-8 h-8 border-4 border-app border-t-primary rounded-full animate-spin" />
          </div>
        }
      />
    </div>
  );
});

export default CodeEditor;
