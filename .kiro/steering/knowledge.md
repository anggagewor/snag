---
inclusion: always
---

# Snag — Knowledge Base

## Project Overview

Snag adalah Postman clone yang dibangun dengan Tauri 2 + Vue 3 + TypeScript. Desktop app untuk macOS (primary), dengan potensi cross-platform later. Supports multiple API protocols (REST, WebSocket, GraphQL, gRPC) — REST fully functional, others dalam development.

## Architecture Decisions

### ADR-001: Tauri Plugin HTTP untuk Request Engine
- **Decision:** Gunakan `@tauri-apps/plugin-http` sebagai HTTP client
- **Reason:** Bypass CORS restrictions, native performance, support semua HTTP methods + custom headers tanpa browser limitations
- **Consequence:** Request dikirim dari Rust side, bukan browser fetch

### ADR-002: Workspace-Based Storage (v1)
- **Decision:** Workspace sebagai unit storage utama. File-per-request. Storage is an implementation detail.
- **Reason:** Git-friendly (1 request = 1 file, minimal conflict), portable (zip workspace = done), lazy-loadable, scalable
- **Consequence:** Migration dari v0 (single-file) ke v1 (workspace). Semua akses data melalui WorkspaceService.
- **Storage layout:**
  ```
  ~/.snag/                          (Global — milik user)
  ├── settings.json
  ├── workspaces.json               (Registry/cache)
  ├── history/                      (Global, cross-workspace)
  └── scratch/                      (Scratch Pad workspace)

  <user-chosen-path>/               (Workspace — portable unit)
  ├── workspace.json                (Manifest: type, version, id, name, collections[])
  ├── collections/<ULID>.collection.json  (Tree only: folders + request ID refs)
  ├── requests/<ULID>.request.json        (Full request data, self-contained)
  ├── environments/<ULID>.environment.json
  └── settings.json                 (Workspace-level settings)
  ```
- **File format contract:** Setiap JSON file wajib punya `{ "type": "...", "version": 1, "id": "ULID", ... }`
- **ID format:** ULID (sortable, short, filename-friendly)
- **ADR docs:** `docs/adr/001-workspace-storage-format.md`, `docs/adr/002-workspace-api-architecture.md`

### ADR-003: Custom UI Components (No Library)
- **Decision:** Bikin base component sendiri dari scratch dengan Tailwind
- **Reason:** Full control atas look & feel, no bloat, reusable across project, consistent design language
- **Consequence:** Butuh effort lebih di awal, tapi long-term lebih flexible

### ADR-004: Tab-Based Navigation
- **Decision:** Main workspace menggunakan tab system (kayak browser/Postman)
- **Reason:** User familiar, bisa buka multiple requests simultaneously, settings/other pages juga rendered as tabs
- **Consequence:** Tab state management perlu robust (dirty state, close confirmation, etc.)

### ADR-005: Class-Based Dark Mode
- **Decision:** Tailwind dark mode dengan strategy `class` (toggle `.dark` di root element)
- **Reason:** User-controlled theme preference, bisa toggle tanpa depend on OS setting (tapi juga bisa follow system)
- **Consequence:** Semua component harus define `dark:` variants

### ADR-006: Pinia for State Management
- **Decision:** Pinia sebagai centralized state management
- **Reason:** Official Vue recommendation, good TypeScript support, devtools integration, modular by design
- **Consequence:** State harus diakses lewat store actions, bukan direct mutation

### ADR-007: Feature-Based Folder Structure
- **Decision:** Components di-group by feature domain, bukan by type
- **Reason:** Colocation — related files dekat satu sama lain, easier navigation, scalable
- **Consequence:** `src/features/{name}/` jadi primary location untuk feature code

### ADR-008: Multi-Protocol Type Foundation
- **Decision:** Define type system untuk semua protocol (REST, WebSocket, GraphQL, gRPC) sekaligus, walau hanya REST yang implemented
- **Reason:** Avoid refactoring later. CollectionItem, Tab, dan store sudah siap handle multiple protocols tanpa breaking change
- **Consequence:** `ProtocolType` enum di common.ts, per-protocol config types, backward-compatible (default to REST if omitted)
- **Pattern:** Protocol-specific configs are optional fields on CollectionItem and Tab. Use `getItemProtocol()` helper for resolution.

