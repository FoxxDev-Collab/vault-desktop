import { serve } from "bun";
import index from "./index.html";
import {
  db,
  getVaultPath,
  setVaultPath,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getRecentFiles,
  addRecentFile,
  getBookmarks,
  addBookmark,
  removeBookmark,
  getAppSettings,
  setAppSettings,
} from "./db";
import {
  getFileTree,
  readNote,
  readBinaryFile,
  isBinaryFile,
  writeNote,
  createNote,
  createFolder,
  moveItem,
  deleteItem,
  searchVault,
} from "./api/vault";
import { existsSync } from "fs";

const PORT = process.env.PORT || 3001;

const server = serve({
  port: PORT,
  routes: {
    // Serve index.html for all unmatched routes
    "/*": index,

    // ============ Vault Settings ============
    "/api/vault": {
      async GET() {
        const vaultPath = getVaultPath();
        return Response.json({ vaultPath });
      },
      async POST(req) {
        const { path } = await req.json();
        if (!existsSync(path)) {
          return Response.json({ error: "Path does not exist" }, { status: 400 });
        }
        setVaultPath(path);
        return Response.json({ success: true, vaultPath: path });
      },
    },

    // ============ File Tree ============
    "/api/files": {
      async GET() {
        const vaultPath = getVaultPath();
        if (!vaultPath) {
          return Response.json({ error: "No vault configured" }, { status: 400 });
        }
        const tree = await getFileTree(vaultPath);
        return Response.json({ tree, vaultPath });
      },
    },

    // ============ File Operations ============
    "/api/file": {
      async GET(req) {
        const url = new URL(req.url);
        const filePath = url.searchParams.get("path");
        if (!filePath) {
          return Response.json({ error: "Path required" }, { status: 400 });
        }
        try {
          addRecentFile(filePath);

          // Check if it's a binary file
          if (isBinaryFile(filePath)) {
            const buffer = await readBinaryFile(filePath);
            return Response.json({
              content: null,
              binary: true,
              data: Buffer.from(buffer).toString("base64"),
              path: filePath,
            });
          }

          const content = await readNote(filePath);
          return Response.json({ content, binary: false, path: filePath });
        } catch (e) {
          return Response.json({ error: "File not found" }, { status: 404 });
        }
      },
      async POST(req) {
        const vaultPath = getVaultPath();
        if (!vaultPath) {
          return Response.json({ error: "No vault configured" }, { status: 400 });
        }
        const { relativePath, content, templateId } = await req.json();
        let initialContent = content ?? "";

        if (templateId) {
          const template = getTemplate(templateId) as { content: string } | null;
          if (template) {
            initialContent = template.content;
          }
        }

        const newPath = await createNote(vaultPath, relativePath, initialContent);
        return Response.json({ success: true, path: newPath });
      },
      async PUT(req) {
        const { path, content } = await req.json();
        await writeNote(path, content);
        return Response.json({ success: true });
      },
      async DELETE(req) {
        const { path } = await req.json();
        await deleteItem(path);
        return Response.json({ success: true });
      },
    },

    // ============ Folder Operations ============
    "/api/folder": {
      async POST(req) {
        const vaultPath = getVaultPath();
        if (!vaultPath) {
          return Response.json({ error: "No vault configured" }, { status: 400 });
        }
        const { relativePath } = await req.json();
        const newPath = await createFolder(vaultPath, relativePath);
        return Response.json({ success: true, path: newPath });
      },
      async DELETE(req) {
        const { path } = await req.json();
        await deleteItem(path);
        return Response.json({ success: true });
      },
    },

    // ============ Move/Rename ============
    "/api/move": {
      async POST(req) {
        const { oldPath, newPath } = await req.json();
        await moveItem(oldPath, newPath);
        return Response.json({ success: true });
      },
    },

    // ============ Search ============
    "/api/search": {
      async GET(req) {
        const vaultPath = getVaultPath();
        if (!vaultPath) {
          return Response.json({ error: "No vault configured" }, { status: 400 });
        }
        const url = new URL(req.url);
        const query = url.searchParams.get("q") ?? "";
        const searchContent = url.searchParams.get("content") === "true";
        const results = await searchVault(vaultPath, query, searchContent);
        return Response.json({ results });
      },
    },

    // ============ Templates ============
    "/api/templates": {
      async GET() {
        const templates = getTemplates();
        return Response.json({ templates });
      },
      async POST(req) {
        const { name, content, description } = await req.json();
        createTemplate(name, content, description);
        return Response.json({ success: true });
      },
    },

    "/api/template/:id": {
      async GET(req) {
        const template = getTemplate(Number(req.params.id));
        if (!template) {
          return Response.json({ error: "Template not found" }, { status: 404 });
        }
        return Response.json({ template });
      },
      async PUT(req) {
        const { name, content, description } = await req.json();
        updateTemplate(Number(req.params.id), name, content, description);
        return Response.json({ success: true });
      },
      async DELETE(req) {
        deleteTemplate(Number(req.params.id));
        return Response.json({ success: true });
      },
    },

    // ============ Recent Files ============
    "/api/recent": {
      async GET() {
        const files = getRecentFiles();
        return Response.json({ files });
      },
    },

    // ============ Bookmarks ============
    "/api/bookmarks": {
      async GET() {
        const bookmarks = getBookmarks();
        return Response.json({ bookmarks });
      },
      async POST(req) {
        const { path, name } = await req.json();
        addBookmark(path, name);
        return Response.json({ success: true });
      },
      async DELETE(req) {
        const { path } = await req.json();
        removeBookmark(path);
        return Response.json({ success: true });
      },
    },

    // ============ App Settings ============
    "/api/settings": {
      async GET() {
        const settings = getAppSettings();
        return Response.json({ settings });
      },
      async PUT(req) {
        const { settings } = await req.json();
        setAppSettings(settings);
        return Response.json({ success: true });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
