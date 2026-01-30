import * as React from "react";
import { useMemo, useState, Suspense } from "react";
import { Play, Code2, ChevronDown, ChevronRight } from "lucide-react";

// Lazy load JSXPreview to avoid circular dependencies
const JSXPreview = React.lazy(() => import("./JSXPreview"));

interface MarkdownViewerProps {
  content: string;
  isDark?: boolean;
  enableLiveCode?: boolean;
}

interface ContentBlock {
  type: "markdown" | "jsx";
  content: string;
  language?: string;
}

// Parse content into blocks of markdown and executable code
function parseContent(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(jsx|tsx|javascript|typescript)?\s*\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add markdown before this code block
    if (match.index > lastIndex) {
      const mdContent = text.slice(lastIndex, match.index).trim();
      if (mdContent) {
        blocks.push({ type: "markdown", content: mdContent });
      }
    }

    // Add code block
    const language = match[1] || "";
    const isExecutable = ["jsx", "tsx", "javascript", "typescript"].includes(language.toLowerCase());

    if (isExecutable) {
      blocks.push({
        type: "jsx",
        content: match[2].trim(),
        language,
      });
    } else {
      // Non-executable code block, treat as markdown
      blocks.push({
        type: "markdown",
        content: match[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining markdown
  if (lastIndex < text.length) {
    const mdContent = text.slice(lastIndex).trim();
    if (mdContent) {
      blocks.push({ type: "markdown", content: mdContent });
    }
  }

  return blocks;
}

// Simple markdown parser - handles common syntax
function parseMarkdown(text: string): string {
  let html = text;

  // Escape HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-gray-900 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm text-green-400 language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1.5 py-0.5 rounded text-pink-400 text-sm">$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="text-base font-semibold text-gray-200 mt-4 mb-2">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="text-lg font-semibold text-gray-200 mt-4 mb-2">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-xl font-semibold text-gray-100 mt-5 mb-2">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-2xl font-bold text-gray-100 mt-6 mb-3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-3xl font-bold text-white mt-8 mb-4 pb-2 border-b border-gray-700">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-4xl font-bold text-white mt-8 mb-6">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del class="text-gray-500">$1</del>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4" />');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="border-gray-700 my-8" />');
  html = html.replace(/^\*\*\*+$/gm, '<hr class="border-gray-700 my-8" />');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 my-4 text-gray-400 italic">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li class="ml-6 list-disc text-gray-300">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-6 list-decimal text-gray-300">$1</li>');

  // Wrap consecutive list items
  html = html.replace(/(<li class="ml-6 list-disc[^>]*>.*?<\/li>\n?)+/g, (match) => {
    return `<ul class="my-4">${match}</ul>`;
  });
  html = html.replace(/(<li class="ml-6 list-decimal[^>]*>.*?<\/li>\n?)+/g, (match) => {
    return `<ol class="my-4">${match}</ol>`;
  });

  // Task lists
  html = html.replace(/<li class="ml-6 list-disc text-gray-300">\[x\]\s*/gi,
    '<li class="ml-6 flex items-center gap-2 text-gray-300"><input type="checkbox" checked disabled class="rounded" />');
  html = html.replace(/<li class="ml-6 list-disc text-gray-300">\[\s?\]\s*/gi,
    '<li class="ml-6 flex items-center gap-2 text-gray-300"><input type="checkbox" disabled class="rounded" />');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split("|").map((c: string) => c.trim());
    const isHeader = cells.every((c: string) => /^[-:]+$/.test(c));
    if (isHeader) return "<!-- table separator -->";
    const cellTag = "td";
    const cellsHtml = cells.map((c: string) => `<${cellTag} class="border border-gray-700 px-4 py-2">${c}</${cellTag}>`).join("");
    return `<tr>${cellsHtml}</tr>`;
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (match) => {
    // Convert first row to header
    const rows = match.trim().split("\n").filter(r => r.trim());
    if (rows.length > 0) {
      rows[0] = rows[0].replace(/<td/g, "<th").replace(/<\/td>/g, "</th>");
    }
    return `<table class="w-full border-collapse my-4">${rows.join("")}</table>`;
  });
  html = html.replace(/<!-- table separator -->\n?/g, "");

  // Paragraphs - wrap remaining text
  const lines = html.split("\n");
  const wrapped = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("<")) return line;
    return `<p class="text-gray-300 leading-relaxed my-3">${line}</p>`;
  });
  html = wrapped.join("\n");

  // Clean up empty paragraphs
  html = html.replace(/<p class="[^"]*"><\/p>/g, "");

  return html;
}

// Live code block component
function LiveCodeBlock({
  code,
  language,
  isDark,
}: {
  code: string;
  language?: string;
  isDark: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="my-4 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 text-gray-400 hover:text-white"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <Play className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-300">Live {language?.toUpperCase() || "Code"}</span>
        </div>
        <button
          onClick={() => setShowCode(!showCode)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            showCode ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
        >
          <Code2 className="w-3 h-3" />
          {showCode ? "Hide Code" : "Show Code"}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Code (collapsible) */}
          {showCode && (
            <div className="border-b border-gray-700">
              <pre className="p-4 bg-gray-900 overflow-x-auto">
                <code className="text-sm text-green-400">{code}</code>
              </pre>
            </div>
          )}

          {/* Live preview */}
          <div className="bg-gray-900">
            <Suspense
              fallback={
                <div className="flex items-center justify-center p-8">
                  <div className="w-6 h-6 border-2 border-gray-600 border-t-primary rounded-full animate-spin" />
                </div>
              }
            >
              <JSXPreview code={code} autoRun={true} isDark={isDark} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}

export function MarkdownViewer({
  content,
  isDark = true,
  enableLiveCode = true,
}: MarkdownViewerProps) {
  const blocks = useMemo(() => {
    if (enableLiveCode) {
      return parseContent(content);
    }
    return [{ type: "markdown" as const, content }];
  }, [content, enableLiveCode]);

  return (
    <div className="prose prose-invert max-w-none">
      {blocks.map((block, index) => {
        if (block.type === "jsx" && enableLiveCode) {
          return (
            <LiveCodeBlock
              key={index}
              code={block.content}
              language={block.language}
              isDark={isDark}
            />
          );
        }

        const html = parseMarkdown(block.content);
        return (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}

export default MarkdownViewer;
