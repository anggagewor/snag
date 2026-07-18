# Snag — Features & Roadmap

## Implemented ✅

### Request Builder
- HTTP method selector (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Protocol selector (REST / WebSocket / GraphQL / gRPC) — REST fully functional
- URL input with environment variable highlighting
- Query parameters editor (key-value, enable/disable)
- Request headers editor (key-value, enable/disable, autocomplete)
- cURL paste detection in URL bar
- Variable resolution preview

### Request Body
- JSON editor (CodeMirror with syntax highlighting + prettify)
- Raw body (text, JavaScript, HTML, XML)
- Form Data (multipart) — text + file upload via native picker
- URL-encoded form
- Binary file upload

### Authentication
- No Auth / Bearer Token / Basic Auth / API Key
- Environment variable support in all auth fields

### Scripts
- Pre-request script editor (JavaScript, runs before request)
- Test script editor (JavaScript, runs after response)
- `snag.*` API: variables, request/response context, assertions
- Snippets dropdown for common patterns
- Console output (log/warn/error)
- Pass/fail indicator badges

### Response Viewer
- Status code badge (color-coded) + time + size
- Body with syntax highlighting (JSON, HTML, XML, JS)
- Pretty / Raw toggle + copy to clipboard
- Response headers table
- Console tab (full request/response inspector)
- Loading & error states

### Collections
- Create, rename, delete, duplicate collections
- Nested folder structure (recursive tree)
- Context menu (rename, duplicate, delete, add folder/request)
- Drag & drop reorder
- Collection-level variables
- Copy as cURL (per-request)

### Tabs
- Multi-tab interface with dirty state indicator
- Close (Cmd+W), New (Cmd+T), Save (Cmd+S)
- Unsaved changes warning (Discard / Save & Close / Cancel)
- Deduplicate (same request won't open twice)
- Protocol badge for non-REST tabs

### Environments
- Multiple environments with variable editor
- Set active environment, quick switch from sidebar
- `{{variable}}` substitution (URL, headers, params, body, auth)
- Collection variables (resolved before environment)
- Import/export Postman environment format

### History
- Auto-save after each request, grouped by date
- Click to restore, delete individual entries, clear all
- Configurable max history items

### Import / Export
- Import: Postman Collection v2.1, OpenAPI 3.x / Swagger 2.x (JSON/YAML), Postman Environment
- Export: Postman Collection, Postman Environment, cURL
- Auto-detect format, native file picker + paste

### Search
- Command palette (Cmd+K) — search by name, URL, method, collection
- Keyboard navigation (arrows, Enter, Escape)

### Cookie Jar
- Auto-capture cookies from Set-Cookie response headers
- Auto-send matching cookies on subsequent requests (domain + path matching)
- Per-workspace cookie storage (cookies.json)
- Cookie viewer/editor panel (domain list, table view, delete individual/per-domain/all)
- Handles Secure, HttpOnly, SameSite flags
- Respects cookie expiration and Max-Age
- Accessible via cookie icon in toolbar

### Code Generation
- Generate code snippets from active request
- Targets: JavaScript (Fetch, Axios), Python (requests), Go (net/http), Rust (reqwest), PHP (cURL), cURL
- Modal with language selector + copy to clipboard

### Folder-Level Auth
- Folders can define auth (Bearer, Basic, API Key)
- Requests inherit auth from nearest parent folder when set to "No Auth"
- Resolution walks up the tree: request → folder → parent folder

### Settings
- Theme: Light / Dark / System
- Default HTTP method, timeout, follow redirects, verify SSL
- Default headers (editable, per-header enable/disable)
- Max history items

### UI/UX
- Dark mode (class-based Tailwind)
- Sidebar collapsible (Cmd+B)
- Resizable split pane (request/response)
- HTTP method & protocol color coding
- CodeMirror integration with search (Cmd+F in any editor)
- Bulk edit mode for headers and params (Table / Bulk toggle)
- Custom base components (Button, Input, Select, Dropdown, Modal, etc.)

### Storage
- Workspace-based: one file per request, Git-friendly
- JSON files via Tauri FS plugin
- Browser localStorage fallback (dev mode)

### Multi-Protocol Foundation
- Type definitions for REST, WebSocket, GraphQL, gRPC
- Protocol selector functional in UI
- Backward-compatible (default REST)

---

## Planned 🚀

### Medium Priority (v1.x ~ v2)

| Feature | Description |
|---------|-------------|
| Request chaining | Use response values as input for next request |
| OAuth 2.0 flow | Authorization Code, Client Credentials, PKCE, auto-refresh |
| Proxy settings | HTTP/SOCKS proxy configuration |
| Certificate management | Client certificate (mTLS) |
| Variable scopes | Global → Environment → Collection → Request hierarchy |

### Protocol Implementations (v2+)

| Protocol | Status | Description |
|----------|--------|-------------|
| WebSocket | Types ready | Connect, send messages, view frames real-time |
| GraphQL | Types ready | Schema introspection, query editor, variables panel |
| gRPC | Types ready | Load .proto files, invoke unary + streaming RPCs |
| SSE | Backlog | EventSource stream viewer |

### Nice-to-Have (v2+)

| Feature | Description |
|---------|-------------|
| API documentation viewer | Render OpenAPI spec as readable docs |
| Request diff | Compare responses side-by-side |
| Performance benchmarking | N requests, min/max/avg/p95 |
| Custom themes | User-defined color schemes |
| Plugin system | Extension API for auth, importers, body types |
| Import: Insomnia/HAR | Additional import formats |
| Export: OpenAPI | Generate spec from collection |
| Request examples | Multiple saved examples per request |
| CLI companion | Run collections headless (CI/CD) |
| Mock server | Local mock from OpenAPI spec |
| Load testing | Concurrent requests UI |

---

## Architecture Debt 🔧

| Item | Status |
|------|--------|
| Undo/redo | Backlog — needs history stack per-tab |
| Virtual scrolling (large collections) | Backlog — revisit at >500 items |
| File watcher (external changes) | Backlog — useful for multi-window |
