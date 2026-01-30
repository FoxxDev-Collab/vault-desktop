import { useMemo, useCallback } from "react";
import { DataTable } from "./DataTable";

interface CsvViewerProps {
  content: string;
  editable?: boolean;
  onChange?: (content: string) => void;
}

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
        i++; // Skip next quote
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
        if (char === "\r") i++; // Skip \n in \r\n
      } else if (char !== "\r") {
        currentCell += char;
      }
    }
  }

  // Handle last row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

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

export function CsvViewer({ content, editable = false, onChange }: CsvViewerProps) {
  const data = useMemo(() => parseCSV(content), [content]);

  const handleChange = useCallback(
    (newData: Record<string, unknown>[] | string[][]) => {
      if (onChange && Array.isArray(newData) && Array.isArray(newData[0])) {
        onChange(toCSV(newData as string[][]));
      }
    },
    [onChange]
  );

  if (data.length === 0) {
    return (
      <div className="text-muted text-center py-8">No data to display</div>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto">
      <DataTable
        data={data}
        editable={editable}
        onChange={handleChange}
        showSearch={true}
        showFilter={true}
        showPagination={true}
        showRowNumbers={true}
        showExport={true}
      />
    </div>
  );
}

export default CsvViewer;
