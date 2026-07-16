# ADR-002: Workspace API Architecture

**Status:** Accepted
**Date:** 2026-07-16
**Decision Makers:** Angga

## Context

ADR-001 mendefinisikan **apa** yang disimpan dan **dimana**. ADR-002 mendefinisikan **siapa ngomong ke siapa** — layer architecture dan interface boundaries.

Tanpa boundary yang jelas, Pinia stores akan langsung memanggil `fs.readFile()`, dan dalam 3 bulan refactoring jadi nightmare karena filesystem calls tersebar di 20+ file.

## Decision

### Layer Architecture

```
┌─────────────────────────────────────────────┐
│                 UI Components                │
│         (Vue components, no logic)           │
└──────────────────────┬──────────────────────┘
                       │ reactive bindings
┌──────────────────────▼──────────────────────┐
│               Pinia Stores                   │
│    (state, getters, actions — UI-facing)     │
└──────────────────────┬──────────────────────┘
                       │ calls service methods
┌──────────────────────▼──────────────────────┐
│            WorkspaceService                   │
│   (orchestration, business logic, caching)   │
└──────────────────────┬──────────────────────┘
                       │ delegates to adapter
┌──────────────────────▼──────────────────────┐
│             StorageAdapter                    │
│    (filesystem I/O, read/write/delete)       │
└──────────────────────┬──────────────────────┘
                       │ Tauri plugin calls
┌──────────────────────▼──────────────────────┐
│          Tauri Filesystem Plugin             │
│         (Rust side, native I/O)              │
└─────────────────────────────────────────────┘
```

### Rules

1. **UI → Store only.** Components never call WorkspaceService directly.
2. **Store → WorkspaceService only.** Stores never call StorageAdapter or Tauri plugins.
3. **WorkspaceService → StorageAdapter only.** Business logic never touches raw I/O.
4. **StorageAdapter is swappable.** Today: JSON files via Tauri FS. Tomorrow: SQLite, Git, cloud.

### WorkspaceService Interface

```typescript
interface WorkspaceService {
  // Workspace lifecycle
  openWorkspace(path: string): Promise<Workspace>
  closeWorkspace(): Promise<void>
  createWorkspace(name: string, path: string): Promise<Workspace>
  getActiveWorkspace(): Workspace | null

  // Collections
  listCollections(): Promise<CollectionMeta[]>
  getCollection(id: string): Promise<Collection>
  createCollection(name: string): Promise<Collection>
  saveCollection(collection: Collection): Promise<void>
  deleteCollection(id: string): Promise<void>

  // Requests
  getRequest(id: string): Promise<Request>
  saveRequest(request: Request): Promise<void>
  createRequest(collectionId: string, folderId?: string): Promise<Request>
  deleteRequest(id: string): Promise<void>
  moveRequest(requestId: string, targetCollectionId: string, targetFolderId?: string, index?: number): Promise<void>

  // Environments
  listEnvironments(): Promise<EnvironmentMeta[]>
  getEnvironment(id: string): Promise<Environment>
  saveEnvironment(env: Environment): Promise<void>
  createEnvironment(name: string): Promise<Environment>
  deleteEnvironment(id: string): Promise<void>

  // Workspace health
  detectOrphans(): Promise<OrphanedRequest[]>
  recoverOrphans(requestIds: string[], targetCollectionId: string): Promise<void>

  // Import/Export
  importCollection(source: ImportSource): Promise<ImportPreview>
  confirmImport(preview: ImportPreview, targetCollectionId?: string): Promise<void>
  exportCollection(collectionId: string, format: ExportFormat): Promise<Blob | string>
}
```

### StorageAdapter Interface

```typescript
interface StorageAdapter {
  // Low-level I/O
  readFile<T>(path: string): Promise<T>
  writeFile(path: string, data: unknown): Promise<void>
  deleteFile(path: string): Promise<void>
  exists(path: string): Promise<boolean>

  // Directory operations
  listFiles(directory: string, pattern?: string): Promise<string[]>
  ensureDirectory(path: string): Promise<void>

  // Workspace-aware paths
  resolveWorkspacePath(...segments: string[]): string
  resolveGlobalPath(...segments: string[]): string

  // Watch (future — file watcher for Git sync)
  watch?(path: string, callback: (event: FileEvent) => void): Unsubscribe

  // Migration
  detectVersion(path: string): Promise<number>
  migrate(path: string, fromVersion: number, toVersion: number): Promise<void>
}
```

### Registry Service (Global)

```typescript
interface RegistryService {
  listWorkspaces(): Promise<WorkspaceEntry[]>
  registerWorkspace(id: string, name: string, path: string): Promise<void>
  unregisterWorkspace(id: string): Promise<void>
  updateLastOpened(id: string): Promise<void>
  validatePaths(): Promise<WorkspaceValidation[]>
}
```