### ADR-009: Script Sandbox via Function Constructor
- **Decision:** Pre-request & test scripts dijalankan via `new Function()` dengan sandboxed API (`snag.*`)
- **Reason:** Lightweight, no extra dependency, cukup untuk v1. Tidak perlu Worker/iframe overhead.
- **Consequence:** Scripts jalan di main thread (acceptable untuk short scripts). `snag` object jadi public API yang harus stabil.
- **API surface:** `snag.variables.get/set`, `snag.request`, `snag.response`, `snag.test()`, `snag.expect()`

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Tauri | 2.x |
| Frontend Framework | Vue | 3.5+ |
| Language | TypeScript | 5.6+ |
| Build Tool | Vite | 6.x |
| Styling | Tailwind CSS | 4.x |
| State Management | Pinia | latest |
| HTTP Client | @tauri-apps/plugin-http | 2.x |
| Storage | @tauri-apps/plugin-fs | 2.x |
| Backend | Rust (Tauri core) | 2021 edition |

## Feature Scope (v1)

### Included
- [x] Request builder (method, URL, headers, body, params, auth)
- [x] Response viewer (body, headers, status code, timing)
- [x] Collections & folders (tree structure, drag & drop, variables)
- [x] Environment variables (multiple envs, variable substitution)
- [x] Collection variables (scoped per collection)
- [x] Request history (auto-saved)
- [x] Import/export (cURL, Postman collection format)
- [x] Pre-request scripts & tests (basic scripting with snag.* API)
- [x] Search/command palette (Cmd+K)
- [x] Settings panel (theme, defaults, etc.)
- [x] Multi-protocol foundation (types ready for WS, GQL, gRPC)

### Excluded (for now)
- [ ] WebSocket UI (types ready, panel pending)
- [ ] GraphQL UI (types ready, panel pending)
- [ ] gRPC UI (types ready, panel pending)
- [ ] Team collaboration / sync
- [ ] Cloud storage
- [ ] OAuth2 flow UI (manual token input only for v1)

## Protocol System

### ProtocolType Enum
```typescript
enum ProtocolType {
  REST = 'rest',        // ✅ Fully implemented
  WEBSOCKET = 'websocket',  // 🟡 Types ready, UI coming soon
  GRAPHQL = 'graphql',      // 🟡 Types ready, UI coming soon
  GRPC = 'grpc',            // 🟡 Types ready, UI coming soon
}
```

### Type Files
```
src/types/
├── common.ts        → ProtocolType, HttpMethod, KeyValuePair, UUID
├── request.ts       → RequestConfig, ResponseData (REST)
├── websocket.ts     → WebSocketConfig, WebSocketSession, WebSocketMessage
├── graphql.ts       → GraphQLConfig, GraphQLResponseData
├── grpc.ts          → GrpcConfig, GrpcResponseData
├── collection.ts    → CollectionItem (multi-protocol), Collection
└── environment.ts   → Environment, EnvironmentVariable
```

### Protocol-aware Components
- `RequestUrlBar.vue` — protocol selector, adapts UI per protocol (method selector hides for non-REST, button label changes, "Coming Soon" badge for unimplemented)
- `TabBar.vue` — shows protocol badge (WS/GQL/gRPC) on tabs
- `CollectionTreeItem.vue` — items can be any protocol type

## Design Tokens (Semantic Colors)

```
Surface:     bg-surface / dark:bg-surface       → main background
Surface Alt: bg-surface-alt / dark:bg-surface-alt → sidebar, panels
Primary:     text-primary / dark:text-primary    → main text
Secondary:   text-secondary / dark:text-secondary → muted text
Accent:      bg-accent / text-accent             → interactive elements, links
Border:      border-muted / dark:border-muted    → dividers, input borders
Success:     text-success / bg-success           → 2xx responses
Warning:     text-warning / bg-warning           → 3xx, 4xx, coming soon badges
Error:       text-error / bg-error               → 5xx, errors
```

## HTTP Method Color Coding

