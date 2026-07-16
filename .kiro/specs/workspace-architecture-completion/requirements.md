# Requirements Document

## Introduction

This document captures the functional requirements for completing Snag's migration from the legacy v0 architecture to the workspace-based v1 architecture. The migration covers five phases: replacing legacy type imports with domain equivalents, migrating the history store to HistoryService, migrating the settings store to the layered SettingsService, building a workspace switcher UI, and removing the legacy `useStorage` composable. Requirements are derived from the approved design document.

## Glossary

- **Tab**: A UI element representing an open request, settings panel, or environment editor. Holds a reference to a request rather than embedding full request data.
- **RequestDraft**: A mutable working copy of a domain Request used for UI two-way binding. Contains ephemeral IDs for Vue list rendering.
- **Domain_Request**: An immutable value object representing a persisted API request with branded ID, headers, params, body, auth, and metadata.
- **KeyValuePairEditable**: A mutable key-value pair with an ephemeral `id` field for Vue `:key` binding. The `id` is never persisted.
- **HistoryStore**: A Pinia store that manages request execution history, delegating persistence to HistoryService.
- **SettingsStore**: A Pinia store that manages layered settings (global + workspace), delegating persistence to SettingsService.
- **WorkspaceSwitcher**: A UI component that allows users to switch between workspaces, create new ones, or open existing folders.
- **Snapshot**: A frozen copy of a RequestDraft taken at load or save time, used for dirty state comparison.
- **Dirty_State**: The condition where a Tab's current RequestDraft differs from its Snapshot.
- **ResolvedSettings**: The merged result of GlobalSettings and WorkspaceSettings, where workspace values take precedence.
- **WorkspaceService**: The service responsible for workspace CRUD operations and request persistence.
- **HistoryService**: The service responsible for persisting and querying history entries.
- **SettingsService**: The service responsible for loading and saving global and workspace settings.
- **RegistryService**: The service that tracks recently opened workspaces for quick access.

## Requirements

### Requirement 1: Tab Lazy Loading

**User Story:** As a user, I want tabs to load request data on demand, so that opening a workspace with many tabs does not cause startup delays.

#### Acceptance Criteria

1. WHEN a user opens a request from the collection tree, THE TabsStore SHALL create a new Tab with a `requestId` reference and an initially undefined `requestDraft`
2. WHEN a Tab with the same `sourceId` already exists, THE TabsStore SHALL activate the existing Tab instead of creating a new one
3. WHEN a Tab becomes active and its `requestDraft` is undefined, THE TabsStore SHALL load the request data from WorkspaceService and populate the `requestDraft`
4. WHEN loading a request that no longer exists on disk, THE TabsStore SHALL mark the Tab as error state and display a "Request not found" message

### Requirement 2: Draft Conversion

**User Story:** As a user, I want to edit request data freely in the UI, so that I can modify headers, params, and body without affecting the persisted data until I save.

#### Acceptance Criteria

1. WHEN a Domain_Request is loaded into a Tab, THE TabsStore SHALL convert it to a RequestDraft with ephemeral IDs assigned to each KeyValuePairEditable
2. THE RequestDraft SHALL preserve all meaningful data from the Domain_Request including name, protocol, method, URL, headers, params, body, auth, preRequest, and tests
3. WHEN a user saves a Tab, THE TabsStore SHALL convert the RequestDraft back to a Domain_Request by stripping ephemeral IDs and filtering out empty key-value rows
4. FOR ALL valid Domain_Request objects, converting to RequestDraft then back to Domain_Request SHALL produce an equivalent object (round-trip property, modulo empty rows and updatedAt)

### Requirement 3: Dirty State Detection

**User Story:** As a user, I want to see which tabs have unsaved changes, so that I do not accidentally lose my edits.

#### Acceptance Criteria

