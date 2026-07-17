<p align="center">
  <img src="./assets/logo.png" alt="Snag">
</p>

<h1 align="center">Snag</h1>

<p align="center">
A fast, lightweight native API client built with Tauri 2, Vue 3, and TypeScript.
</p>

<p align="center">
  Think <strong>Postman</strong>, but native and snappy.
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/anggagewor/snag?style=for-the-badge">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge">
  <img src="https://img.shields.io/badge/Tauri-2.x-FFC131?style=for-the-badge&logo=tauri&logoColor=black">
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?style=for-the-badge&logo=vuedotjs&logoColor=white">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-success?style=for-the-badge">
  <img src="https://img.shields.io/badge/Status-Active%20Development-blue?style=for-the-badge">
</p>

<p align="center">
  ⚡ Native • 🚀 Fast • 💾 Local First • 🔥 Zero Electron
</p>

---

## What is Snag?

A native desktop API client for developers who want speed and simplicity. No Electron, no bloat — just a fast app that does its job.

**Key highlights:**
- Full request builder (headers, params, body, auth, scripts)
- Collections with nested folders, drag & drop, variables
- Environment variables with `{{variable}}` substitution
- Pre-request scripts & test assertions (`snag.*` API)
- Import Postman / OpenAPI / cURL — export Postman / cURL
- Multi-protocol foundation (REST ✅, WebSocket / GraphQL / gRPC types ready)
- Workspace-based storage — portable, Git-friendly, one file per request

For the full feature list and roadmap, see [FEATURES.md](./FEATURES.md).

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Tauri 2 |
| Frontend | Vue 3 (Composition API) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| State | Pinia |
| Build | Vite 6 |
| HTTP | @tauri-apps/plugin-http |
| Storage | JSON files via @tauri-apps/plugin-fs |

## Prerequisites

Sebelum build, pastikan system dependencies berikut sudah terinstall.

### Ubuntu / Debian (22.04+)

```bash
# Build essentials & general tools
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  git

# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js (via NodeSource — v20 LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Tauri 2 system dependencies (WebKitGTK, GTK, etc.)
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf

# TLS / crypto (needed by tauri-plugin-http with native-tls)
sudo apt install -y \
  libssl-dev \
  pkg-config

# Additional libs (GStreamer, Soup — pulled by WebKitGTK but good to have explicit)
sudo apt install -y \
  libglib2.0-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

> **Note:** Pada Ubuntu 26.04 (Plucky) semua package di atas tersedia di repo default. Untuk Ubuntu 22.04/24.04 juga compatible.

### macOS (Homebrew)

```bash
# Xcode Command Line Tools (wajib untuk compiler + linker)
xcode-select --install

# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js
brew install node

# Tauri CLI (optional — bisa juga pakai npx)
cargo install tauri-cli
```

> macOS sudah bundle WebKit (WKWebView) secara native, jadi tidak perlu install GTK/WebKitGTK.

### Windows

```powershell
# Install Visual Studio Build Tools (C++ workload)
# Download dari https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Rust toolchain
# Download dari https://rustup.rs

# Node.js
# Download dari https://nodejs.org (LTS)

# WebView2 (biasanya sudah ada di Windows 10/11)
# Kalau belum: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

### Verify Installation

```bash
# Pastikan semua tool terdeteksi
node --version    # >= 20.x
npm --version     # >= 9.x
rustc --version   # >= 1.77
cargo --version
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Frontend only (browser dev mode, localStorage fallback)
npm run dev

# Full app with Tauri (native features)
npm run tauri dev

# Build for production
npm run tauri build

# Type check
npx vue-tsc --noEmit
```

### Browser vs Tauri mode

`npm run dev` runs the frontend in the browser with fallbacks:
- Storage → localStorage
- HTTP → native fetch (subject to CORS)
- File picker → HTML input

`npm run tauri dev` enables all native features without limitations.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send request | Cmd+Enter |
| New tab | Cmd+T |
| Close tab | Cmd+W |
| Save request | Cmd+S |
| Toggle sidebar | Cmd+B |
| Search collections | Cmd+K |

## Project Structure

```
src/
├── domain/              # Pure TypeScript domain models (zero deps)
├── storage/             # Persistence layer (StorageAdapter, mappers)
├── services/            # Business logic (WorkspaceService, HistoryService, etc.)
├── stores/              # Pinia stores (UI-facing state)
├── components/base/     # Reusable UI components
├── composables/         # Shared reactive logic (useHttp, useTheme, etc.)
├── features/            # Feature-specific components grouped by domain
├── layouts/             # App layout shells
└── assets/styles/       # Tailwind + semantic tokens

src-tauri/
├── src/                 # Rust (Tauri core)
├── capabilities/        # FS/HTTP/Dialog permissions
└── tauri.conf.json      # App config
```

## Documentation

- [FEATURES.md](./FEATURES.md) — full feature list & roadmap
- [docs/architecture/](./docs/architecture/) — system architecture & domain model
- [docs/adr/](./docs/adr/) — architectural decision records

## License

MIT
