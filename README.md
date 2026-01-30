# Vault

A lightweight, standalone desktop app for managing markdown notes and files. Built with Tauri and React.

![Vault Screenshot](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Multi-Vault Support** - Manage multiple vaults, switch between them instantly
- **Markdown Editor** - Live preview with split-pane editing
- **Code Editor** - Syntax highlighting for 50+ languages via Monaco
- **File Viewers** - PDF, images, video/audio, Word documents (.docx), SVG
- **JSX Preview** - Live React component preview with theme support
- **Search** - Search by filename or content across your vault
- **Themes** - Light, dark, and system theme modes
- **Portable** - Fully standalone, no server or runtime required

## Installation

Download the latest release:
- **Windows Installer**: `Vault_x.x.x_x64-setup.exe`
- **Windows MSI**: `Vault_x.x.x_x64_en-US.msi`

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Rust](https://rustup.rs) v1.77+
- [Tauri CLI](https://tauri.app) v2

### Setup

```bash
# Install dependencies
bun install

# Run in development mode
bun run build && bun run tauri:dev

# Build for production
bun run tauri:build
```

### Project Structure

```
vault-desktop/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React hooks & API
│   └── VaultApp.tsx        # Main app component
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri entry point
│   │   └── commands.rs     # Tauri commands
│   └── tauri.conf.json     # Tauri configuration
└── dist/                   # Built frontend (generated)
```

## Configuration

App configuration is stored at:
- **Windows**: `%APPDATA%\com.foxxcyber.vault\config\config.json`

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Monaco Editor
- **Backend**: Rust, Tauri v2
- **Build**: Bun

## License

MIT

---

Built by [Foxx Cyber LLC](https://foxxcyber.com)
