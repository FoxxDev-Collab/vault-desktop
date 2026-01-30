import { useEffect, useRef, useState } from "react";
import {
  FileText,
  MonitorPlay,
  LayoutDashboard,
  Kanban,
  FileCode,
  FileJson,
} from "lucide-react";

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ title, isOpen, onClose, children, footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-app"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app">
          <h2 className="text-lg font-semibold text-app">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 bg-muted/50 border-t border-app flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface InputModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
}

export function InputModal({
  title,
  isOpen,
  onClose,
  onSubmit,
  placeholder = "",
  initialValue = "",
  submitLabel = "Create",
}: InputModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      onSubmit(value);
      onClose();
    }
  };

  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-app transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-lg transition-colors"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          defaultValue={initialValue}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-app border border-input rounded-lg text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </form>
    </Modal>
  );
}

interface ConfirmModalProps {
  title: string;
  message: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({
  title,
  message,
  isOpen,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  danger = false,
}: ConfirmModalProps) {
  return (
    <Modal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-app transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm text-destructive-foreground rounded-lg transition-colors ${
              danger
                ? "bg-destructive hover:opacity-90"
                : "bg-primary hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-muted">{message}</p>
    </Modal>
  );
}

// File type templates
export type FileTypeOption = {
  id: string;
  name: string;
  extension: string;
  icon: React.ReactNode;
  description: string;
  template: string;
};

export const FILE_TYPE_OPTIONS: FileTypeOption[] = [
  {
    id: "note",
    name: "Note",
    extension: ".md",
    icon: <FileText className="w-5 h-5" />,
    description: "Markdown document for notes and documentation",
    template: "# New Note\n\n",
  },
  {
    id: "page",
    name: "Live Page",
    extension: ".page.tsx",
    icon: <MonitorPlay className="w-5 h-5" />,
    description: "Interactive JSX/TSX page with live preview",
    template: `import { useState } from "react";

export default function Page() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">
        My Page
      </h1>
      <p className="text-gray-400 mb-4">
        Edit this code and see the changes live!
      </p>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
      >
        Clicked {count} times
      </button>
    </div>
  );
}
`,
  },
  {
    id: "dashboard",
    name: "Dashboard",
    extension: ".dashboard.json",
    icon: <LayoutDashboard className="w-5 h-5" />,
    description: "Data visualization with charts and widgets",
    template: JSON.stringify({
      title: "New Dashboard",
      widgets: [
        { type: "stat", title: "Total", value: 0, color: "blue" },
        { type: "stat", title: "Active", value: 0, color: "green" },
      ],
      charts: [
        {
          type: "line",
          title: "Trend",
          data: [
            { name: "Jan", value: 0 },
            { name: "Feb", value: 0 },
            { name: "Mar", value: 0 },
          ],
        },
      ],
    }, null, 2),
  },
  {
    id: "kanban",
    name: "Kanban Board",
    extension: ".kanban.json",
    icon: <Kanban className="w-5 h-5" />,
    description: "Task board with drag-and-drop columns",
    template: JSON.stringify({
      title: "New Board",
      columns: [
        { id: "todo", title: "To Do", cards: [] },
        { id: "in-progress", title: "In Progress", cards: [] },
        { id: "done", title: "Done", cards: [] },
      ],
    }, null, 2),
  },
  {
    id: "typescript",
    name: "TypeScript",
    extension: ".ts",
    icon: <FileCode className="w-5 h-5 text-blue-400" />,
    description: "TypeScript source file",
    template: `// TypeScript file

export function main() {
  console.log("Hello, world!");
}
`,
  },
  {
    id: "react",
    name: "React Component",
    extension: ".tsx",
    icon: <FileCode className="w-5 h-5 text-cyan-400" />,
    description: "React component with TypeScript",
    template: `import { useState } from "react";

interface Props {
  title?: string;
}

export function Component({ title = "Component" }: Props) {
  const [state, setState] = useState(false);

  return (
    <div>
      <h2>{title}</h2>
      <button onClick={() => setState(!state)}>
        Toggle: {state ? "On" : "Off"}
      </button>
    </div>
  );
}

export default Component;
`,
  },
  {
    id: "json",
    name: "JSON",
    extension: ".json",
    icon: <FileJson className="w-5 h-5 text-yellow-400" />,
    description: "JSON data file",
    template: `{
  "name": "",
  "data": []
}
`,
  },
];

interface CreateFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, content: string) => void;
  folder: string;
}

export function CreateFileModal({
  isOpen,
  onClose,
  onSubmit,
  folder,
}: CreateFileModalProps) {
  const [selectedType, setSelectedType] = useState<FileTypeOption>(FILE_TYPE_OPTIONS[0]);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileName("");
      setSelectedType(FILE_TYPE_OPTIONS[0]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    // Add extension if not present
    let finalName = fileName.trim();
    if (!finalName.endsWith(selectedType.extension)) {
      // Remove any existing extension first
      const parts = finalName.split(".");
      if (parts.length > 1 && parts[parts.length - 1].length < 6) {
        parts.pop();
        finalName = parts.join(".");
      }
      finalName += selectedType.extension;
    }

    onSubmit(finalName, selectedType.template);
    onClose();
  };

  return (
    <Modal
      title="Create New File"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-app transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!fileName.trim()}
            className="px-4 py-2 text-sm bg-primary hover:opacity-90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File name input */}
        <div>
          <label className="block text-sm font-medium text-app mb-2">
            File Name
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="my-file"
              className="flex-1 px-4 py-2.5 bg-app border border-input rounded-lg text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <span className="px-3 py-2.5 bg-secondary text-muted rounded-lg text-sm font-mono">
              {selectedType.extension}
            </span>
          </div>
          {folder && (
            <p className="mt-1.5 text-xs text-muted">
              Location: {folder}/
            </p>
          )}
        </div>

        {/* File type selector */}
        <div>
          <label className="block text-sm font-medium text-app mb-2">
            File Type
          </label>
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {FILE_TYPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedType(option)}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  selectedType.id === option.id
                    ? "border-primary bg-primary/10"
                    : "border-app hover:border-muted hover:bg-accent"
                }`}
              >
                <div className={`mt-0.5 ${selectedType.id === option.id ? "text-primary" : "text-muted"}`}>
                  {option.icon}
                </div>
                <div className="min-w-0">
                  <div className={`font-medium text-sm ${selectedType.id === option.id ? "text-primary" : "text-app"}`}>
                    {option.name}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default Modal;
