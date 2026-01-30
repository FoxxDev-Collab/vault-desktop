import { Copy, WrapText, Sparkles, Check } from "lucide-react";
import { useState, useCallback } from "react";

export interface EditorToolbarProps {
  onFormat?: () => void;
  onCopy?: () => void;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  language?: string;
  canFormat?: boolean;
}

// Languages that support formatting
const FORMATTABLE_LANGUAGES = ["json", "html", "xml", "javascript", "typescript", "css", "scss", "less"];

export function EditorToolbar({
  onFormat,
  onCopy,
  wordWrap,
  onToggleWordWrap,
  language = "plaintext",
  canFormat,
}: EditorToolbarProps) {
  const [copied, setCopied] = useState(false);

  // Determine if this language supports formatting
  const isFormattable = canFormat ?? FORMATTABLE_LANGUAGES.includes(language.toLowerCase());

  const handleCopy = useCallback(() => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-card border-b border-app">
      {/* Format button */}
      {isFormattable && onFormat && (
        <button
          onClick={onFormat}
          title="Format code (Shift+Alt+F)"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted hover:text-app hover:bg-accent rounded transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Format</span>
        </button>
      )}

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy to clipboard"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted hover:text-app hover:bg-accent rounded transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-500">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-border mx-1" />

      {/* Word wrap toggle */}
      <button
        onClick={onToggleWordWrap}
        title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
          wordWrap
            ? "bg-primary/10 text-primary"
            : "text-muted hover:text-app hover:bg-accent"
        }`}
      >
        <WrapText className="w-3.5 h-3.5" />
        <span>Wrap</span>
      </button>

      {/* Language indicator */}
      <div className="ml-auto text-xs text-muted/60 uppercase">
        {language}
      </div>
    </div>
  );
}

export default EditorToolbar;
