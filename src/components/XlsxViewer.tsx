import { useState, useMemo } from "react";
import * as XLSX from "xlsx";

interface XlsxViewerProps {
  data: ArrayBuffer;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export function XlsxViewer({ data }: XlsxViewerProps) {
  const [activeSheet, setActiveSheet] = useState(0);

  const sheets = useMemo<SheetData[]>(() => {
    try {
      const workbook = XLSX.read(data, { type: "array" });
      return workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        const headers = (jsonData[0] || []).map((h, i) =>
          h?.toString() || `Column ${i + 1}`
        );
        const rows = jsonData.slice(1).map((row) =>
          headers.map((_, i) => row[i]?.toString() || "")
        );

        return { name, headers, rows };
      });
    } catch (e) {
      console.error("Failed to parse XLSX:", e);
      return [];
    }
  }, [data]);

  if (sheets.length === 0) {
    return (
      <div className="text-muted text-center py-8">
        Failed to load spreadsheet
      </div>
    );
  }

  const currentSheet = sheets[activeSheet];

  return (
    <div className="flex flex-col h-full">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1 p-2 bg-card border-b border-app overflow-x-auto">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                index === activeSheet
                  ? "bg-accent text-app"
                  : "text-muted hover:text-app hover:bg-accent/50"
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        {currentSheet.rows.length === 0 ? (
          <div className="text-muted text-center py-8">
            This sheet is empty
          </div>
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0">
                <tr>
                  <th className="bg-muted border border-app px-4 py-2 text-left text-muted font-medium w-12">
                    #
                  </th>
                  {currentSheet.headers.map((header, i) => (
                    <th
                      key={i}
                      className="bg-muted border border-app px-4 py-2 text-left text-app font-semibold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentSheet.rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="hover:bg-accent/50 transition-colors"
                  >
                    <td className="border border-app px-4 py-2 text-muted text-center tabular-nums">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className="border border-app px-4 py-2 text-app"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-xs text-muted">
              {currentSheet.rows.length} rows × {currentSheet.headers.length}{" "}
              columns
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default XlsxViewer;
