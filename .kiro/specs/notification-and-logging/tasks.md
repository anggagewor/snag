# Implementation Plan: Notification and Logging

## Overview

Implement a unified notification and structured logging system for Snag. The plan follows the existing architecture (domain → services → stores → UI) and introduces a Logger module at the services layer, a NotificationStore in Pinia, a bridge function connecting both, and UI components (ToastContainer, ErrorModalOverlay) rendered at the App.vue root. The Settings panel gains a "View Logs" button to open the log directory.

## Tasks

- [x] 1. Create Logger module and integrate with service provider
  - [x] 1.1 Implement Logger module (`src/services/Logger.ts`)
    - Define `LogLevel`, `LogEntry` types
    - Implement `createLogger(getLogsDir: () => string)` factory function
    - Implement `formatLogEntry()` — produces a JSON-lines string for a single entry
    - Implement `shouldRotate(fileSize: number)` — returns true if size > 5MB
    - Implement `getExpiredFiles(files: string[], now: Date)` — returns filenames older than 7 days
    - Implement file write logic using `@tauri-apps/plugin-fs` (appendFile / writeTextFile)
    - Implement rotation: rename current file with suffix, start new file
    - Implement cleanup: delete expired files during rotation
    - Implement console fallback when file write fails (set `_fallbackMode` flag)
    - Ensure logs directory is created if it doesn't exist on first write
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 5.1, 5.3, 5.4, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 1.2 Write property test: Log entry structure completeness (Property 4)
    - **Property 4: Log entry structure completeness**
    - **Validates: Requirements 4.1**
    - Generate random log levels, source strings, messages, and metadata objects
    - Assert formatted output is valid JSON with all required fields

  - [ ]* 1.3 Write property test: Size-based rotation trigger (Property 6)
    - **Property 6: Size-based rotation trigger**
    - **Validates: Requirements 5.1**
    - Generate random file sizes (0–20MB)
    - Assert `shouldRotate()` returns true for sizes > 5MB and false otherwise

  - [ ]* 1.4 Write property test: Age-based log cleanup (Property 7)
    - **Property 7: Age-based log cleanup**
    - **Validates: Requirements 5.2**
    - Generate random sets of filenames with date components spanning past 30 days
    - Assert `getExpiredFiles()` returns only files older than 7 days

  - [x] 1.5 Register Logger in service provider (`src/services/provider.ts`)
    - Add `_logger` singleton variable
    - Create logger instance in `initServices()` using `storage.globalPath('logs')` for path resolution
    - Export `useLogger()` getter function
    - Ensure logs directory exists via `_storage.ensureDir(_storage.globalPath('logs'))`
    - _Requirements: 8.5_

- [x] 2. Checkpoint — Logger module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create NotificationStore
  - [x] 3.1 Implement NotificationStore (`src/stores/notifications.ts`)
    - Define `NotificationType`, `NotificationAction`, `ToastNotification`, `ModalNotification` types
    - Define `NotificationState` interface (toastQueue, modalQueue, nextId)
    - Implement `info(message)` action — pushes info toast, persistent: false
    - Implement `success(message)` action — pushes success toast, persistent: false
    - Implement `warn(message, actionLabel?, callback?)` action — pushes warn toast, persistent: true when action provided
    - Implement `error(message, actionLabel?, callback?)` action — pushes error toast, persistent: true when action provided
    - Implement `critical(title, message)` action — pushes to modalQueue
    - Implement `dismiss(id)` action — removes toast from queue
    - Implement `executeAction(id)` action — calls callback then dismisses
    - Implement `acknowledgeModal(id)` action — removes modal from queue
    - Assign unique ID to each notification using monotonic counter (`notif-{nextId++}`)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 3.2 Write property test: Toast queue preserves insertion order (Property 1)
    - **Property 1: Toast queue preserves insertion order**
    - **Validates: Requirements 1.4**
    - Generate random sequences of notification types and messages
    - Assert queue order matches insertion order

  - [ ]* 3.3 Write property test: Actionable toast invariants (Property 2)
    - **Property 2: Actionable toast invariants**
    - **Validates: Requirements 2.1, 2.2**
    - Generate random messages with non-empty action labels and callbacks
    - Assert resulting notifications have persistent: true and contain action object

  - [ ]* 3.4 Write property test: Modal queue single-display invariant (Property 3)
    - **Property 3: Modal queue single-display invariant**
    - **Validates: Requirements 3.5**
    - Generate random counts of modal notifications (1–20)
    - Assert only first modal is active; acknowledging promotes next

  - [ ]* 3.5 Write property test: Notification ID uniqueness (Property 8)
    - **Property 8: Notification ID uniqueness**
    - **Validates: Requirements 7.6**
    - Generate random sequences of N notifications (1–1000) of mixed types
    - Assert all assigned IDs are unique

