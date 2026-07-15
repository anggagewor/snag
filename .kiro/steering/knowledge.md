---
inclusion: always
---

# Snag — Knowledge Base

## Project Overview

Snag adalah Postman clone yang dibangun dengan Tauri 2 + Vue 3 + TypeScript. Desktop app untuk macOS (primary), dengan potensi cross-platform later.

## Architecture Decisions

### ADR-001: Tauri Plugin HTTP untuk Request Engine
- **Decision:** Gunakan `@tauri-apps/plugin-http` sebagai HTTP client
- **Reason:** Bypass CORS restrictions, native performance, support semua HTTP methods + custom headers tanpa browser limitations
- **Consequence:** Request dikirim dari Rust side, bukan browser fetch

### ADR-002: JSON File-Based Storage
- **Decision:** Persistence menggunakan JSON files via Tauri filesystem API
- **Reason:** Simple, human-readable, easy to debug, export-friendly. Bisa migrate ke SQLite later kalau perlu performance
- **Consequence:** File locking perlu di-handle manual, large collections mungkin slow (acceptable untuk v1)
- **Storage location:** App data directory (Tauri `appDataDir`)
- **File structure:**
  ```
  {appDataDir}/
  ├── collections.json
  ├── environments.json
  ├── history.json
  └── settings.json
  ```

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
- [x] Collections & folders (tree structure)
- [x] Environment variables (multiple envs, variable substitution)
- [x] Request history (auto-saved)
- [x] Import/export (cURL, Postman collection format)
- [x] Pre-request scripts & tests (basic scripting)
- [x] Settings panel (theme, defaults, etc.)

### Excluded (for now)
- [ ] WebSocket support
- [ ] GraphQL support
- [ ] Team collaboration / sync
- [ ] Cloud storage
- [ ] OAuth2 flow UI (manual token input only for v1)

## Design Tokens (Semantic Colors)

```
Surface:     bg-surface / dark:bg-surface       → main background
Surface Alt: bg-surface-alt / dark:bg-surface-alt → sidebar, panels
Primary:     text-primary / dark:text-primary    → main text
Secondary:   text-secondary / dark:text-secondary → muted text
Accent:      bg-accent / text-accent             → interactive elements, links
Border:      border-muted / dark:border-muted    → dividers, input borders
Success:     text-success / bg-success           → 2xx responses
Warning:     text-warning / bg-warning           → 3xx, 4xx
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

## Keyboard Shortcuts (Planned)

| Action | Shortcut |
|--------|----------|
| Send request | `Cmd+Enter` |
| New tab | `Cmd+T` |
| Close tab | `Cmd+W` |
| Save request | `Cmd+S` |
| Toggle sidebar | `Cmd+B` |
| Search collections | `Cmd+K` |
| Switch environment | `Cmd+E` |

## Conventions & Patterns

### Request Lifecycle
1. User edits request in builder
2. Pre-request script runs (variable substitution, custom logic)
3. Request sent via Tauri HTTP plugin
4. Response received
5. Post-response tests run
6. Response displayed in viewer
7. Request+response saved to history

### Variable Substitution
- Syntax: `{{variable_name}}`
- Resolution order: request-level → collection-level → environment-level → global
- Resolved at send-time, not at edit-time

### Collection File Format
```json
{
  "id": "uuid",
  "name": "My Collection",
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
      "name": "Get Users",
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/users",
        "headers": [],
        "params": [],
        "body": null,
        "auth": null
      }
    }
  ]
}
```

## State Ownership

Collections Store
- owns collections
- owns folder tree

Tabs Store
- owns opened tabs
- owns active request state
- owns dirty state

History Store
- owns request history

Environment Store
- owns environments
- owns variables

Settings Store
- owns user preferences

Components never own application state.

## Data Flow

UI Components
    ↓
Feature Components
    ↓
Pinia Store Actions
    ↓
Composables
    ↓
Tauri Plugins
    ↓
Filesystem / HTTP

Never call Tauri plugins directly from UI components.

## Source of Truth

Collections
→ collections store

Tabs
→ tabs store

History
→ history store

Environment variables
→ environments store

HTTP execution
→ useHttp()

Persistence
→ useStorage()

## Extension Points

New authentication methods
→ features/request/RequestAuth.vue

New request body types
→ features/request/

New import formats
→ utils/import-*.ts

HTTP middleware
→ composables/useHttp.ts

Persistence
→ composables/useStorage.ts

## Notes / Backlog Ideas

- Code editor integration (Monaco/CodeMirror) untuk body editing & scripts
- Response body syntax highlighting
- Certificate management untuk mTLS
- Proxy settings
- Cookie jar management
- Request chaining (use response from A as input to B)
