import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface DataTableProps {
  data: Record<string, unknown>[] | string[][];
  columns?: string[];
  editable?: boolean;
  onChange?: (data: Record<string, unknown>[] | string[][]) => void;
  pageSize?: number;
  showSearch?: boolean;
  showFilter?: boolean;
  showPagination?: boolean;
  showRowNumbers?: boolean;
  showExport?: boolean;
  className?: string;
  title?: string;
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

// Normalize data to array of objects format
function normalizeData(
  data: Record<string, unknown>[] | string[][],
  columns?: string[]
): { rows: Record<string, unknown>[]; headers: string[] } {
  if (data.length === 0) {
    return { rows: [], headers: columns || [] };
  }

  // Check if it's array of arrays (CSV-style)
  if (Array.isArray(data[0])) {
    const arrayData = data as string[][];
    const headers = columns || arrayData[0].map((_, i) => `Column ${i + 1}`);
    const hasHeaderRow = !columns && arrayData.length > 0;
    const startRow = hasHeaderRow ? 1 : 0;
    const actualHeaders = hasHeaderRow ? arrayData[0] : headers;

    const rows = arrayData.slice(startRow).map((row) => {
      const obj: Record<string, unknown> = {};
      actualHeaders.forEach((header, i) => {
        obj[header || `Column ${i + 1}`] = row[i] ?? "";
      });
      return obj;
    });

    return { rows, headers: actualHeaders as string[] };
  }

  // Already array of objects
  const objData = data as Record<string, unknown>[];
  const headers = columns || Object.keys(objData[0] || {});
  return { rows: objData, headers };
}

// Convert back to array format if needed
function denormalizeData(
  rows: Record<string, unknown>[],
  headers: string[],
  originalWasArray: boolean
): Record<string, unknown>[] | string[][] {
  if (!originalWasArray) {
    return rows;
  }

  const result: string[][] = [headers];
  rows.forEach((row) => {
    result.push(headers.map((h) => String(row[h] ?? "")));
  });
  return result;
}

export function DataTable({
  data,
  columns,
  editable = false,
  onChange,
  pageSize = 25,
  showSearch = true,
  showFilter = true,
  showPagination = true,
  showRowNumbers = true,
  showExport = true,
  className = "",
  title,
}: DataTableProps) {
  const originalWasArray = data.length > 0 && Array.isArray(data[0]);
  const { rows: initialRows, headers } = useMemo(
    () => normalizeData(data, columns),
    [data, columns]
  );

  const [rows, setRows] = useState(initialRows);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {}
  );
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);

  // Update rows when data prop changes
  useEffect(() => {
    const { rows: newRows } = normalizeData(data, columns);
    setRows(newRows);
  }, [data, columns]);

  // Filter rows
  const filteredRows = useMemo(() => {
    let result = rows;

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        headers.some((h) => String(row[h] ?? "").toLowerCase().includes(query))
      );
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([col, filter]) => {
      if (filter) {
        const filterLower = filter.toLowerCase();
        result = result.filter((row) =>
          String(row[col] ?? "").toLowerCase().includes(filterLower)
        );
      }
    });

    return result;
  }, [rows, searchQuery, columnFilters, headers]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return filteredRows;
    }

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortState.column!];
      const bVal = b[sortState.column!];

      // Handle numbers
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortState.direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Handle strings
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      const cmp = aStr.localeCompare(bStr);
      return sortState.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortState]);

  // Paginate rows
  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    if (!showPagination) return sortedRows;
    const start = currentPage * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize, showPagination]);

  // Handle sort
  const handleSort = useCallback((column: string) => {
    setSortState((prev) => {
      if (prev.column !== column) {
        return { column, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column, direction: "desc" };
      }
      return { column: null, direction: null };
    });
  }, []);

  // Handle cell edit
  const startEdit = useCallback(
    (rowIndex: number, col: string) => {
      if (!editable) return;
      const actualIndex = showPagination ? currentPage * pageSize + rowIndex : rowIndex;
      setEditingCell({ row: actualIndex, col });
      setEditValue(String(rows[actualIndex][col] ?? ""));
    },
    [editable, rows, currentPage, pageSize, showPagination]
  );

  const saveEdit = useCallback(() => {
    if (!editingCell) return;

    const newRows = [...rows];
    newRows[editingCell.row] = {
      ...newRows[editingCell.row],
      [editingCell.col]: editValue,
    };
    setRows(newRows);
    setEditingCell(null);

    if (onChange) {
      onChange(denormalizeData(newRows, headers, originalWasArray));
    }
  }, [editingCell, editValue, rows, headers, originalWasArray, onChange]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  // Handle row operations
  const addRow = useCallback(() => {
    const newRow: Record<string, unknown> = {};
    headers.forEach((h) => (newRow[h] = ""));
    const newRows = [...rows, newRow];
    setRows(newRows);
    if (onChange) {
      onChange(denormalizeData(newRows, headers, originalWasArray));
    }
  }, [rows, headers, originalWasArray, onChange]);

  const deleteRow = useCallback(
    (index: number) => {
      const actualIndex = showPagination ? currentPage * pageSize + index : index;
      const newRows = rows.filter((_, i) => i !== actualIndex);
      setRows(newRows);
      if (onChange) {
        onChange(denormalizeData(newRows, headers, originalWasArray));
      }
    },
    [rows, headers, originalWasArray, onChange, currentPage, pageSize, showPagination]
  );

  // Export to CSV
  const exportCSV = useCallback(() => {
    const csvRows = [headers.join(",")];
    sortedRows.forEach((row) => {
      csvRows.push(
        headers
          .map((h) => {
            const val = String(row[h] ?? "");
            return val.includes(",") || val.includes('"')
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(",")
      );
    });
    const csv = csvRows.join("\n");
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [headers, sortedRows]);

  // Get sort icon
  const getSortIcon = (column: string) => {
    if (sortState.column !== column) {
      return <ChevronsUpDown className="w-4 h-4 text-muted" />;
    }
    if (sortState.direction === "asc") {
      return <ChevronUp className="w-4 h-4 text-primary" />;
    }
    return <ChevronDown className="w-4 h-4 text-primary" />;
  };

  if (rows.length === 0 && !editable) {
    return (
      <div className="text-muted text-center py-8">No data to display</div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {title && <h3 className="text-lg font-semibold text-app">{title}</h3>}

        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Search */}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder="Search..."
                className="pl-9 pr-3 py-1.5 bg-secondary border border-app rounded-lg text-sm text-app placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
              />
            </div>
          )}

          {/* Filter toggle */}
          {showFilter && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg transition-colors ${
                showFilters
                  ? "bg-primary text-white"
                  : "text-muted hover:text-app hover:bg-accent"
              }`}
              title="Toggle column filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          )}

          {/* Export */}
          {showExport && (
            <button
              onClick={exportCSV}
              className="p-1.5 text-muted hover:text-app hover:bg-accent rounded-lg transition-colors"
              title="Copy as CSV"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Add row */}
          {editable && (
            <button
              onClick={addRow}
              className="flex items-center gap-1 px-2 py-1.5 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto border border-app rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {showRowNumbers && (
                <th className="bg-muted border-b border-app px-3 py-2 text-left text-muted font-medium w-12">
                  #
                </th>
              )}
              {headers.map((header) => (
                <th
                  key={header}
                  className="bg-muted border-b border-app px-3 py-2 text-left font-semibold text-app"
                >
                  <button
                    onClick={() => handleSort(header)}
                    className="flex items-center gap-1 hover:text-primary transition-colors w-full"
                  >
                    {header}
                    {getSortIcon(header)}
                  </button>
                  {showFilters && (
                    <input
                      type="text"
                      value={columnFilters[header] || ""}
                      onChange={(e) => {
                        setColumnFilters((prev) => ({
                          ...prev,
                          [header]: e.target.value,
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
              {editable && (
                <th className="bg-muted border-b border-app px-3 py-2 text-left text-muted font-medium w-12">

                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIndex) => {
              const actualIndex = showPagination
                ? currentPage * pageSize + rowIndex
                : rowIndex;
              return (
                <tr
                  key={actualIndex}
                  className="hover:bg-accent/50 transition-colors"
                >
                  {showRowNumbers && (
                    <td className="border-b border-app px-3 py-2 text-muted text-center tabular-nums">
                      {actualIndex + 1}
                    </td>
                  )}
                  {headers.map((header) => {
                    const isEditing =
                      editingCell?.row === actualIndex &&
                      editingCell?.col === header;
                    return (
                      <td
                        key={header}
                        className="border-b border-app px-3 py-2 text-app"
                        onDoubleClick={() => startEdit(rowIndex, header)}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="flex-1 px-2 py-1 bg-secondary border border-primary rounded text-sm text-app focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              className="p-1 text-green-500 hover:bg-green-500/20 rounded"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={editable ? "cursor-pointer" : ""}
                            title={editable ? "Double-click to edit" : ""}
                          >
                            {String(row[header] ?? "")}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {editable && (
                    <td className="border-b border-app px-3 py-2">
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="p-1 text-muted hover:text-red-500 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {filteredRows.length === rows.length
            ? `${rows.length} rows`
            : `${filteredRows.length} of ${rows.length} rows`}{" "}
          × {headers.length} columns
        </span>

        {/* Pagination */}
        {showPagination && totalPages > 1 && (
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
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={currentPage >= totalPages - 1}
              className="p-1 text-muted hover:text-app hover:bg-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataTable;
