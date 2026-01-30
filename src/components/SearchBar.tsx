import { useState, useRef, useEffect } from "react";

interface SearchResult {
  path: string;
  relativePath: string;
  name: string;
  match?: string;
}

interface SearchBarProps {
  onSearch: (query: string, searchContent: boolean) => Promise<SearchResult[]>;
  onSelect: (result: SearchResult) => void;
}

export function SearchBar({ onSearch, onSelect }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchContent, setSearchContent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + P to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        const results = await onSearch(query, searchContent);
        setResults(results);
        setSelectedIndex(0);
        setLoading(false);
      } else {
        setResults([]);
      }
    }, 200);

    return () => clearTimeout(debounce);
  }, [query, searchContent, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex]);
          setIsOpen(false);
          setQuery("");
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-input focus-within:border-primary transition-colors">
        <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search files... (Ctrl+P)"
          className="flex-1 bg-transparent text-sm text-app placeholder:text-muted focus:outline-none"
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-app border-t-primary rounded-full animate-spin" />
        )}
        <button
          onClick={() => setSearchContent(!searchContent)}
          title={searchContent ? "Searching content" : "Searching file names only"}
          className={`text-xs px-2 py-0.5 rounded ${
            searchContent
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted hover:text-app"
          }`}
        >
          {searchContent ? "Content" : "Names"}
        </button>
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-app rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={result.path}
              onClick={() => {
                onSelect(result);
                setIsOpen(false);
                setQuery("");
              }}
              className={`w-full px-4 py-3 text-left transition-colors ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <div className="text-sm font-medium text-app">{result.name}</div>
              <div className="text-xs text-muted truncate">{result.relativePath}</div>
              {result.match && (
                <div className="text-xs text-muted mt-1 truncate">{result.match}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