1. WHEN a Tab is loaded or saved, THE TabsStore SHALL store a Snapshot of the current RequestDraft
2. THE TabsStore SHALL mark a Tab as dirty when the current RequestDraft differs from the Snapshot after stripping empty key-value rows
3. WHEN a user saves a Tab successfully, THE TabsStore SHALL update the Snapshot and mark the Tab as clean
4. WHEN a user adds an empty key-value row without filling in key or value, THE TabsStore SHALL NOT mark the Tab as dirty

### Requirement 4: Tab Save Operation

**User Story:** As a user, I want to save my request edits with a keyboard shortcut, so that my changes persist to disk reliably.

#### Acceptance Criteria

1. WHEN a user triggers save on a dirty Tab, THE TabsStore SHALL convert the RequestDraft to a Domain_Request and persist it via WorkspaceService
2. WHEN the save operation succeeds, THE TabsStore SHALL update the Snapshot and set `isDirty` to false
3. IF the save operation fails, THEN THE TabsStore SHALL retain the dirty state and report the error to the user
4. WHEN a user triggers save on a clean Tab, THE TabsStore SHALL perform no operation

### Requirement 5: History Store Migration

**User Story:** As a user, I want my request history to be managed through the workspace service layer, so that it is stored efficiently as summaries rather than full request/response blobs.

#### Acceptance Criteria

1. WHEN a request execution completes, THE HistoryStore SHALL create a HistoryEntry containing method, URL, status, duration, responseSize, workspaceId, and timestamp
2. THE HistoryStore SHALL delegate all persistence operations to HistoryService
3. WHEN a history entry is recorded, THE HistoryStore SHALL prepend it to the reactive entries list for immediate UI update
4. THE HistoryStore SHALL support filtering entries by method, URL pattern, and date range
5. IF writing a history entry to disk fails, THEN THE HistoryStore SHALL log the error without blocking the request flow

### Requirement 6: Legacy History Migration

**User Story:** As a user, I want my existing history entries to be preserved when migrating to the new architecture, so that I do not lose past request records.

#### Acceptance Criteria

1. WHEN the application starts and legacy history data exists, THE Migration_Module SHALL convert each legacy entry to a domain HistoryEntry with summary fields only
2. WHEN migrating a legacy entry that contains full request/response data, THE Migration_Module SHALL extract only method, URL, status, duration, and responseSize
3. WHEN migration completes successfully, THE Migration_Module SHALL mark the legacy data as migrated to prevent re-processing

### Requirement 7: Settings Store Migration

**User Story:** As a user, I want my settings to follow a layered model with global and workspace scopes, so that I can have workspace-specific configurations that override my global preferences.

#### Acceptance Criteria

1. WHEN the SettingsStore loads, THE SettingsStore SHALL read global settings from `~/.snag/settings.json` and workspace settings from `<workspace>/settings.json`
2. THE SettingsStore SHALL merge global and workspace settings into a ResolvedSettings object where workspace values take precedence over global values
3. WHEN a user updates a global setting, THE SettingsStore SHALL persist the change to `~/.snag/settings.json` and recompute ResolvedSettings
4. WHEN a user updates a workspace setting, THE SettingsStore SHALL persist the change to `<workspace>/settings.json` and recompute ResolvedSettings
5. IF a settings file is corrupted (JSON parse error), THEN THE SettingsStore SHALL fall back to default values for that layer and log a warning
6. WHEN the next settings save occurs after corruption recovery, THE SettingsStore SHALL overwrite the corrupted file with valid JSON

### Requirement 8: Settings Merge Correctness

**User Story:** As a user, I want my workspace settings to always correctly override global settings, so that per-project configurations work predictably.

#### Acceptance Criteria

1. THE Settings_Merge SHALL assign global-only fields (theme, fontSize, fontFamily, language) from GlobalSettings
2. THE Settings_Merge SHALL assign workspace-overridable fields (proxy, defaultHeaders, timeout, followRedirects, validateSsl) from WorkspaceSettings when present
3. WHEN a workspace-overridable field is absent from WorkspaceSettings, THE Settings_Merge SHALL use the defined default value (timeout: 30, followRedirects: true, validateSsl: true)
4. FOR ALL combinations of GlobalSettings and WorkspaceSettings, merging SHALL be idempotent (merging the same inputs always produces the same output)

