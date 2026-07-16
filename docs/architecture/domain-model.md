# Snag Domain Model

## Ubiquitous Language

| Term | Definition |
|------|-----------|
| **Workspace** | Unit organisasi tertinggi. Folder di filesystem, self-contained dan portable. |
| **Scratch Pad** | Workspace bawaan yang selalu ada. Persistent, tidak bisa Git/share. |
| **Collection** | Grouping logical untuk request. Berisi tree (folder + request refs). |
| **Tree** | Hierarki di dalam collection. Folders + Request references. |
| **Folder** | Node organisasi di tree. Hanya punya nama dan children. |
| **Request** | Unit kerja utama. Self-contained file, tidak tahu posisinya di tree. |
| **Environment** | Sekumpulan variabel yang bisa di-switch. Scoped per workspace. |
| **Variable** | Key-value pair, disubstitusi via `{{key}}` syntax saat runtime. |
| **History Entry** | Record eksekusi request. Global, cross-workspace, immutable. |
| **Registry** | Cache global yang melacak workspace paths. Bisa stale. |

## Entity Relationships

```
Workspace
├── owns ── Collection (1..*)
│              └── owns ── Tree
│                            ├── Folder (0..*, recursive)
│                            └── RequestRef (0..*, points to Request)
├── owns ── Request (0..*, lazy-loaded)
│              ├── Body, Auth, Headers, Params
│              └── PreRequest script, Test script
├── owns ── Environment (0..*)
│              └── Variable (0..*)
└── owns ── Settings (workspace-level)

Registry (global) ── tracks WorkspaceEntry[] (id, name, path)
History (global)  ── contains HistoryEntry[] (snapshots of executions)
```

## Aggregate Boundaries

| Aggregate | Root | Key Invariants |
|-----------|------|---------------|
| Workspace | Workspace | ID unique (ULID), name non-empty, collections[] valid |
| Collection | Collection | Tree acyclic, no duplicate requestId, folder names unique in parent |
| Request | Request | ID unique (ULID), valid protocol + method |
| Environment | Environment | ID unique (ULID), name non-empty, variable keys non-empty |

## Immutability Rule

Domain objects are immutable values. Never mutate in place.

```typescript
// ❌ BAD
request.url = 'https://...'

// ✅ GOOD
const updated = { ...request, url: 'https://...' }
```

Benefits: undo/redo, dirty checking via reference equality, clean history.

## Variable Resolution Order

```
1. Pre-request script (snag.variables.set)
2. Collection variables
3. Active environment variables

Later source wins.
```

## Data Location Rules

| If... | Store in... |
|-------|-------------|
| Important when workspace moves to another machine | Workspace |
| Belongs to user, not project | Global (~/.snag/) |
| Acceptable to lose on restart | Runtime (memory only) |

## Operation Semantics

### Workspace
- `openWorkspace` — load manifest, hydrate stores, check health
- `closeWorkspace` — clear stores, release resources
- `createWorkspace` — create folder structure + manifest + register
- `switchWorkspace` — close current → open target

### Collection
- `createCollection` — new tree file + register in manifest
- `deleteCollection` — remove file + unregister (requests become orphans)
- `moveItem` — reorder/reparent within tree

### Request
- `createRequest` — new file + add ref to collection tree
- `saveRequest` — write to disk (immutable snapshot)
- `deleteRequest` — remove file + remove ref from all trees
- `duplicateRequest` — new file + new ID, copied content

### Environment
- `createEnvironment` / `deleteEnvironment` — file management
- `resolveVariables` — collection → environment → substituted string
