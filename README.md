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
  <img src="https://img.shields.io/github/license/anggagewor/snag?style=for-the-badge">
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


# Snag

A fast, lightweight API client built with Tauri + Vue. Think Postman, but native and snappy.

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

## Features

- **Request Builder** — method, URL, headers, params, body (JSON, raw, form-data, URL-encoded, binary), auth (Bearer, Basic, API Key)
- **Response Viewer** — body with line numbers, pretty/raw toggle, headers table, status/time/size badges, copy to clipboard, resizable split pane
- **Console** — full request/response inspector: actual sent headers (including defaults + Snag-Token), response headers, response body, timing
- **Collections** — tree structure with nested folders, rename, duplicate, delete, three-dot context menu at every level
- **Environment Variables** — multiple environments, quick switch from URL bar, `{{variable}}` autocomplete in all input fields (URL, headers, params, auth, body), inline create/edit via modal
- **Tabs** — multi-tab workspace, dirty indicator, double-click to rename, save to collection (with folder picker), linked tabs (same item = same tab), per-tab save button
- **History** — auto-saved after each request, grouped by date, click to restore (deduplicates tabs), delete individual entries
- **Settings** — theme (light/dark/system), default method, timeout, follow redirects, max history, configurable default headers (User-Agent, Accept, Accept-Encoding, Snag-Token)
- **File Upload** — form-data file fields (per-row text/file toggle) + binary body via native file picker
- **Header Autocomplete** — standard HTTP headers with context-aware value suggestions (Content-Type, Accept, Cache-Control, etc.)
- **cURL Import** — paste a cURL command in the URL bar, auto-fills method, URL, headers, body, and auth
- **Import Collections** — Postman Collection v2.1 (JSON) and OpenAPI 3.x / Swagger 2.x (JSON or YAML)
- **Bulk Edit** — params and headers have a Table/Bulk Edit toggle (textarea, one `key:value` per line)
- **Default Headers** — auto-injected headers (configurable in settings): User-Agent, Accept, Accept-Encoding, Snag-Token (unique UUID per request)

## Project Structure

```
src/
├── assets/styles/       # Tailwind + semantic color tokens + dark mode
├── components/base/     # Reusable UI (Button, Input, Select, Modal, Dropdown, SplitPane, etc.)
├── composables/         # useHttp, useStorage, useTheme
├── features/
│   ├── environments/    # Environment panel, selector, inline variable management
│   ├── history/         # History panel (grouped by date)
│   ├── request/         # URL bar, headers, params, body, auth, form-data, binary
│   ├── response/        # Response viewer (body, headers, console)
│   ├── settings/        # Settings panel
│   ├── sidebar/         # Sidebar (collections tree, history, envs, import modal)
│   └── tabs/            # Tab bar + tab content router
├── layouts/             # DefaultLayout (sidebar + main)
├── stores/              # Pinia (collections, environments, history, tabs, settings)
├── types/               # TypeScript types (request, collection, environment, common)
└── utils/               # Formatters, HTTP headers, cURL parser, Postman importer, OpenAPI importer

src-tauri/
├── src/                 # Rust (Tauri plugins: http, fs, dialog, opener)
├── capabilities/        # Permissions (http, fs, dialog)
└── tauri.conf.json      # App config
```

## Development

```bash
# Install dependencies
npm install

# Frontend only (browser, no Tauri features)
npm run dev

# Full app with Tauri (native features: file picker, HTTP bypass CORS, file storage)
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
- File picker → prompt dialog

`npm run tauri dev` enables all native features without limitations.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Send request | Cmd+Enter |
| New tab | Cmd+T |
| Close tab | Cmd+W |
| Save request | Cmd+S |

## Import Support

| Format | Source |
|--------|--------|
| Postman Collection | v2.1 JSON (folders, requests, headers, body, auth, variables) |
| OpenAPI Spec | 3.x / Swagger 2.x, JSON or YAML (tags → folders, paths → requests, schemas → example bodies, security → auth) |
| cURL | Paste in URL bar (method, URL, headers, body, basic auth) |

## Roadmap

- [ ] Export collection (Postman format)
- [ ] Pre-request scripts & tests
- [ ] Code editor (Monaco/CodeMirror) for body & scripts
- [ ] Response syntax highlighting
- [ ] Cookie jar management
- [ ] Proxy settings
- [ ] Certificate management (mTLS)
- [ ] Request chaining
