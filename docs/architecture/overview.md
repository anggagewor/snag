# Snag Architecture Overview

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                          UI Layer                                │
│  Vue components (features/, components/base/, layouts/)          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ reactive bindings
┌──────────────────────────────▼──────────────────────────────────┐
│                        State Layer                               │
│  Pinia stores (workspace, tabs, history, settings)               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ calls service methods
┌──────────────────────────────▼──────────────────────────────────┐
│                       Service Layer                              │
│  WorkspaceService, RegistryService, HistoryService, Settings     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ delegates to adapter
┌──────────────────────────────▼──────────────────────────────────┐
│                      Storage Layer                               │
│  StorageAdapter (JSON FS today, SQLite/Git future)               │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Tauri plugin calls
┌──────────────────────────────▼──────────────────────────────────┐
│                    Platform Layer                                 │
│  Tauri FS, HTTP, Dialog plugins (Rust native I/O)                │
└─────────────────────────────────────────────────────────────────┘
```

**Rules:**
1. UI → Store only (never call services directly)
2. Store → Service only (never call storage directly)
3. Service → StorageAdapter only (never call Tauri directly)
4. Domain is imported by all layers but imports nothing

## Data Ownership

```
~/.snag/ (Global)
├── workspaces.json ─── RegistryService
├── settings.json   ─── SettingsService (global layer)
├── history/        ─── HistoryService
└── scratch/        ─── WorkspaceService (always available)

<user-path>/ (Workspace)
├── workspace.json  ─── WorkspaceService
├── collections/    ─── WorkspaceService
├── requests/       ─── WorkspaceService
├── environments/   ─── WorkspaceService
└── settings.json   ─── SettingsService (workspace layer)
```

## Startup Flow

```
App Launch
    │
    ▼
Initialize Services (provider.ts)
    │
    ▼
Detect & Run Migration (v0 → v1 if needed)
    │
    ▼
Ensure Scratch Pad exists
    │
    ▼
Determine workspace to open:
  migration result → last opened → scratch pad
    │
    ▼
Open Workspace:
  1. Read workspace.json (manifest)
  2. Load collection trees
  3. Load environments
  4. Hydrate Pinia stores
  5. Check health (async, non-blocking)
    │
    ▼
Ready — UI renders
```

## Request Lifecycle

```
User clicks Send (or Cmd+Enter)
    │
    ▼
1. Pre-request script (useScriptRunner)
   └── snag.variables.set() can inject vars
    │
    ▼
2. Variable resolution
   └── Collection vars → Environment vars → {{key}} replaced
    │
    ▼
3. HTTP execution (useHttp → Tauri HTTP plugin)
   └── Bypasses CORS, supports all methods + custom headers
    │
    ▼
4. Post-response test scripts (useScriptRunner)
   └── snag.test(), snag.expect() assertions
    │
    ▼
5. Record to history (HistoryService, global)
    │
    ▼
6. Display response in viewer
```

## Workspace Switch Flow

```
User selects different workspace
    │
    ▼
Close current workspace (clear stores)
    │
    ▼
Clear all tabs
    │
    ▼
Open new workspace (same as startup open flow)
    │
    ▼
Reload workspace settings
```