### History Service (Global)

```typescript
interface HistoryService {
  record(entry: HistoryEntry): Promise<void>
  query(filter: HistoryFilter): Promise<HistoryEntry[]>
  clear(before?: Date): Promise<void>
}
```

### Settings Service (Layered)

```typescript
interface SettingsService {
  // Resolved settings (global + workspace merged)
  get<K extends keyof Settings>(key: K): Settings[K]
  set<K extends keyof Settings>(key: K, value: Settings[K], scope: 'global' | 'workspace'): Promise<void>

  // Layer access
  getGlobal(): GlobalSettings
  getWorkspace(): WorkspaceSettings | null
}
```

## Component Interaction Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        App Startup                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   RegistryService     │
                    │   loadWorkspaces()    │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Show Recent / Open  │
                    └───────────┬───────────┘
                                │ user selects workspace
                    ┌───────────▼───────────┐
                    │  WorkspaceService     │
                    │  openWorkspace(path)  │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
    ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
    │ Load Manifest│   │Load Collections│  │Load Envs     │
    └──────┬──────┘   └──────┬───────┘   └──────┬───────┘
           │                  │                   │
           ▼                  ▼                   ▼
    ┌─────────────────────────────────────────────────┐
    │              Pinia Stores Hydrated               │
    └──────────────────────┬──────────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────────┐
    │              Render UI (Tree, Tabs)              │
    └─────────────────────────────────────────────────┘
```

## Request Lifecycle (Updated)

```
User clicks request in tree
         │
         ▼
┌─────────────────────┐
│  tabsStore.openTab  │
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────┐
│  workspaceService.getRequest │ ← lazy load from disk
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Request loaded into store   │
│  UI renders request builder  │
└────────┬────────────────────┘
         │ user edits & sends
         ▼
┌─────────────────────────────┐
│  useScriptRunner (pre-req)   │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Variable resolution         │
│  (collection → environment)  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  useHttp (Tauri HTTP plugin) │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  useScriptRunner (tests)     │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  historyService.record()     │ ← global history
└──────────────────────────────┘
```

## Workspace Data Model

```
Workspace
├── id: ULID
├── name: string
├── collections: CollectionRef[]
│
├── Collection
│   ├── id: ULID
│   ├── name: string
│   ├── variables: KeyValuePair[]
│   └── items: TreeNode[]
│       ├── Folder { id, name, children: TreeNode[] }
│       └── RequestRef { requestId: ULID }
│
├── Request (lazy-loaded)
│   ├── id: ULID
│   ├── name: string
│   ├── protocol: ProtocolType
│   ├── method, url, headers, params, body, auth
│   ├── preRequest, tests
│   └── meta: { createdAt, updatedAt }
│
├── Environment
│   ├── id: ULID
│   ├── name: string
│   └── variables: { key, value, enabled }[]
│
└── Settings (workspace-level)
    ├── defaultEnvironment: ULID
    ├── proxy, certificates, defaultHeaders
    └── ...
```

## Implementation Order

```
Phase 1: Foundation
  1. StorageAdapter (JSON + Tauri FS)
  2. WorkspaceService
  3. RegistryService
  4. HistoryService
  5. SettingsService

Phase 2: Store Refactor
  6. workspaceStore (new)
  7. collectionsStore (refactor — delegate to WorkspaceService)
  8. environmentsStore (refactor)
  9. tabsStore (minor updates — workspace-aware)
  10. historyStore (refactor — delegate to HistoryService)
  11. settingsStore (refactor — layered)

Phase 3: UI Updates
  12. Sidebar — workspace selector, collection tree
  13. Import flow — workspace-aware
  14. Settings panel — show scope (global/workspace)
  15. Scratch Pad integration

Phase 4: Polish
  16. Orphan detection on startup
  17. Migration (v0 → v1)
  18. Workspace health indicator
```

## Consequences

### Positive
- Clear separation of concerns — setiap layer punya satu job
- Testable — WorkspaceService bisa di-test tanpa filesystem
- Swappable storage — adapter pattern enables future backends
- Predictable data flow — bugs easier to trace

### Negative
- More indirection (UI → Store → Service → Adapter → FS)
- Initial setup lebih banyak boilerplate
- Debugging perlu trace through layers

### Acceptable Trade-offs
- Indirection worth it untuk long-term maintainability
- Boilerplate berkurang setelah foundation selesai
- Layer boundaries make debugging *systematic*, not harder

## Compliance

Setiap PR yang menambah/mengubah data access harus menjawab:

> "Apakah data diakses melalui WorkspaceService, bukan langsung ke filesystem?"

Jika tidak → refactor atau justify with new ADR.