| Method | Color |
|--------|-------|
| GET | Green |
| POST | Orange |
| PUT | Blue |
| PATCH | Purple |
| DELETE | Red |
| HEAD | Gray |
| OPTIONS | Pink |

## Protocol Color Coding

| Protocol | Color | Badge |
|----------|-------|-------|
| REST | Green (via method) | Method badge (GET/POST/etc) |
| WebSocket | Amber | WS |
| GraphQL | Pink | GQL |
| gRPC | Blue | gRPC |

## Keyboard Shortcuts

| Action | Shortcut | Status |
|--------|----------|--------|
| Send request | `Cmd+Enter` | ✅ |
| New tab | `Cmd+T` | ✅ |
| Close tab | `Cmd+W` | ✅ |
| Save request | `Cmd+S` | ✅ |
| Toggle sidebar | `Cmd+B` | ✅ |
| Search collections | `Cmd+K` | ✅ |
| Switch environment | `Cmd+E` | Planned |

## Conventions & Patterns

### Request Lifecycle
1. User edits request in builder
2. Pre-request script runs (variable substitution, custom logic via `snag.*` API)
3. Collection variables resolved (if tab has sourceId)
4. Environment variables resolved
5. Request sent via Tauri HTTP plugin
6. Response received
7. Post-response test scripts run (`snag.test()`, `snag.expect()`)
8. Response displayed in viewer
9. Request+response saved to history

### Variable Substitution
- Syntax: `{{variable_name}}`
- Resolution order: collection-level → environment-level
- Resolved at send-time, not at edit-time
- Pre-request scripts can set variables via `snag.variables.set()` before resolution

### Script API (snag.*)
```javascript
// Variables
snag.variables.get('key')        // → string | undefined
snag.variables.set('key', 'val') // set for this execution

// Request context (read-only)
snag.request.url
snag.request.method
snag.request.headers

// Response context (test scripts only)
snag.response.status
snag.response.statusText
snag.response.headers
snag.response.body
snag.response.time
snag.response.size

// Testing
snag.test('Test name', () => { ... })
snag.expect(value).toBe(expected)
snag.expect(value).toEqual(expected)
snag.expect(value).toContain(str)
snag.expect(value).toBeTruthy()
snag.expect(value).toBeFalsy()
snag.expect(value).toBeGreaterThan(n)
snag.expect(value).toBeLessThan(n)
snag.expect(value).toHaveProperty(key)

// Console
console.log(...args)
console.warn(...args)
console.error(...args)
```

### Collection File Format
```json
{
  "id": "uuid",
  "name": "My Collection",
  "variables": [{ "key": "baseUrl", "value": "https://api.example.com" }],
  "items": [
    {
      "id": "uuid",
      "type": "folder",
      "name": "Auth",
      "items": [...]
    },
    {
      "id": "uuid",
      "type": "request",
      "protocol": "rest",
      "name": "Get Users",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/users",
        "headers": [],
        "params": [],
        "body": { "type": "none" },
        "auth": { "type": "none" }
      }
    }
  ]
}
```

## State Ownership

Collections Store
- owns collections
- owns folder tree
- owns moveItem (drag & drop)

Tabs Store
- owns opened tabs
- owns active request state
- owns dirty state
- owns close confirmation (pendingCloseTabId)
- owns protocol per tab

History Store
- owns request history

Environment Store
- owns environments
- owns variables
- owns variable resolution (accepts optional collection variables)

Settings Store
- owns user preferences

Components never own application state.

## Data Flow

## Data Flow

```
UI Components
    ↓
Pinia Stores (workspaceStore, tabsStore, etc.)
    ↓
Services (WorkspaceService, HistoryService, SettingsService)
    ↓
StorageAdapter
    ↓
Tauri FS Plugin / Platform
```

Layer rules:
- UI → Store only (never call services directly)
- Store → Service only (never call storage directly)
- Service → StorageAdapter only (never call Tauri directly)
- Domain is imported by all layers but imports nothing

## Source of Truth

Workspace, Collections, Requests, Environments
→ workspaceStore (delegates to WorkspaceService)

Tabs
→ tabs store

History (global, cross-workspace)
→ HistoryService

