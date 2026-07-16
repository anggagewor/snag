# ADR-001: Workspace Storage Format v1

**Status:** Accepted
**Date:** 2026-07-16
**Decision Makers:** Angga

## Context

Snag v0 menyimpan semua data dalam satu file per domain (`collections.json`, `environments.json`, dll) di Tauri `appDataDir`. Model ini sederhana untuk development awal, tapi menimbulkan masalah:

- Git conflict parah saat kolaborasi (satu file besar = merge hell)
- Tidak portable (data terkunci di app directory)
- Tidak scalable (ribuan request dalam satu JSON = slow parse)
- Tidak lazy-loadable (harus baca semua data saat startup)

## Decision

### Core Principle

**Storage is an implementation detail.** Seluruh aplikasi berinteraksi hanya melalui Workspace API. UI, store, dan composable tidak boleh tahu tentang filesystem layout, file format, atau persistence mechanism.

### Workspace sebagai Unit Utama

Workspace adalah root storage. Semua project asset (collection, request, environment, script, certificate) berada di dalam workspace. Workspace bersifat **self-contained dan portable** — zip dan kirim ke orang lain, buka, selesai.

**Portability Rule:** Kalau file itu penting saat workspace dipindahkan ke komputer lain, file itu harus berada di dalam workspace.

### Filesystem Layout

```
~/.snag/                              ← Global (app-level, milik USER)
├── settings.json                     ← Global settings (theme, font, keybindings)
├── workspaces.json                   ← Registry/cache (UUID + path pairs)
├── history/                          ← Global history (cross-workspace)
│   └── 2026-07-16.json
└── scratch/                          ← Scratch Pad workspace (real workspace, persistent)
    ├── workspace.json
    ├── collections/
    ├── requests/
    └── environments/

<user-chosen-path>/                   ← Workspace (lokasi dipilih user)
├── workspace.json                    ← Manifest
├── collections/
│   └── <ULID>.collection.json        ← Tree structure (folder + request ID refs)
├── requests/
│   └── <ULID>.request.json           ← Full request data (self-contained)
├── environments/
│   └── <ULID>.environment.json       ← Variables per environment
├── scripts/                          ← Shared scripts (future)
├── certificates/                     ← mTLS certs (future)
└── settings.json                     ← Workspace-level settings
```

### Workspace Location — User's Choice

Workspace bisa ditempatkan dimana saja:

**Opsi 1 — Di dalam project (mirip .vscode):**
```
TradingAPI/
├── .git
├── .snag/          ← workspace lives here
│   ├── workspace.json
│   ├── requests/
│   └── ...
└── README.md
```

**Opsi 2 — Standalone folder:**
```
~/Snag Workspaces/
└── Trading API/
    ├── workspace.json
    ├── requests/
    └── ...
```

Core app tidak peduli dimana workspace berada. Yang dibutuhkan hanya root path.

### ID Format: ULID

Semua entity menggunakan ULID sebagai identifier:
- Sortable by creation time
- Shorter than UUID
- Filename-friendly (no special chars)
- Konsisten di seluruh ecosystem (workspace, collection, request, environment, history)

### File Naming: ID-Based

```
collections/01K0Y4AQTR.collection.json
requests/01K0Y4BXYZ.request.json
environments/01K0Y4CDEF.environment.json
```

Nama human-readable disimpan di dalam file, bukan di filename. Rename entity = ubah isi JSON, bukan rename file. Git happy.

### File Format Contract

Setiap file JSON **wajib** punya header:

```json
{
  "type": "<entity-type>",
  "version": 1,
  "id": "<ULID>",
  ...
}
```

Valid `type` values: `workspace`, `collection`, `request`, `environment`

`version` adalah **storage format version**, bukan app version. Decoupled. App 1.0 dan app 3.2 bisa sama-sama pakai format version 1.

### File Schemas

**workspace.json:**
```json
{
  "type": "workspace",
  "version": 1,
  "id": "01K0Y4AQTR",
  "name": "Trading API",
  "createdAt": "2026-07-16T10:00:00Z",
  "lastOpenedAt": "2026-07-16T15:30:00Z",
  "defaultEnvironment": "01K0Y4CDEF",
  "collections": ["01K0Y4AQTR"]
}
```

**Collection (tree only, no request data):**
```json
{
  "type": "collection",
  "version": 1,
  "id": "01K0Y4AQTR",
  "name": "Trading",
  "items": [
    {
      "type": "folder",
      "id": "01K0Y4FOLD",
      "name": "Auth",
      "children": [
        {
          "type": "request",
          "requestId": "01K0Y4BXYZ"
        }
      ]
    }
  ]
}
```