### Requirement 9: Workspace Switching

**User Story:** As a user, I want to switch between workspaces seamlessly, so that I can work on different API projects without restarting the application.

#### Acceptance Criteria

1. WHEN a user selects a different workspace from the WorkspaceSwitcher, THE WorkspaceStore SHALL close the current workspace and open the selected one
2. WHEN a workspace is closed, THE WorkspaceStore SHALL clear all tabs and request caches to prevent stale data from persisting
3. WHEN a workspace is opened, THE WorkspaceStore SHALL load the workspace manifest and hydrate the necessary stores
4. WHEN a workspace switch succeeds, THE RegistryService SHALL update the `lastOpenedAt` timestamp for the newly opened workspace
5. IF the target workspace path does not exist or its manifest is corrupted, THEN THE WorkspaceStore SHALL keep the current workspace open and display an error message

### Requirement 10: Workspace Switcher UI

**User Story:** As a user, I want a workspace switcher in the sidebar, so that I can quickly access my recent workspaces and create new ones.

#### Acceptance Criteria

1. THE WorkspaceSwitcher SHALL display the current workspace name in the sidebar header
2. WHEN the user activates the WorkspaceSwitcher dropdown, THE WorkspaceSwitcher SHALL show a list of recent workspaces from RegistryService
3. THE WorkspaceSwitcher SHALL provide actions for: switching to a recent workspace, creating a new workspace, and opening an existing folder
4. WHEN a user creates a new workspace, THE WorkspaceSwitcher SHALL trigger workspace creation with the specified name and folder path
5. WHEN a user chooses to open an existing folder, THE WorkspaceSwitcher SHALL present a folder picker dialog via the Tauri dialog plugin

### Requirement 11: Ephemeral ID Non-Persistence

**User Story:** As a developer, I want ephemeral IDs used for Vue list rendering to never be written to disk, so that persisted data remains clean and deterministic.

#### Acceptance Criteria

1. THE Draft_Converter SHALL assign ephemeral IDs (via nanoid or crypto.randomUUID) to each KeyValuePairEditable when converting from Domain_Request to RequestDraft
2. THE Draft_Converter SHALL strip all ephemeral IDs when converting from RequestDraft back to Domain_Request
3. FOR ALL save operations, the persisted request file SHALL NOT contain any ephemeral ID fields from KeyValuePairEditable

### Requirement 12: Legacy Import Elimination

**User Story:** As a developer, I want all legacy `src/types/` imports removed, so that the codebase exclusively uses the domain layer types.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Codebase SHALL contain zero imports from `src/types/` directory
2. THE Migration SHALL replace all HttpMethod enum usages with HttpMethod string union type
3. THE Migration SHALL replace all ProtocolType enum usages with ProtocolType string union type
4. THE Migration SHALL replace all KeyValuePair with `id` field usages with domain KeyValuePair (no `id`) plus KeyValuePairEditable where UI rendering requires it

### Requirement 13: Legacy useStorage Removal

**User Story:** As a developer, I want the legacy `useStorage` composable removed after all stores migrate to the service layer, so that there is a single persistence path through StorageAdapter.

#### Acceptance Criteria

1. WHEN all stores have been migrated to use their respective services, THE Codebase SHALL remove the `useStorage` composable file
2. WHEN the `useStorage` composable is removed, THE Codebase SHALL contain zero references to `useStorage` in any import statement
3. THE Application SHALL pass `vue-tsc --noEmit` and `vite build` after removal with no type errors

### Requirement 14: Incremental Build Safety

**User Story:** As a developer, I want each migration phase to produce a build-passing state, so that the migration can be safely reviewed and merged in stages.

#### Acceptance Criteria

1. WHEN any single migration phase is completed, THE Codebase SHALL pass `vue-tsc --noEmit` without type errors
2. WHEN any single migration phase is completed, THE Codebase SHALL pass `vite build` without build errors
3. THE Migration SHALL not introduce breaking changes to the running application between phases
