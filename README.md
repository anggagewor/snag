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
- **Response Viewer** — body with line numbers, pretty/raw toggle, headers table, status/time/size badges, copy to clipboard
- **Collections** — tree structure with folders, rename, duplicate, delete, three-dot context menu
- **Environment Variables** — multiple environments, quick switch, `{{variable}}` syntax with autocomplete in all input fields, inline create/edit from URL bar
- **Tabs** — multi-tab workspace, dirty indicator, double-click to rename, save to collection, linked tabs (re-open activates existing tab)
- **History** — auto-saved, grouped by date, click to restore request + response
- **Settings** — theme (light/dark/system), default method, timeout, follow redirects, max history
- **File Upload** — form-data file fields + binary body via native file picker
- **Header Autocomplete** — standard HTTP headers with context-aware value suggestions

## Project Structure

```
src/
├── assets/styles/       # Tailwind + semantic color tokens
├── components/base/     # Reusable UI (Button, Input, Select, Modal, Dropdown, etc.)
├── composables/         # useHttp, useStorage, useTheme
├── features/
│   ├── environments/    # Environment panel + selector
│   ├── history/         # History panel
│   ├── request/         # URL bar, headers, params, body, auth
│   ├── response/        # Response viewer
│   ├── settings/        # Settings panel
│   ├── sidebar/         # Sidebar + collection tree
│   └── tabs/            # Tab bar + tab content router
├── layouts/             # DefaultLayout (sidebar + main)
├── stores/              # Pinia (collections, environments, history, tabs, settings)
├── types/               # TypeScript types (request, collection, environment, common)
└── utils/               # Formatters, HTTP header data, curl parser (planned)

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

## Roadmap

- [ ] Import/Export (cURL, Postman collection)
- [ ] Pre-request scripts & tests
- [ ] Code editor (Monaco/CodeMirror) for body & scripts
- [ ] Response syntax highlighting
- [ ] Cookie jar management
- [ ] Proxy settings
- [ ] Certificate management (mTLS)
- [ ] Request chaining
