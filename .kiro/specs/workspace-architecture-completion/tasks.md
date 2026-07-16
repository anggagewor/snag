# Implementation Plan: Workspace Architecture Completion

## Overview

This plan migrates Snag from its legacy v0 architecture to the workspace-based v1 architecture across five incremental phases. Each phase produces a build-passing state (`vue-tsc --noEmit` + `vite build`). The migration refactors tabs to use lazy-loaded request references, introduces new history and settings stores backed by services, builds a workspace switcher UI, and removes legacy `useStorage` and `src/types/` imports.

## Tasks

- [x] 1. Set up test infrastructure and draft conversion layer
  - [x] 1.1 Install test framework (vitest + fast-check) and configure test scripts
    - Add `vitest` and `fast-check` as devDependencies
    - Add `"test": "vitest --run"` script to package.json
    - Create `vitest.config.ts` with path aliases matching `tsconfig.json`
    - _Requirements: 14.1, 14.2_

  - [x] 1.2 Create RequestDraft types and conversion functions
    - Create `src/domain/RequestDraft.ts` with `RequestDraft`, `KeyValuePairEditable`, `RequestBodyDraft`, `RequestAuthDraft` interfaces
    - Implement `requestToDraft(request: Request): RequestDraft` function (assigns ephemeral IDs via `crypto.randomUUID()`)
    - Implement `draftToRequest(draft: RequestDraft, originalId: RequestId, meta: RequestMeta): Request` function (strips ephemeral IDs, filters empty rows)
    - Implement `isDirty(draft: RequestDraft, snapshot: RequestDraft): boolean` with `stripEmptyRows` helper
    - Export all from `src/domain/index.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.4, 11.1, 11.2, 11.3_

  - [ ]* 1.3 Write property test for round-trip conversion integrity
    - **Property 1: Round-Trip Conversion Integrity**
    - For any valid domain Request, converting to RequestDraft then back to Request preserves all meaningful data (modulo updatedAt and empty rows)
    - **Validates: Requirements 2.4, 2.1, 2.2, 2.3, 11.1, 11.2, 11.3**

  - [ ]* 1.4 Write property test for dirty state detection correctness
    - **Property 2: Dirty State Detection Correctness**
    - For any RequestDraft and Snapshot pair, isDirty returns true iff drafts differ after stripping empty KV rows
    - **Validates: Requirements 3.2, 3.4**

- [x] 2. Refactor TabsStore to use lazy request references
  - [x] 2.1 Refactor Tab interface and tabsStore to reference-based model
    - Replace embedded `request?: RequestConfig` with `requestId?: RequestId` and `requestDraft?: RequestDraft`
    - Add `snapshot` field (private) for dirty state comparison
    - Refactor `openRequestTab` to accept `requestId` + `sourceId`, create tab with undefined `requestDraft`
    - Implement `loadTabDraft(tabId)` that loads request from workspaceStore, converts to draft, stores snapshot
    - Refactor `saveTab(tabId)` to convert draft back to domain Request via `draftToRequest()` and persist via `workspaceStore.saveRequest()`
    - Replace `updateTabRequest` with draft mutation pattern
    - Remove direct `RequestConfig` imports from tabs store
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 2.2 Write property test for tab deduplication by sourceId
    - **Property 3: Tab Deduplication by SourceId**
    - For any sequence of openRequestTab calls with the same sourceId, tabs list contains exactly one Tab with that sourceId
    - **Validates: Requirements 1.2**

  - [x] 2.3 Update UI components that consume tabsStore
    - Update `TabBar.vue` to work with new Tab interface (requestDraft instead of request)
    - Update `TabContent.vue` to trigger `loadTabDraft` when tab activates with undefined requestDraft
    - Update `RequestPanel.vue` to bind to `tab.requestDraft` fields
    - Update `RequestUrlBar.vue`, `RequestHeaders.vue`, `RequestParams.vue`, `RequestBody.vue`, `RequestAuth.vue`, `RequestScripts.vue` to use `KeyValuePairEditable` from draft
    - Update `CollectionTree.vue` / `CollectionTreeItem.vue` to pass `requestId` to `openRequestTab`
    - Handle error state (request not found) in tab panel
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2_

- [x] 3. Checkpoint - Verify tabs refactor builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Migrate history store to HistoryService
  - [x] 4.1 Create new historyStore backed by HistoryService
    - Create new `src/stores/history.ts` (replace legacy) using `useHistoryService()` from provider
    - Implement `load()` → `historyService.query({ limit: 50 })`
    - Implement `recordEntry(params)` → create domain HistoryEntry with ULID, delegate to `historyService.record()`
    - Implement `query(filter?)` → `historyService.query(filter)`
    - Implement `removeEntry(id)` / `clearHistory()` via service
    - Prepend new entries to reactive `entries[]` for immediate UI update
    - Handle write failures gracefully (log, don't block)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 4.2 Write property test for history entry completeness
    - **Property 4: History Entry Completeness**
    - For any completed request execution, the resulting HistoryEntry contains valid method, non-empty URL, integer status, non-negative duration, non-negative responseSize, workspaceId, and valid ISO timestamp
    - **Validates: Requirements 5.1**

  - [ ]* 4.3 Write property test for history ordering
    - **Property 5: History Ordering**
    - For any sequence of recorded history entries, entries list is ordered most recent first
    - **Validates: Requirements 5.3**

  - [ ]* 4.4 Write property test for history filter correctness
    - **Property 6: History Filter Correctness**
    - For any set of history entries and a filter, filtered result contains exactly the entries matching all criteria
    - **Validates: Requirements 5.4**

  - [x] 4.5 Implement legacy history migration
    - Create `src/services/historyMigration.ts` with `migrateLegacyHistory()` function
    - Convert legacy `HistoryEntry` (full request/response) to domain `HistoryEntry` (summary only)
    - Run migration at startup if legacy `history.json` exists in AppData
    - Mark legacy data as migrated (rename file to `history.json.migrated`) after successful migration
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 4.6 Write property test for legacy history migration
    - **Property 7: Legacy History Migration**
    - For any legacy history entry with full request/response data, migration produces domain HistoryEntry with only summary fields
    - **Validates: Requirements 6.1, 6.2**

  - [x] 4.7 Update HistoryPanel UI to use new historyStore
    - Update `src/features/history/HistoryPanel.vue` to import from new historyStore
    - Use domain `HistoryEntry` fields (method, url, status, duration, responseSize) instead of legacy format
    - Add filter UI for method, URL pattern, date range
    - Remove imports from `src/types/request`
    - _Requirements: 5.1, 5.3, 5.4_

- [x] 5. Checkpoint - Verify history migration builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Migrate settings store to layered SettingsService
  - [x] 6.1 Create new settingsStore backed by SettingsService
    - Create new `src/stores/settings.ts` (replace legacy) using `useSettingsService()` from provider
    - Implement `load()` → load global + workspace settings, merge into `resolved`
    - Implement `updateGlobal(partial)` → delegate to service, recompute resolved
    - Implement `updateWorkspace(partial)` → delegate to service, recompute resolved
    - Implement `resetGlobal()` → restore defaults via service
    - Implement `reloadWorkspaceSettings()` → reload workspace layer on workspace switch
    - Handle corrupted settings files (fall back to defaults, log warning)
    - Create `ResolvedSettings` type combining global + workspace fields
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 6.2 Write property test for settings merge correctness
    - **Property 8: Settings Merge Correctness**
    - For any combination of GlobalSettings and WorkspaceSettings, merge assigns global-only fields from GlobalSettings, workspace-overridable fields from WorkspaceSettings when present, uses defaults when absent, and is idempotent
    - **Validates: Requirements 7.2, 8.1, 8.2, 8.3, 8.4**

  - [x] 6.3 Update SettingsPanel UI to use new settingsStore
    - Update `src/features/settings/SettingsPanel.vue` to import from new settingsStore
    - Show scope indicators (global vs workspace) for each setting
    - Separate global settings (theme, font) from workspace settings (proxy, timeout, ssl)
    - Remove imports from `src/types/common` for `ThemeMode`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2_

- [x] 7. Checkpoint - Verify settings migration builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build workspace switcher UI and wire workspace switch flow
  - [x] 8.1 Create WorkspaceSwitcher component
    - Create `src/features/sidebar/WorkspaceSwitcher.vue`
    - Display current workspace name in sidebar header
    - Implement dropdown with recent workspaces from `workspaceStore.recentWorkspaces`
    - Add "Create New Workspace" action (name input + folder picker via Tauri dialog)
    - Add "Open Folder" action (folder picker via Tauri dialog)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 8.2 Implement workspace switch flow in workspaceStore
    - Add `switchWorkspace(path)` action that: closes current workspace, clears tabs, opens new workspace
    - Call `settingsStore.reloadWorkspaceSettings()` after switch
    - Call `registryService.updateLastOpened()` on successful switch
    - Handle switch failures (keep current workspace open, show error)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 8.3 Write property test for workspace isolation on switch
    - **Property 9: Workspace Isolation on Switch**
    - For any workspace close operation, tabs list is empty and request cache is cleared
    - **Validates: Requirements 9.2**

  - [x] 8.4 Integrate WorkspaceSwitcher into SidebarPanel
    - Add WorkspaceSwitcher to `src/features/sidebar/SidebarPanel.vue` header area
    - Wire switch/create/open events to workspaceStore actions
    - Load recent workspaces on app startup
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 9. Checkpoint - Verify workspace switcher builds cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Replace legacy type imports with domain equivalents
  - [x] 10.1 Replace all `src/types/common` imports with domain equivalents
    - Replace `HttpMethod` enum imports with `HttpMethod` string union from `@/domain`
    - Replace `ProtocolType` enum imports with `ProtocolType` string union from `@/domain`
    - Replace `KeyValuePair` (with id) imports with domain `KeyValuePair` (no id) or `KeyValuePairEditable` where UI needs it
    - Replace `UUID` type with branded ID types (`RequestId`, `CollectionId`, etc.) or plain `string`
    - Replace `ThemeMode` type with inline `'light' | 'dark' | 'system'` from domain GlobalSettings
    - Update all enum member accesses (`HttpMethod.GET` → `'GET'`, `ProtocolType.REST` → `'rest'`)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.2 Replace all `src/types/request` imports with domain equivalents
    - Replace `RequestConfig` usages with domain `Request` or `RequestDraft` as appropriate
    - Replace `BodyType` enum values with domain `BodyType` string union (mapping: `'form-data'` → `'formdata'`, `'x-www-form-urlencoded'` → `'urlencoded'`, `'raw'` → `'text'`)
    - Replace `AuthConfig` with domain `RequestAuth` (field `addTo` → `in`)
    - Keep `ResponseData` as runtime type, move definition to `src/domain/http.ts`
    - Remove `createEmptyRequest` (replace with request creation through workspaceStore)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.3 Replace remaining `src/types/` imports (websocket, graphql, grpc, collection, environment)
    - Audit all files importing from `src/types/websocket`, `src/types/graphql`, `src/types/grpc`, `src/types/collection`, `src/types/environment`
    - Create domain equivalents or move types where needed
    - Update all import paths
    - _Requirements: 12.1_

- [x] 11. Remove legacy composable and type files
  - [x] 11.1 Remove `useStorage` composable
    - Delete `src/composables/useStorage.ts`
    - Verify zero remaining imports of `useStorage` across the codebase
    - All persistence now flows through StorageAdapter → Services
    - _Requirements: 13.1, 13.2_

  - [x] 11.2 Remove legacy `src/types/` directory
    - Delete `src/types/common.ts`, `src/types/request.ts`, and other legacy type files once all imports are migrated
    - Verify zero remaining imports from `src/types/` directory
    - _Requirements: 12.1, 13.2_

  - [x] 11.3 Remove legacy store files (collections.ts, environments.ts from stores)
    - Delete legacy store files that have been fully replaced by workspaceStore
    - Verify all UI components use workspaceStore for collections and environments
    - _Requirements: 13.1, 13.2_

- [x] 12. Final checkpoint - Ensure full build passes
  - Run `vue-tsc --noEmit` and `vite build` to confirm no type errors or build errors
  - Run `vitest --run` to confirm all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 14.1, 14.2, 14.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The migration is designed to be incremental — each phase produces a build-passing state
- No new external dependencies beyond `vitest` and `fast-check` for testing
- All services (WorkspaceService, HistoryService, SettingsService, RegistryService) are already implemented — this plan wires the stores and UI to use them

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["4.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5", "6.2"] },
    { "id": 6, "tasks": ["4.6", "4.7", "6.3"] },
    { "id": 7, "tasks": ["8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3", "8.4"] },
    { "id": 9, "tasks": ["10.1", "10.2"] },
    { "id": 10, "tasks": ["10.3"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
