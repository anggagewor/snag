# Snag — Features & Roadmap

## Implemented Features ✅

### Core Request Builder
- [x] HTTP method selector (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- [x] URL input with environment variable highlighting
- [x] Query parameters editor (key-value, enable/disable per row)
- [x] Request headers editor (key-value, enable/disable per row)
- [x] cURL paste detection — paste cURL command langsung ke URL bar, auto-parse jadi request
- [x] Variable resolution preview (tampil resolved URL di bawah input)
- [x] Send request via `Cmd+Enter`

### Request Body
- [x] JSON body editor (CodeMirror with syntax highlighting)
- [x] Raw body editor (text, JavaScript, HTML, XML)
- [x] Form Data (multipart) — text fields + file upload via native file picker
- [x] URL-encoded form body
- [x] Binary file upload
- [x] JSON format/prettify button

### Authentication
- [x] No Auth
- [x] Bearer Token (with env variable support)
- [x] Basic Auth (username + password, with env variable support)
- [x] API Key (header or query param, with env variable support)

### Response Viewer
- [x] Status code + status text display (color-coded badge)
- [x] Response time (ms) + response size display
- [x] Response body viewer with syntax highlighting (JSON, HTML, XML, JavaScript)
- [x] Pretty / Raw toggle
- [x] Copy response body to clipboard
- [x] Response headers table
- [x] Console tab — full request/response detail (sent headers, resolved URL, response headers, body)
- [x] Loading state (spinner)
- [x] Error state (network errors, timeouts)

### Collections
- [x] Create, rename, delete collections
- [x] Nested folder structure (recursive tree)
- [x] Add request / folder to collection
- [x] Rename items in tree
- [x] Duplicate collection
- [x] Context menu per item (rename, duplicate, delete, add folder, add request)
- [x] Drag-and-drop? — Belum, tapi tree structure sudah support insertAfter

### Tabs
- [x] Multi-tab interface (bisa buka banyak request sekaligus)
- [x] Tab dirty state indicator
- [x] Close tab (`Cmd+W`)
- [x] New tab (`Cmd+T`)
- [x] Save request back to collection (`Cmd+S`)
- [x] Deduplicate — buka item yang sama nggak bikin tab baru
- [x] Settings tab (singleton)
- [x] Environments tab (singleton)

### Environments
- [x] Multiple environments
- [x] Variable editor (key-value, enable/disable per row)
- [x] Set active environment
- [x] `{{variable}}` substitution across URL, headers, body, auth
- [x] Variable resolved at send-time
- [x] Export environment (Postman format)
- [x] Import environment (Postman format)
- [x] Quick switch from sidebar

### History
- [x] Auto-save setiap request yang dikirim
- [x] Grouped by date (Today, Yesterday, Older)
- [x] Click to re-open di tab baru (with response)
- [x] Delete individual entry
- [x] Clear all history
- [x] Max history items (configurable)

### Import / Export
- [x] Import Postman Collection v2.1
- [x] Import OpenAPI 3.x / Swagger 2.x (auto-generate requests per endpoint)
- [x] Import Postman Environment
- [x] Export collection as Postman Collection v2.1
- [x] Export environment as Postman Environment
- [x] Auto-detect format saat import (Postman vs OpenAPI vs Environment)
- [x] File picker (native Tauri dialog) + paste text manual
- [x] YAML support untuk OpenAPI spec

### Settings
- [x] Theme: Light / Dark / System
- [x] Default HTTP method
- [x] Request timeout (configurable)
- [x] Follow redirects toggle
- [x] Verify SSL toggle (disable for self-signed certs)
- [x] Default headers (auto-included, editable, per-header enable/disable)
- [x] Max history items setting

### UI/UX
- [x] Dark mode (class-based, Tailwind)
- [x] Sidebar collapsible (`Cmd+B`)
- [x] Resizable split pane (request/response)
- [x] HTTP method color coding
- [x] CodeMirror editor integration (JSON, HTML, XML, JS)
- [x] Custom base components (Button, Input, Select, Dropdown, Modal, Badge, Tab, Tooltip, etc.)
- [x] Env variable highlighting in inputs (`{{var}}` terlihat beda)

### Storage & Persistence
- [x] JSON file-based storage via Tauri filesystem API
- [x] Auto-save with debounce (300ms)
- [x] Browser localStorage fallback (dev mode)

---

## Planned / Nice-to-Have 🚀

### High Priority (v1.x)

| Feature | Deskripsi |
|---------|-----------|
| **Pre-request scripts** | JavaScript sandbox yang jalan sebelum request (set variables, manipulate headers, generate timestamps/signatures) |
| **Test scripts (post-response)** | Assert response status, body, headers. Basic test runner + pass/fail indicator |
| **Search collections** (`Cmd+K`) | Quick search / command palette buat jump ke request manapun |
| **Drag & drop reorder** | Reorder items di collection tree via drag |
| **Request duplication** | Duplicate request dalam collection (satu klik) |
| **Collection variables** | Variables yang scoped ke collection (bukan global environment) |
| **Unsaved changes warning** | Confirm dialog saat close tab yang dirty |
| **Export collection as cURL** | Generate cURL command dari request yang aktif |

### Medium Priority (v1.x ~ v2)

| Feature | Deskripsi |
|---------|-----------|
| **Cookie jar** | Auto-capture cookies dari response, kirim di request berikutnya. Cookie viewer/editor |
| **Request chaining** | Pakai value dari response A sebagai input request B (extract dari JSON path) |
| **OAuth 2.0 flow** | Full OAuth2 flow UI — Authorization Code, Client Credentials, PKCE. Token auto-refresh |
| **Response body search** | Find text di response body (Cmd+F) |
| **Code generation** | Generate code snippet dari request (JavaScript fetch, Python requests, Go, Rust, etc.) |
| **Proxy settings** | HTTP/SOCKS proxy configuration |
| **Certificate management** | Client certificate (mTLS) support untuk enterprise APIs |
| **Multiple workspaces** | Pisahkan collections per project/workspace |
| **Variable scopes** | Hierarchy: Global → Environment → Collection → Request |
| **Bulk edit mode** | Edit headers/params/body sebagai raw text (kayak Postman bulk edit) |

### Low Priority / Nice-to-Have (v2+)

| Feature | Deskripsi |
|---------|-----------|
| **WebSocket client** | Connect, send messages, view frames real-time |
| **GraphQL support** | Schema introspection, query editor with autocomplete, variables panel |
| **gRPC client** | Load .proto files, invoke unary + streaming RPCs |
| **SSE (Server-Sent Events)** | Stream viewer buat EventSource connections |
| **API documentation viewer** | Render OpenAPI spec sebagai readable docs |
| **Request diff** | Compare dua response side-by-side |
| **Performance benchmarking** | Kirim request N kali, tampilkan min/max/avg/p95 |
| **Response visualization** | Chart/graph buat numeric response data |
| **Custom themes** | User-defined color scheme beyond light/dark |
| **Plugin system** | Extension API buat custom auth methods, importers, body types |
| **Import: Insomnia** | Import Insomnia collection format |
| **Import: HAR** | Import browser HAR files jadi collection |
| **Export: OpenAPI** | Generate OpenAPI spec dari collection |
| **Folder-level auth** | Inherit auth config dari folder/collection ke child requests |
| **Request examples** | Multiple saved examples per request (different body/params) |
| **Markdown notes** | Attach notes/docs ke request atau collection |
| **Keyboard shortcuts customization** | User-defined keybindings |
| **CLI companion** | Run Snag collections dari terminal (headless, CI/CD) |
| **Snippet library** | Reusable request body / header templates |

### Exploratory / Future Vision

| Feature | Deskripsi |
|---------|-----------|
| **Team sync** | Cloud-based collection sharing (kalau eventually mau SaaS) |
| **Git integration** | Simpan collections sebagai versioned files, sync dengan Git repo |
| **AI assistant** | Generate requests dari natural language, auto-suggest test assertions |
| **Mock server** | Jalankan local mock server dari OpenAPI spec / collection |
| **Load testing** | Simple load test UI (concurrent requests, ramp-up) |
| **API monitoring** | Scheduled requests + alerting kalau response berubah/gagal |

---

## Architecture Debt / Improvements 🔧

| Item | Status | Notes |
|------|--------|-------|
| Tab state persistence | ✅ Done | Tabs auto-saved ke `tabs.json`, restored on restart (response data excluded — terlalu besar & stale) |
| Request timeout enforcement | ✅ Done | AbortController + configurable timeout dari settings. Cancel button di response panel |
| Error boundary | ✅ Done | Global error handler catch unhandled rejections & errors, toast stack di bottom-right, auto-dismiss 8s, copy error |
| Accessibility | ✅ Done | ARIA tree roles, keyboard nav (Arrow Up/Down, Enter/Space, Left/Right untuk expand/collapse), focus trap di modals, Escape to close |
| Undo/redo | ❌ Backlog | Undo perubahan di request builder (butuh history stack per-tab) |
| Performance (large collections) | ❌ Backlog | Virtual scrolling — premature sekarang, revisit kalau >500 items di tree |
| File watcher | ❌ Backlog | Detect external changes ke JSON storage files (useful kalau multi-window) |

---

## Status Summary

| Category | Count |
|----------|-------|
| Implemented features | ~50+ |
| High priority backlog | 8 |
| Medium priority backlog | 10 |
| Nice-to-have / future | 20+ |
