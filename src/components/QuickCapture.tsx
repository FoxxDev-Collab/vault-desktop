import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, FileText, CheckSquare, X } from "lucide-react";
import { quickCapture } from "../hooks/useApi";

interface QuickCaptureProps {
  onCaptured?: (path: string) => void;
  onError?: (error: string) => void;
  placeholder?: string;
  className?: string;
}

export function QuickCapture({
  onCaptured,
  onError,
  placeholder = "Quick capture... (Enter to save, Ctrl+Enter for task)",
  className = "",
}: QuickCaptureProps) {
  const [content, setContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleCapture = useCallback(
    async (asTask: boolean) => {
      if (!content.trim()) return;

      setIsLoading(true);
      try {
        const path = await quickCapture(content.trim(), asTask);
        setContent("");
        setIsExpanded(false);
        onCaptured?.(path);
      } catch (e) {
        onError?.(String(e));
      } finally {
        setIsLoading(false);
      }
    },
    [content, onCaptured, onError]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleCapture(e.ctrlKey || e.metaKey);
      } else if (e.key === "Escape") {
        setContent("");
        setIsExpanded(false);
        inputRef.current?.blur();
      }
    },
    [handleCapture]
  );

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex flex-col gap-2 p-2 rounded-lg border transition-all ${
          isExpanded
            ? "border-primary bg-card shadow-lg"
            : "border-transparent hover:border-app bg-secondary/50"
        }`}
      >
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsExpanded(true)}
          placeholder={placeholder}
          rows={isExpanded ? 3 : 1}
          disabled={isLoading}
          className={`w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted ${
            isExpanded ? "min-h-[72px]" : "min-h-[24px]"
          }`}
        />

        {isExpanded && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-app">
            <div className="flex items-center gap-1 text-xs text-muted">
              <span>Enter: Note</span>
              <span className="mx-1">|</span>
              <span>Ctrl+Enter: Task</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCapture(false)}
                disabled={!content.trim() || isLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Save as note"
              >
                <FileText className="w-3 h-3" />
                Note
              </button>
              <button
                onClick={() => handleCapture(true)}
                disabled={!content.trim() || isLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Save as task"
              >
                <CheckSquare className="w-3 h-3" />
                Task
              </button>
              <button
                onClick={() => {
                  setContent("");
                  setIsExpanded(false);
                }}
                className="p-1 text-muted hover:text-app rounded transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickCapture;
