# Snag Domain Model

## Ubiquitous Language

Istilah-istilah ini adalah bahasa resmi Snag. Semua kode, dokumentasi, dan UI harus konsisten menggunakan istilah ini.

| Term | Definition |
|------|-----------|
| **Workspace** | Unit organisasi tertinggi. Sebuah folder di filesystem yang berisi semua aset API project. Self-contained dan portable. |
| **Scratch Pad** | Workspace bawaan yang selalu ada. Persistent, tapi tidak bisa di-Git atau di-share. Tempat request baru sebelum dipindahkan ke workspace. |
| **Collection** | Grouping logical untuk request. Berisi tree structure (folder + request references). Tidak menyimpan data request. |
| **Tree** | Struktur hierarki di dalam collection. Terdiri dari Folder nodes dan Request references. Satu-satunya source of truth untuk posisi request. |
| **Folder** | Node di dalam tree. Bisa nested. Hanya mengatur organisasi visual, tidak punya data selain nama dan children. |
| **Request** | Unit kerja utama. Self-contained file yang berisi semua informasi untuk mengirim satu API call. Tidak tahu posisinya di tree. |
| **Environment** | Sekumpulan variabel yang bisa di-switch. Scoped per workspace. |
| **Variable** | Key-value pair di dalam environment atau collection. Disubstitusi saat runtime via `{{key}}` syntax. |
| **History Entry** | Record dari satu eksekusi request. Global (cross-workspace). Immutable setelah dibuat. |
| **Registry** | Cache global yang melacak workspace yang pernah dibuka. Bukan database — bisa stale. |
| **Settings** | Preferensi user. Dua layer: Global (milik user) dan Workspace (milik project). |
| **Runtime State** | State sementara yang tidak di-persist sebagai settings. Tab positions, scroll, expanded folders. |

## Entity Relationships

```
Workspace
│
├── owns ──── Collection (1..*)
│                │
│                └── owns ──── Tree
│                                │
│                                ├── contains ──── Folder (0..*)
│                                │                    │
│                                │                    └── contains ──── Folder | RequestRef
│                                │
│                                └── contains ──── RequestRef (0..*)
│                                                      │
│                                                      └── references ──── Request
│
├── owns ──── Request (0..*)
│                │
│                ├── owns ──── Body
│                ├── owns ──── Auth
│                ├── owns ──── Headers
│                ├── owns ──── Params
│                ├── owns ──── PreRequestScript
│                └── owns ──── TestScript
│
├── owns ──── Environment (0..*)
│                │
│                └── owns ──── Variable (0..*)
│
├── owns ──── Settings (workspace-level)
│
├── owns ──── Certificate (0..*) [future]
│
└── owns ──── SharedScript (0..*) [future]


Registry (global)
│
└── tracks ──── WorkspaceEntry (0..*)
                    │
                    └── points to ──── Workspace (by path)


History (global)
│
└── contains ──── HistoryEntry (0..*)
                    │
                    ├── references ──── Workspace (by ID, nullable)
                    └── snapshots ──── Request execution data
```

## Aggregate Boundaries

Aggregates define consistency boundaries. Operations within an aggregate are atomic. Cross-aggregate operations are eventually consistent.

```
┌─────────────────────────────────────────┐
│ Aggregate: Workspace                     │
│                                          │
│  Root: Workspace                         │
│  Contains: manifest data, settings ref   │
│  Invariants:                             │
│    - ID is unique (ULID)                 │
│    - Name is non-empty                   │
│    - collections[] contains valid IDs    │
│                                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Aggregate: Collection                    │
│                                          │
│  Root: Collection                        │
│  Contains: Tree (folders + request refs) │
│  Invariants:                             │
│    - Tree is acyclic                     │
│    - RequestRef IDs are non-empty        │
│    - Folder names unique within parent   │
│    - No duplicate requestId in tree      │
│                                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Aggregate: Request                       │
│                                          │
│  Root: Request                           │
│  Contains: body, auth, headers, params,  │
│            scripts, meta                 │
│  Invariants:                             │
│    - ID is unique (ULID)                 │
│    - protocol is valid ProtocolType      │
│    - method is valid for protocol        │
│                                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Aggregate: Environment                   │
│                                          │
│  Root: Environment                       │
│  Contains: variables[]                   │
│  Invariants:                             │
│    - ID is unique (ULID)                 │
│    - Name is non-empty                   │
│    - Variable keys non-empty             │
│                                          │
└─────────────────────────────────────────┘
```

