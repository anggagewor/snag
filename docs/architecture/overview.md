# Snag Architecture Overview

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                          UI Layer                                │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Sidebar  │  │  TabBar  │  │ Request  │  │   Response   │   │
│  │  Panel   │  │          │  │  Panel   │  │    Panel     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        State Layer                               │
│                                                                  │
│  ┌───────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐   │
│  │ workspace │  │collections│  │  tabs   │  │ environments │   │
│  │   Store   │  │  Store   │  │  Store  │  │    Store     │   │
│  └───────────┘  └──────────┘  └─────────┘  └──────────────┘   │
│                                                                  │
│  ┌───────────┐  ┌──────────┐                                    │
│  │  history  │  │ settings │                                    │
│  │   Store   │  │  Store   │                                    │
│  └───────────┘  └──────────┘                                    │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                       Service Layer                              │
│                                                                  │
│  ┌────────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │ WorkspaceService│  │HistoryService│  │  SettingsService  │   │
│  └───────┬────────┘  └──────┬──────┘  └─────────┬──────────┘   │
│          │                   │                    │               │
│  ┌───────▼────────┐  ┌──────▼──────┐  ┌─────────▼──────────┐   │
│  │RegistryService │  │             │  │                     │   │
│  └────────────────┘  │             │  │                     │   │
│                      │             │  │                     │   │
└──────────────────────┼─────────────┼──┼─────────────────────┘───┘
                       │             │  │
┌──────────────────────▼─────────────▼──▼─────────────────────────┐
│                      Storage Layer                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    StorageAdapter                          │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌─────────────┐  ┌────────────────┐  │   │
│  │  │ JsonFsAdapter│  │ SQLiteAdapter│  │  GitAdapter    │  │   │
│  │  │   (v1)       │  │   (future)  │  │   (future)    │  │   │
│  │  └──────────────┘  └─────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    Platform Layer                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Tauri FS     │  │ Tauri HTTP   │  │ Tauri Window/Shell   │  │
│  │ Plugin       │  │ Plugin       │  │ Plugins              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Ownership

```
┌─────────────────────────────────────────────────────────────┐
│                    Global (~/.snag/)                          │
│                                                              │
│  workspaces.json ──── RegistryService                        │
│  settings.json   ──── SettingsService (global layer)         │
│  history/        ──── HistoryService                         │
│  scratch/        ──── WorkspaceService (always available)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Workspace (<user-path>/)                         │
│                                                              │
│  workspace.json  ──── WorkspaceService                       │
│  collections/    ──── WorkspaceService.collections           │
│  requests/       ──── WorkspaceService.requests              │
│  environments/   ──── WorkspaceService.environments          │
│  settings.json   ──── SettingsService (workspace layer)      │
│  scripts/        ──── WorkspaceService (future)              │
│  certificates/   ──── WorkspaceService (future)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Startup Flow

```
App Launch
    │
    ▼
┌────────────────────────────┐
│  Initialize Global Services │
│  - SettingsService (global) │
│  - RegistryService          │
│  - HistoryService           │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│  Load Workspace Registry    │
│  - Validate paths           │
│  - Mark missing workspaces  │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│  Determine startup action   │
│                             │
│  Has lastOpened workspace?  │
│  ├── Yes → Open it         │
│  └── No  → Show welcome    │
│                             │
│  Always: ensure scratch pad │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│  Open Workspace             │
│  1. Read workspace.json     │
│  2. Validate version        │
│  3. Migrate if needed       │
│  4. Load collection trees   │
│  5. Load environments meta  │
│  6. Hydrate Pinia stores    │
│  7. Restore tabs (runtime)  │
│  8. Detect orphans (async)  │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│  Ready                      │
│  - Tree rendered            │
│  - Tabs restored            │
│  - Requests lazy-loaded     │
└────────────────────────────┘
```

## Request Lifecycle

```
                    ┌─────────────────┐
                    │  User clicks     │
                    │  request in tree │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  tabsStore       │
                    │  .openTab(id)    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────────────┐
                    │  workspaceService       │
                    │  .getRequest(id)        │
                    │                          │
                    │  Already cached?         │
                    │  ├── Yes → return        │
                    │  └── No  → load from    │
                    │           disk (lazy)    │
                    └────────┬────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Store hydrated  │
                    │  UI renders      │
                    │  request builder │
                    └────────┬────────┘
                             │
                             │ user sends request
                             ▼
              ┌──────────────────────────────┐
              │  Execution Pipeline            │
              │                                │
              │  1. Pre-request script         │
              │     └── useScriptRunner        │
              │                                │
              │  2. Variable resolution        │
              │     └── collection vars        │
              │     └── environment vars       │
              │                                │
              │  3. HTTP execution             │
              │     └── useHttp                │
              │     └── Tauri HTTP plugin      │
              │                                │
              │  4. Post-response tests        │
              │     └── useScriptRunner        │
              │                                │
              │  5. Record history             │
              │     └── historyService         │
              │                                │
              └──────────────────────────────┘
```

## Workspace Switch Flow

```
User selects different workspace
         │
         ▼
┌─────────────────────────┐
│  Save current state      │
│  - Dirty requests        │
│  - Tab positions         │
│  - Runtime state         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Close current workspace │
│  - Clear stores          │
│  - Unload requests       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Open new workspace      │
│  (same as startup flow)  │
└─────────────────────────┘
```

## Import Flow (Workspace-Aware)

```
User triggers import
         │
         ▼
┌─────────────────────────┐
│  Select source           │
│  - File (Postman, cURL)  │
│  - OpenAPI spec          │
│  - URL                   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Parse & Preview         │
│  - Show what will be     │
│    imported              │
│  - Count requests        │
│  - Show folder structure │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Choose target           │
│  - Existing workspace    │
│  - New workspace         │
│  - Existing collection   │
│  - New collection        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Write files             │
│  - workspace.json        │
│  - collection tree       │
│  - individual requests   │
│  - environments (if any) │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Open workspace / reload │
└─────────────────────────┘
```