Settings (global + workspace merged)
→ SettingsService

Workspace Registry
→ RegistryService

HTTP execution
→ useHttp()

Script execution
→ useScriptRunner()

Persistence
→ StorageAdapter (replaces old useStorage composable)

## Extension Points

New authentication methods
→ features/request/RequestAuth.vue

New request body types
→ features/request/

New import formats
→ utils/import-*.ts

New export formats
→ utils/export-*.ts

HTTP middleware
→ composables/useHttp.ts

Script API extensions
→ composables/useScriptRunner.ts

New protocol implementations
→ types/{protocol}.ts + features/{protocol}/ + composables/use{Protocol}.ts

Persistence
→ composables/useStorage.ts

## File Structure

```
src/
├── domain/                # Pure TypeScript domain models (zero deps)
│   ├── ids.ts             # Branded ID types (WorkspaceId, RequestId, etc.)
│   ├── http.ts            # HttpMethod, ProtocolType, KeyValuePair
│   ├── ulid.ts            # ULID generator
│   ├── Workspace.ts       # Workspace, WorkspaceEntry
│   ├── Collection.ts      # Collection, TreeNode, Folder, RequestRef
│   ├── Request.ts         # Request, Body, Auth, Meta
│   ├── Environment.ts     # Environment, EnvironmentVariable
│   ├── History.ts         # HistoryEntry
│   └── Settings.ts        # GlobalSettings, WorkspaceSettings
├── storage/               # Persistence layer (imports domain only)
│   ├── models.ts          # File format schemas (type + version)
│   ├── StorageAdapter.ts  # Interface (swappable backend)
│   ├── TauriStorageAdapter.ts # Concrete: Tauri FS + browser fallback
│   └── mappers.ts         # Domain ↔ File conversion
├── services/              # Business logic (imports domain + storage)
│   ├── WorkspaceService.ts    # Interface + createWorkspaceService.ts
│   ├── RegistryService.ts     # Interface + createRegistryService.ts
│   ├── HistoryService.ts      # Interface + createHistoryService.ts
│   ├── SettingsService.ts     # Interface + createSettingsService.ts
│   ├── provider.ts            # Singleton service instances
│   ├── migration.ts           # v0 → v1 migration
│   ├── scratch.ts             # Scratch Pad init
│   └── startup.ts             # App startup orchestrator
├── stores/                # Pinia stores (imports domain + services)
│   ├── workspace.ts       # NEW: workspace-aware store
│   ├── collections.ts     # LEGACY: will be removed after UI migration
│   ├── environments.ts    # LEGACY
│   ├── history.ts         # LEGACY
│   ├── settings.ts        # LEGACY
│   └── tabs.ts            # Will be updated to use workspace store
├── components/base/       # Generic, reusable UI components
├── composables/           # Shared reactive logic
│   ├── useHttp.ts         # REST request execution
│   ├── useScriptRunner.ts # Pre-request & test script sandbox
│   ├── useStorage.ts      # LEGACY (replaced by StorageAdapter)
│   ├── useKeyboard.ts     # Global keyboard shortcuts
│   └── useTheme.ts        # Theme management
├── features/              # Feature-specific components
│   ├── environments/      # Environment management
│   ├── history/           # Request history
│   ├── request/           # Request builder
│   ├── response/          # Response viewer
│   ├── search/            # Command palette (Cmd+K)
│   ├── settings/          # Settings panel
│   ├── sidebar/           # Collection tree, import modal
│   └── tabs/              # Tab bar, tab content router
├── layouts/               # App layout shells
├── types/                 # LEGACY type definitions (being replaced by domain/)
├── utils/                 # Pure utility functions
└── assets/styles/         # Global styles, Tailwind config
```

## Notes / Backlog Ideas

- Response body syntax highlighting ✅ (CodeMirror)
- Certificate management untuk mTLS
- Proxy settings
- Cookie jar management
- Request chaining (use response from A as input to B)
- WebSocket panel (types ready at `src/types/websocket.ts`)
- GraphQL panel with schema introspection (types ready at `src/types/graphql.ts`)
- gRPC panel with proto loading (types ready at `src/types/grpc.ts`)
