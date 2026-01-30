import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Save,
  X,
  Edit3,
  Eye,
  FileSpreadsheet,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Filter,
  Download,
  Copy,
  Check,
  Undo2,
  Redo2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface SpreadsheetEditorProps {
  content: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  isDirty?: boolean;
  isSaving?: boolean;
  fileName?: string;
  onClose?: () => void;
  lastSaved?: Date | null;
  readOnly?: boolean;
}

type SortDirection = "asc" | "desc" | null;

interface HistoryEntry {
  data: string[][];
}

// Parse CSV content
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
        if (char === "\r") i++;
      } else if (char !== "\r") {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Convert to CSV string
function toCSV(data: string[][]): string {
  return data
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    )
    .join("\n");
}

export function SpreadsheetEditor({
  content,
  onChange,
  onSave,
  isDirty = false,
  isSaving = false,
  fileName,
  onClose,
  lastSaved,
  readOnly = false,
}: SpreadsheetEditorProps) {
  // Parse data
  const initialData = useMemo(() => parseCSV(content), [content]);
  const [data, setData] = useState<string[][]>(initialData);
  const headers = data[0] || [];
  const rows = data.slice(1);

  // History for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([{ data: initialData }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // View mode
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  // Table state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);

  const pageSize = 50;

  // Update data when content changes
  useEffect(() => {
    const newData = parseCSV(content);
    setData(newData);
  }, [content]);

  // Save to history
  const saveToHistory = useCallback((newData: string[][]) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { data: newData }].slice(-30));
    setHistoryIndex(prev => Math.min(prev + 1, 29));
  }, [historyIndex]);

  // Update content
  const updateData = useCallback((newData: string[][]) => {
    setData(newData);
    saveToHistory(newData);
    if (onChange) {
      onChange(toCSV(newData));
    }
  }, [onChange, saveToHistory]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const entry = history[historyIndex - 1];
      setData(entry.data);
      setHistoryIndex(prev => prev - 1);
      if (onChange) {
        onChange(toCSV(entry.data));
      }
    }
  }, [history, historyIndex, onChange]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const entry = history[historyIndex + 1];
      setData(entry.data);
      setHistoryIndex(prev => prev + 1);
      if (onChange) {
        onChange(toCSV(entry.data));
      }
    }
  }, [history, historyIndex, onChange]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => cell.toLowerCase().includes(query))
      );
    }

    Object.entries(columnFilters).forEach(([colStr, filter]) => {
      const col = parseInt(colStr);
      if (filter) {
        const filterLower = filter.toLowerCase();
        result = result.filter((row) =>
          (row[col] || "").toLowerCase().includes(filterLower)
        );
      }
    });

    return result;
  }, [rows, searchQuery, columnFilters]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortColumn === null || !sortDirection) {
      return filteredRows;
    }

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortColumn] || "";
      const bVal = b[sortColumn] || "";

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
      }

      const cmp = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Handle sort
  const handleSort = useCallback((colIndex: number) => {
    if (sortColumn !== colIndex) {
      setSortColumn(colIndex);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  }, [sortColumn, sortDirection]);

  // Cell editing
  const startEdit = useCallback((rowIndex: number, colIndex: number) => {
    if (readOnly || viewMode === "preview") return;
    const actualRowIndex = currentPage * pageSize + rowIndex + 1;
    setEditingCell({ row: actualRowIndex, col: colIndex });
    setEditValue(data[actualRowIndex]?.[colIndex] || "");
  }, [readOnly, viewMode, currentPage, pageSize, data]);

  const saveEdit = useCallback(() => {
    if (!editingCell) return;

    const newData = data.map((row, ri) => {
      if (ri === editingCell.row) {
        const newRow = [...row];
        while (newRow.length <= editingCell.col) {
          newRow.push("");
        }
        newRow[editingCell.col] = editValue;
        return newRow;
      }
      return row;
    });

    updateData(newData);
    setEditingCell(null);
  }, [editingCell, editValue, data, updateData]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  // Row operations
  const addRow = useCallback(() => {
    const newRow = headers.map(() => "");
    const newData = [...data, newRow];
    updateData(newData);
  }, [data, headers, updateData]);

  const deleteRow = useCallback((displayRowIndex: number) => {
    const actualRowIndex = currentPage * pageSize + displayRowIndex + 1;
    const newData = data.filter((_, i) => i !== actualRowIndex);
    updateData(newData);
    setSelectedCell(null);
  }, [data, currentPage, pageSize, updateData]);

  const insertRowAbove = useCallback(() => {
    if (selectedCell === null) return;
    const actualRowIndex = currentPage * pageSize + selectedCell.row + 1;
    const newRow = headers.map(() => "");
    const newData = [...data.slice(0, actualRowIndex), newRow, ...data.slice(actualRowIndex)];
    updateData(newData);
  }, [selectedCell, currentPage, pageSize, headers, data, updateData]);

  const insertRowBelow = useCallback(() => {
    if (selectedCell === null) return;
    const actualRowIndex = currentPage * pageSize + selectedCell.row + 2;
    const newRow = headers.map(() => "");
    const newData = [...data.slice(0, actualRowIndex), newRow, ...data.slice(actualRowIndex)];
    updateData(newData);
  }, [selectedCell, currentPage, pageSize, headers, data, updateData]);

  // Column operations
  const addColumn = useCallback(() => {
    const newData = data.map((row, i) => [...row, i === 0 ? `Column ${headers.length + 1}` : ""]);
    updateData(newData);
  }, [data, headers.length, updateData]);

  const deleteColumn = useCallback((colIndex: number) => {
    const newData = data.map((row) => row.filter((_, i) => i !== colIndex));
    updateData(newData);
    setSelectedColumn(null);
  }, [data, updateData]);

  const insertColumnLeft = useCallback(() => {
    if (selectedColumn === null && selectedCell === null) return;
    const colIndex = selectedColumn ?? selectedCell?.col ?? 0;
    const newData = data.map((row, i) => {
      const newRow = [...row];
      newRow.splice(colIndex, 0, i === 0 ? `Column ${colIndex + 1}` : "");
      return newRow;
    });
    updateData(newData);
  }, [selectedColumn, selectedCell, data, updateData]);

  const insertColumnRight = useCallback(() => {
    if (selectedColumn === null && selectedCell === null) return;
    const colIndex = (selectedColumn ?? selectedCell?.col ?? 0) + 1;
    const newData = data.map((row, i) => {
      const newRow = [...row];
      newRow.splice(colIndex, 0, i === 0 ? `Column ${colIndex + 1}` : "");
      return newRow;
    });
    updateData(newData);
  }, [selectedColumn, selectedCell, data, updateData]);

  // Sort column
  const sortColumnAsc = useCallback(() => {
    const col = selectedColumn ?? selectedCell?.col;
    if (col === null || col === undefined) return;
    setSortColumn(col);
    setSortDirection("asc");
  }, [selectedColumn, selectedCell]);

  const sortColumnDesc = useCallback(() => {
    const col = selectedColumn ?? selectedCell?.col;
    if (col === null || col === undefined) return;
    setSortColumn(col);
    setSortDirection("desc");
  }, [selectedColumn, selectedCell]);

  // Export
  const exportCSV = useCallback(() => {
    const csv = toCSV(data);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data]);

  const downloadCSV = useCallback(() => {
    const csv = toCSV(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName?.replace(/\.[^.]+$/, ".csv") || "data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, fileName]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (onSave && isDirty && !isSaving) {
          onSave();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, isDirty, isSaving, undo, redo]);

  // Get sort icon
  const getSortIcon = (colIndex: number) => {
    if (sortColumn !== colIndex) {
      return <ChevronsUpDown className="w-3 h-3 text-muted" />;
    }
    if (sortDirection === "asc") {
      return <ChevronUp className="w-3 h-3 text-primary" />;
    }
    return <ChevronDown className="w-3 h-3 text-primary" />;
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

  const Divider = () => <div className="w-px h-6 bg-app mx-1" />;

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      {fileName && (
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-app">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
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
            {!readOnly && (
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
            )}

            {/* Save button */}
            {onSave && !readOnly && (
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

      {/* Ribbon Toolbar - only show in edit mode */}
      {viewMode === "edit" && !readOnly && (
        <div className="bg-card border-b border-app">
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

            {/* Row operations */}
            <ToolbarBtn icon={Plus} label="Add Row" onClick={addRow} />
            <ToolbarBtn
              icon={ArrowUp}
              label="Insert Row Above"
              onClick={insertRowAbove}
              disabled={selectedCell === null}
            />
            <ToolbarBtn
              icon={ArrowDown}
              label="Insert Row Below"
              onClick={insertRowBelow}
              disabled={selectedCell === null}
            />

            <Divider />

            {/* Column operations */}
            <button
              onClick={addColumn}
              className="flex items-center gap-1 px-2 py-1 text-sm text-muted hover:text-app hover:bg-accent rounded transition-colors"
              title="Add Column"
            >
              <Plus className="w-4 h-4" />
              <span>Column</span>
            </button>
            <ToolbarBtn
              icon={ChevronLeft}
              label="Insert Column Left"
              onClick={insertColumnLeft}
              disabled={selectedColumn === null && selectedCell === null}
            />
            <ToolbarBtn
              icon={ChevronRight}
              label="Insert Column Right"
              onClick={insertColumnRight}
              disabled={selectedColumn === null && selectedCell === null}
            />

            <Divider />

            {/* Sort */}
            <ToolbarBtn
              icon={ArrowUp}
              label="Sort Ascending"
              onClick={sortColumnAsc}
              disabled={selectedColumn === null && selectedCell === null}
              active={sortDirection === "asc"}
            />
            <ToolbarBtn
              icon={ArrowDown}
              label="Sort Descending"
              onClick={sortColumnDesc}
              disabled={selectedColumn === null && selectedCell === null}
              active={sortDirection === "desc"}
            />
            <ToolbarBtn
              icon={Filter}
              label="Toggle Filters"
              onClick={() => setShowFilters(!showFilters)}
              active={showFilters}
            />

            <Divider />

            {/* Export */}
            <ToolbarBtn
              icon={copied ? Check : Copy}
              label="Copy as CSV"
              onClick={exportCSV}
            />
            <ToolbarBtn
              icon={Download}
              label="Download CSV"
              onClick={downloadCSV}
            />

            {/* Delete buttons */}
            {(selectedCell !== null || selectedColumn !== null) && (
              <>
                <Divider />
                {selectedCell !== null && (
                  <button
                    onClick={() => deleteRow(selectedCell.row)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                    title="Delete Selected Row"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Row</span>
                  </button>
                )}
                {selectedColumn !== null && (
                  <button
                    onClick={() => deleteColumn(selectedColumn)}
                    className="flex items-center gap-1 px-2 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                    title="Delete Selected Column"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Column</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-app bg-secondary/50">
            <Search className="w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(0);
              }}
              placeholder="Search all cells..."
              className="flex-1 bg-transparent text-sm text-app placeholder:text-muted focus:outline-none"
            />
            <span className="text-xs text-muted">
              {filteredRows.length === rows.length
                ? `${rows.length} rows`
                : `${filteredRows.length} of ${rows.length} rows`}
            </span>
          </div>
        </div>
      )}

      {/* Read-only toolbar for XLSX */}
      {(readOnly || viewMode === "preview") && (
        <div className="bg-card border-b border-app">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Search className="w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(0);
              }}
              placeholder="Search..."
              className="flex-1 bg-transparent text-sm text-app placeholder:text-muted focus:outline-none max-w-xs"
            />

            <Divider />

            <ToolbarBtn
              icon={Filter}
              label="Toggle Filters"
              onClick={() => setShowFilters(!showFilters)}
              active={showFilters}
            />
            <ToolbarBtn
              icon={copied ? Check : Copy}
              label="Copy as CSV"
              onClick={exportCSV}
            />
            <ToolbarBtn
              icon={Download}
              label="Download CSV"
              onClick={downloadCSV}
            />

            <span className="ml-auto text-xs text-muted">
              {filteredRows.length === rows.length
                ? `${rows.length} rows`
                : `${filteredRows.length} of ${rows.length} rows`} × {headers.length} columns
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Row number header */}
              <th className="bg-muted border-b border-r border-app px-2 py-2 text-center text-muted font-medium w-12 sticky left-0 z-20">
                #
              </th>
              {headers.map((header, colIndex) => (
                <th
                  key={colIndex}
                  onClick={() => setSelectedColumn(colIndex)}
                  className={`bg-muted border-b border-r border-app px-3 py-2 text-left font-semibold text-app min-w-[120px] cursor-pointer ${
                    selectedColumn === colIndex ? "bg-primary/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort(colIndex);
                      }}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      {header || `Column ${colIndex + 1}`}
                      {getSortIcon(colIndex)}
                    </button>
                  </div>
                  {showFilters && (
                    <input
                      type="text"
                      value={columnFilters[colIndex] || ""}
                      onChange={(e) => {
                        setColumnFilters((prev) => ({
                          ...prev,
                          [colIndex]: e.target.value,
                        }));
                        setCurrentPage(0);
                      }}
                      placeholder="Filter..."
                      className="mt-1 w-full px-2 py-1 bg-secondary border border-app rounded text-xs text-app placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, displayRowIndex) => {
              const actualRowIndex = currentPage * pageSize + displayRowIndex;
              return (
                <tr
                  key={actualRowIndex}
                  className={`hover:bg-accent/50 transition-colors ${
                    selectedCell?.row === displayRowIndex ? "bg-accent/30" : ""
                  }`}
                >
                  {/* Row number */}
                  <td className="bg-muted/50 border-b border-r border-app px-2 py-2 text-center text-muted tabular-nums sticky left-0">
                    {actualRowIndex + 1}
                  </td>
                  {headers.map((_, colIndex) => {
                    const isEditing =
                      editingCell?.row === actualRowIndex + 1 &&
                      editingCell?.col === colIndex;
                    const isSelected =
                      selectedCell?.row === displayRowIndex &&
                      selectedCell?.col === colIndex;
                    const cellValue = row[colIndex] || "";

                    return (
                      <td
                        key={colIndex}
                        onClick={() => {
                          setSelectedCell({ row: displayRowIndex, col: colIndex });
                          setSelectedColumn(null);
                        }}
                        onDoubleClick={() => startEdit(displayRowIndex, colIndex)}
                        className={`border-b border-r border-app px-3 py-2 text-app ${
                          isSelected
                            ? "bg-primary/20 ring-2 ring-primary ring-inset"
                            : selectedColumn === colIndex
                              ? "bg-primary/10"
                              : ""
                        } ${!readOnly && viewMode === "edit" ? "cursor-pointer" : ""}`}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                              if (e.key === "Tab") {
                                e.preventDefault();
                                saveEdit();
                                const nextCol = e.shiftKey ? colIndex - 1 : colIndex + 1;
                                if (nextCol >= 0 && nextCol < headers.length) {
                                  setTimeout(() => startEdit(displayRowIndex, nextCol), 0);
                                }
                              }
                            }}
                            onBlur={saveEdit}
                            className="w-full px-1 py-0.5 bg-secondary border border-primary rounded text-sm text-app focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          cellValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer / Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted bg-card border-t border-app">
        <div className="flex items-center gap-4">
          {selectedCell !== null && (
            <span className="text-app font-medium">
              Row {currentPage * pageSize + selectedCell.row + 1}, Col {selectedCell.col + 1}
            </span>
          )}
          {selectedColumn !== null && (
            <span className="text-app font-medium">
              Column: {headers[selectedColumn] || `Column ${selectedColumn + 1}`}
            </span>
          )}
          <span>{rows.length} rows × {headers.length} columns</span>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span>{readOnly ? "XLSX (Read-only)" : "CSV"}</span>
          <span className="text-primary">
            • {viewMode === "edit" ? "Edit" : "Preview"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SpreadsheetEditor;
