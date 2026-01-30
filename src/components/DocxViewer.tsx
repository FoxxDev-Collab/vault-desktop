import { useState, useEffect } from "react";
import mammoth from "mammoth";

interface DocxViewerProps {
  data: ArrayBuffer;
}

export function DocxViewer({ data }: DocxViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function convertDocx() {
      setLoading(true);
      setError(null);
      try {
        const result = await mammoth.convertToHtml(
          { arrayBuffer: data },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Heading 4'] => h4:fresh",
              "b => strong",
              "i => em",
              "u => u",
              "strike => del",
            ],
          }
        );
        setHtml(result.value);
        if (result.messages.length > 0) {
          console.warn("Mammoth warnings:", result.messages);
        }
      } catch (e) {
        console.error("Failed to convert DOCX:", e);
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    }

    convertDocx();
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-app border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-center py-8">
        {error}
      </div>
    );
  }

  return (
    <div
      className="docx-content prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default DocxViewer;