**Request (self-contained):**
```json
{
  "type": "request",
  "version": 1,
  "id": "01K0Y4BXYZ",
  "name": "Login",
  "protocol": "rest",
  "method": "POST",
  "url": "{{baseUrl}}/login",
  "headers": [],
  "params": [],
  "body": { "type": "json", "content": "" },
  "auth": { "type": "none" },
  "preRequest": "",
  "tests": "",
  "meta": {
    "createdAt": "2026-07-16T10:00:00Z",
    "updatedAt": "2026-07-16T15:30:00Z"
  }
}
```

**Environment:**
```json
{
  "type": "environment",
  "version": 1,
  "id": "01K0Y4CDEF",
  "name": "Development",
  "variables": [
    {
      "key": "baseUrl",
      "value": "https://api.dev.example.com",
      "enabled": true
    }
  ]
}
```

### Workspace Registry (`~/.snag/workspaces.json`)

```json
{
  "version": 1,
  "workspaces": [
    {
      "id": "01K0Y4AQTR",
      "name": "Trading API",
      "path": "/Users/angga/Projects/trading-api/.snag",
      "lastOpenedAt": "2026-07-16T15:30:00Z"
    }
  ]
}
```

Registry adalah **cache**, bukan database. Path bisa stale (folder dipindah). Handling:
- Startup: validate paths, mark missing
- Missing workspace: offer "Locate" or "Remove"
- Open workspace: auto-register/update registry

### Scratch Pad

Scratch Pad adalah **real workspace** di `~/.snag/scratch/`. Properti:
- Persistent (survive restart)
- Tidak bisa Git
- Tidak bisa share
- Tidak muncul di "Open Workspace"
- Selalu ada, selalu accessible

User bisa drag request dari Scratch Pad ke workspace manapun.

### History (Global)

History bukan project asset, tapi user activity. Disimpan global:

```
~/.snag/history/2026-07-16.json
```

```json
{
  "entries": [
    {
      "id": "01K0Y4HIST",
      "workspaceId": "01K0Y4AQTR",
      "requestId": "01K0Y4BXYZ",
      "timestamp": "2026-07-16T15:30:00Z",
      "method": "POST",
      "url": "https://api.example.com/login",
      "status": 200,
      "duration": 234
    }
  ]
}
```

### Settings Layers

| Layer | Location | Contents |
|-------|----------|----------|
| Global | `~/.snag/settings.json` | Theme, font, keybindings, window |
| Workspace | `<workspace>/settings.json` | Default env, proxy, certificates, default headers |
| Runtime | In-memory only | Last opened tab, split width, expanded folders, scroll position |

Merge strategy: Workspace overrides Global for overlapping keys. Runtime never persisted as "settings".

### Environments — Per Workspace Only

**No global environments in v1.**

Setiap workspace memiliki environments sendiri. Sharing dilakukan via:
- Copy file antar workspace
- Import environment from file
- Duplicate from another workspace (future UX)

Rationale: Workspace harus self-contained. Global environments menciptakan hidden dependency yang merusak portability.

### Source of Truth

Collection tree adalah **satu-satunya** source of truth untuk lokasi request dalam hierarchy. Request file tidak tahu dia ada di collection/folder mana.

### Orphan Recovery

Startup scan: bandingkan `requests/*.json` dengan semua `requestId` di collection trees. Request yang tidak direferensikan → "Recovered Requests" bucket. User bisa assign ulang atau delete.

### Migration (v0 → v1)

Inline di startup, bukan utility terpisah:
1. Detect format (ada `workspace.json`? → v1. Ada `collections.json` di appDataDir? → v0)
2. Backup: `collections.json` → `collections.json.bak`
3. Auto-migrate ke format v1
4. User tidak perlu tahu apa-apa

## Consequences

### Positive
- Git-friendly (satu request = satu file, minimal conflict)
- Portable (zip workspace, kirim, buka, done)
- Lazy-loadable (load tree dulu, request on-demand)
- Scalable (ribuan request tanpa single-file bottleneck)
- Future-proof (storage swappable tanpa UI changes)
- Debuggable (setiap file self-describing via type + version)

### Negative
- Lebih banyak file di disk (acceptable)
- Perlu orphan detection logic
- Migration dari v0 harus di-maintain sampai cukup user sudah upgrade

### Neutral
- User yang buka folder workspace manual akan lihat ULID filenames (acceptable — mereka jarang perlu melakukan ini)

## Compliance Check

Setiap PR yang menyentuh storage layer harus menjawab:

> "Apakah ini masih sesuai dengan ADR-001?"

Jika tidak → butuh ADR baru atau amendment.
