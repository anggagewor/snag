# Implementation Status

## Completed — Workspace Architecture v1

### Documentation
- [x] ADR-001: Workspace Storage Format v1
- [x] ADR-002: Workspace API Architecture
- [x] Architecture Overview (diagrams, flows)
- [x] Domain Model (ubiquitous language, aggregates, decision matrix)

### Domain Layer (`src/domain/`)
- [x] Branded ID types (WorkspaceId, CollectionId, RequestId, etc.)
- [x] HTTP primitives (HttpMethod, ProtocolType, KeyValuePair)
- [x] ULID generator (monotonic, zero external deps)
- [x] Workspace, Collection, Request, Environment, History, Settings models
- [x] All fields immutable (readonly)
- [x] Zero dependencies

### Storage Layer (`src/storage/`)
- [x] Persistence models (file format with `type` + `version` header)
- [x] StorageAdapter interface (swappable backend)
- [x] TauriStorageAdapter (Tauri FS + browser localStorage fallback)
- [x] Mappers (domain ↔ file conversion, bidirectional)

### Service Layer (`src/services/`)
- [x] WorkspaceService interface + implementation
- [x] RegistryService interface + implementation
- [x] HistoryService interface + implementation
- [x] SettingsService interface + implementation
- [x] Service provider (singleton factory)
- [x] Migration (v0 → v1, inline at startup)
- [x] Scratch Pad initialization
- [x] Startup orchestrator

### Store Layer (`src/stores/`)
- [x] workspaceStore (new, workspace-aware)
- [x] Backward compat with existing v0 stores

### Wiring
- [x] main.ts — services init before mount
- [x] App.vue — workspace auto-open (migrated → last used → scratch)
- [x] Build passes (vue-tsc + vite build)

## Next — UI Refactor (Gradual)

### Phase 1: Sidebar
- [ ] SidebarPanel reads from workspaceStore.collections
- [ ] CollectionTree renders workspace tree (folder + request refs)
- [ ] CollectionTreeItem loads request name from workspaceStore.getRequest()
- [ ] Workspace selector (switch, create, open)
- [ ] Remove dependency on old collectionsStore

### Phase 2: Tabs & Request
- [ ] Tab open → workspaceStore.getRequest(id) instead of embedded data
- [ ] Tab save → workspaceStore.saveRequest()
- [ ] Remove request data from Tab interface (lazy load only)
- [ ] Dirty state via reference equality (immutable snapshots)

### Phase 3: Environments
- [ ] EnvironmentPanel → workspaceStore.environments
- [ ] EnvironmentSelector → workspaceStore.setActiveEnvironment()
- [ ] Variable resolution → workspaceStore.resolveVariablesInString()
- [ ] Remove old environmentsStore

### Phase 4: History
- [ ] HistoryPanel reads from HistoryService (global, cross-workspace)
- [ ] Show workspace badge per entry
- [ ] Remove old historyStore

### Phase 5: Settings
- [ ] SettingsPanel → SettingsService (layered: global + workspace)
- [ ] Show scope indicator (global / workspace)
- [ ] Remove old settingsStore

### Phase 6: Cleanup
- [ ] Remove src/types/ (replaced by src/domain/)
- [ ] Remove old useStorage composable (replaced by StorageAdapter)
- [ ] Remove old stores once all UI migrated
- [ ] Update import paths across codebase

## Architecture Invariants

These must remain true at all times:

1. `src/domain/` has zero imports from any other layer
2. `src/storage/` only imports from `src/domain/`
3. `src/services/` only imports from `src/domain/` and `src/storage/`
4. `src/stores/` only imports from `src/domain/` and `src/services/`
5. UI components only import from `src/stores/` (never services or storage directly)
6. Domain objects are never mutated in place
7. Every persisted file has `type` + `version` header
8. All entity IDs are ULIDs