- [x] 4. Checkpoint — NotificationStore
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement bridge function and HTTP error integration
  - [x] 5.1 Implement `logAndNotify` bridge (`src/services/logAndNotify.ts`)
    - Define `NotifyOptions` interface (type, actionLabel, callback, title)
    - Implement `logAndNotify(source, message, metadata?, notify?)` function
    - Always log via Logger (map notify type to log level)
    - If `notify` provided, push notification to NotificationStore based on type
    - Handle `critical` type by calling `critical(title, message)` on store
    - Wrap store calls in try/catch to avoid infinite loops on error
    - _Requirements: 4.2_

  - [ ]* 5.2 Write property test: Error notification produces log entry (Property 5)
    - **Property 5: Error notification produces log entry**
    - **Validates: Requirements 4.2**
    - Generate random source/message/metadata at warn/error level
    - Assert Logger receives corresponding write call with same data

  - [x] 5.3 Integrate notifications into `useHttp` composable (`src/composables/useHttp.ts`)
    - Import `logAndNotify` from bridge
    - On request timeout: call `logAndNotify('useHttp', message, { url, method }, { type: 'warn', actionLabel: 'Retry', callback: retryFn })`
    - On SSL error: call `logAndNotify('useHttp', message, { url, method }, { type: 'warn', actionLabel: 'Go to Settings', callback: openSettings })`
    - On network error: call `logAndNotify('useHttp', message, { url, method }, { type: 'error' })`
    - Ensure metadata always includes URL and HTTP method
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 5.4 Write property test: HTTP error log metadata completeness (Property 9)
    - **Property 9: HTTP error log metadata completeness**
    - **Validates: Requirements 10.4**
    - Generate random URLs and HTTP methods
    - Assert log entry metadata contains both url and method fields

- [x] 6. Checkpoint — Bridge and HTTP integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement notification UI components
  - [x] 7.1 Create ToastContainer component (`src/features/notifications/ToastContainer.vue`)
    - Render as fixed-position container (bottom-right)
    - Iterate over `toastQueue` from NotificationStore (max 5 visible)
    - Display icon per type: CheckCircle (success), Info (info), AlertTriangle (warn), XCircle (error) from lucide-vue-next
    - Display message text, optional action button (BaseButton), and dismiss (X) button
    - Auto-dismiss non-persistent toasts after 3000ms via setTimeout
    - Clear timers on component unmount (onUnmounted)
    - Apply enter transition (200ms slide+fade) and leave transition (150ms fade)
    - Use semantic color tokens: bg-surface, text-primary, border-muted, text-success, text-warning, text-error
    - Apply `dark:` variant styles for dark mode
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 9.3_

  - [x] 7.2 Create ErrorModalOverlay component (`src/features/notifications/ErrorModalOverlay.vue`)
    - Use existing BaseModal component
    - Read `modalQueue` from NotificationStore
    - Display only the first modal in queue (one at a time)
    - Show XCircle icon, title, message, and "Acknowledge" BaseButton
    - On acknowledge: call `acknowledgeModal(id)` — removes from queue, next shows
    - Apply semantic color tokens and dark mode variants
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 9.1, 9.2_

  - [x] 7.3 Wire notification components into App.vue (`src/App.vue`)
    - Import and render ToastContainer and ErrorModalOverlay at root level (after SearchPalette)
    - Ensure they are always visible regardless of route/layout state
    - _Requirements: 1.1, 3.1_

- [x] 8. Checkpoint — Notification UI
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Settings panel integration
  - [x] 9.1 Add "View Logs" section to SettingsPanel (`src/features/settings/SettingsPanel.vue`)
    - Add "View Logs" button using BaseButton
    - On click: use `@tauri-apps/plugin-opener` to open `~/.snag/logs/` in system file manager
    - Compute and display total log directory size (list files, sum sizes) next to button
    - Use StorageAdapter `globalPath('logs')` for path resolution
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Logger module is a plain TypeScript module (no Pinia dependency) to satisfy requirement 8.5
- The project already has `fast-check` and `vitest` configured — no additional test framework setup needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "9.1"] }
  ]
}
```