## Immutability Rule

Domain objects are **immutable values**. Never mutate in place.

```
❌ BAD
request.url = 'https://...'
request.headers.push({ key: 'X-Auth', value: '...' })

✅ GOOD
const updated = updateRequest(request, { url: 'https://...' })
const updated = addHeader(request, { key: 'X-Auth', value: '...' })
```

Benefits:
- Undo/redo: simpan previous state, swap back
- Dirty checking: `current !== saved` (reference equality)
- Autosave: debounce changes, persist latest snapshot
- History: setiap mutation menghasilkan snapshot baru
- Debugging: state timeline jelas

## Decision Matrix — Data Location

| Entity | Global | Workspace | Runtime (memory) |
|--------|--------|-----------|-----------------|
| Theme | ✅ | | |
| Font / Window | ✅ | | |
| Keybindings | ✅ | | |
| History | ✅ | | |
| Workspace Registry | ✅ | | |
| Scratch Pad | ✅ (special workspace) | | |
| Collection | | ✅ | |
| Request | | ✅ | |
| Environment | | ✅ | |
| Collection Variables | | ✅ | |
| Certificates | | ✅ | |
| Shared Scripts | | ✅ | |
| Workspace Settings | | ✅ | |
| Default Environment | | ✅ | |
| Proxy Config | | ✅ | |
| Active Tab | | | ✅ |
| Tab Order | | | ✅ |
| Split Pane Size | | | ✅ |
| Expanded Folders | | | ✅ |
| Scroll Position | | | ✅ |
| Unsaved Changes | | | ✅ |
| Search Query | | | ✅ |

**Rule:** Jika penting saat workspace dipindahkan ke komputer lain → Workspace.
Jika milik user bukan project → Global. Jika hilang saat restart acceptable → Runtime.

## Operation Semantics

### Workspace Operations
| Operation | Meaning |
|-----------|---------|
| `openWorkspace` | Load manifest, hydrate stores, validate health |
| `closeWorkspace` | Persist dirty state, clear stores, release resources |
| `createWorkspace` | Create folder structure, write manifest, register |
| `switchWorkspace` | close current → open target |

### Collection Operations
| Operation | Meaning |
|-----------|---------|
| `createCollection` | New tree file, register in workspace manifest |
| `deleteCollection` | Remove tree file, unregister. Requests become orphans. |
| `addFolder` | Insert folder node into tree |
| `removeFolder` | Remove folder + all children refs (requests become orphans) |
| `moveItem` | Reorder/reparent node within tree |

### Request Operations
| Operation | Meaning |
|-----------|---------|
| `createRequest` | New request file + add ref to collection tree |
| `loadRequest` | Read request file from disk (lazy) |
| `saveRequest` | Write full request to disk |
| `deleteRequest` | Remove file + remove ref from all trees |
| `duplicateRequest` | New file with copied content + new ID |
| `moveRequest` | Update tree refs (remove from source, add to target) |

### Environment Operations
| Operation | Meaning |
|-----------|---------|
| `createEnvironment` | New environment file |
| `deleteEnvironment` | Remove file, clear defaultEnvironment if was active |
| `resolveVariables` | Collection vars → Environment vars → substituted string |

## Cross-Cutting Concerns

### Orphan Detection
```
On workspace open (async, non-blocking):
  allRequestFiles = scan requests/*.request.json
  allReferencedIds = flatten all collection trees → requestId set
  orphans = allRequestFiles - allReferencedIds
  if orphans.length > 0 → notify user
```

### Variable Resolution Order
```
1. Pre-request script sets (snag.variables.set)
2. Collection variables
3. Active environment variables

Later source wins (environment overrides collection).
```

### Dirty State
```
Tab opens → snapshot saved (reference)
User edits → new immutable object created
Dirty = current !== snapshot (reference inequality)
Save → snapshot = current
Close dirty tab → confirm dialog
```
