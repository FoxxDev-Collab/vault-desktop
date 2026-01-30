import { readdir, stat, readFile, writeFile, mkdir, rename, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, relative, basename, dirname, extname } from "path";

export interface FileNode {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "folder";
  extension?: string;
  children?: FileNode[];
  modified?: string;
  size?: number;
}

// Supported file extensions
const SUPPORTED_EXTENSIONS = [
  // Text/Document files
  ".md", ".txt", ".json", ".yaml", ".yml",
  ".csv", ".xlsx", ".xls", ".docx", ".doc", ".pdf",
  // Image files
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".tiff", ".tif", ".svg",
  // Video files
  ".mp4", ".webm", ".ogv", ".mov", ".avi", ".mkv",
  // Audio files
  ".mp3", ".wav", ".ogg", ".oga", ".flac", ".aac", ".m4a",
  // Code files - JavaScript/TypeScript
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  // Code files - Web
  ".html", ".htm", ".css", ".scss", ".less", ".sass",
  ".vue", ".svelte", ".astro",
  // Code files - Backend/General
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".scala",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".php", ".swift",
  // Code files - Data/Config
  ".sql", ".graphql", ".gql", ".prisma",
  ".toml", ".ini", ".conf", ".env", ".xml",
  // Code files - Shell/Scripts
  ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd",
  // Other useful files
  ".dockerfile", ".makefile", ".gitignore", ".editorconfig",
];

// Recursively build file tree
export async function getFileTree(vaultPath: string, currentPath: string = vaultPath): Promise<FileNode[]> {
  const entries = await readdir(currentPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip hidden files/folders and node_modules
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "bun") {
      continue;
    }

    const fullPath = join(currentPath, entry.name);
    const relativePath = relative(vaultPath, fullPath);
    const stats = await stat(fullPath);

    if (entry.isDirectory()) {
      const children = await getFileTree(vaultPath, fullPath);
      nodes.push({
        name: entry.name,
        path: fullPath,
        relativePath,
        type: "folder",
        children,
        modified: stats.mtime.toISOString(),
      });
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          type: "file",
          extension: ext,
          modified: stats.mtime.toISOString(),
          size: stats.size,
        });
      }
    }
  }

  // Sort: folders first, then files, alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Read file content (text)
export async function readNote(filePath: string): Promise<string> {
  return await readFile(filePath, "utf-8");
}

// Read file content (binary)
export async function readBinaryFile(filePath: string): Promise<Buffer> {
  return await readFile(filePath);
}

// Binary file extensions
const BINARY_EXTENSIONS = [
  // Documents
  ".xlsx", ".xls", ".docx", ".doc", ".pdf",
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".tiff", ".tif",
  // Video
  ".mp4", ".webm", ".ogv", ".mov", ".avi", ".mkv",
  // Audio
  ".mp3", ".wav", ".ogg", ".oga", ".flac", ".aac", ".m4a",
];

// Check if file is binary
export function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

// Write file content
export async function writeNote(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, content, "utf-8");
}

// Create new file
export async function createNote(vaultPath: string, relativePath: string, content: string = ""): Promise<string> {
  const fullPath = join(vaultPath, relativePath);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  // If file exists, add a number suffix
  let finalPath = fullPath;
  let counter = 1;
  while (existsSync(finalPath)) {
    const ext = extname(relativePath);
    const base = basename(relativePath, ext);
    finalPath = join(dir, `${base} ${counter}${ext}`);
    counter++;
  }

  await writeFile(finalPath, content, "utf-8");
  return finalPath;
}

// Create new folder
export async function createFolder(vaultPath: string, relativePath: string): Promise<string> {
  const fullPath = join(vaultPath, relativePath);

  // If folder exists, add a number suffix
  let finalPath = fullPath;
  let counter = 1;
  while (existsSync(finalPath)) {
    finalPath = `${fullPath} ${counter}`;
    counter++;
  }

  await mkdir(finalPath, { recursive: true });
  return finalPath;
}

// Rename/move file or folder
export async function moveItem(oldPath: string, newPath: string): Promise<void> {
  const dir = dirname(newPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await rename(oldPath, newPath);
}

// Delete file or folder
export async function deleteItem(itemPath: string): Promise<void> {
  await rm(itemPath, { recursive: true });
}

// Search files by name or content
export async function searchVault(
  vaultPath: string,
  query: string,
  searchContent: boolean = false
): Promise<{ path: string; relativePath: string; name: string; match?: string }[]> {
  const results: { path: string; relativePath: string; name: string; match?: string }[] = [];
  const lowerQuery = query.toLowerCase();

  async function searchDir(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = join(currentPath, entry.name);
      const relativePath = relative(vaultPath, fullPath);

      if (entry.isDirectory()) {
        // Check folder name
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          results.push({ path: fullPath, relativePath, name: entry.name });
        }
        await searchDir(fullPath);
      } else {
        const ext = extname(entry.name).toLowerCase();
        // Skip binary files for search
        if (BINARY_EXTENSIONS.includes(ext)) continue;
        // Only search supported file types
        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

        // Check file name
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          results.push({ path: fullPath, relativePath, name: entry.name });
        } else if (searchContent) {
          // Check file content
          const content = await readFile(fullPath, "utf-8");
          if (content.toLowerCase().includes(lowerQuery)) {
            // Get snippet around match
            const idx = content.toLowerCase().indexOf(lowerQuery);
            const start = Math.max(0, idx - 40);
            const end = Math.min(content.length, idx + query.length + 40);
            const match = (start > 0 ? "..." : "") +
                          content.slice(start, end).replace(/\n/g, " ") +
                          (end < content.length ? "..." : "");
            results.push({ path: fullPath, relativePath, name: entry.name, match });
          }
        }
      }
    }
  }

  await searchDir(vaultPath);
  return results.slice(0, 50); // Limit results
}
