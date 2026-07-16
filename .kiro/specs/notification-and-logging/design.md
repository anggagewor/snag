# Design Document: Notification and Logging

## Overview

This design introduces two complementary subsystems for Snag:

1. **Logger** — a standalone module (no Pinia dependency) that writes structured log entries to `~/.snag/logs/` with automatic rotation. Usable from any layer (domain services, stores, composables).
2. **NotificationStore** — a Pinia store that manages a queue of user-facing notifications (info toasts, actionable toasts, critical error modals) rendered at the app root level.

A **convenience bridge function** (`logAndNotify`) connects both: it writes a log entry AND pushes a notification in a single call, used by services like `useHttp` for error reporting.

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Logger is a plain TS module, not a store | Must be importable from services layer which has no Pinia dependency |
| NotificationStore is Pinia | Needs reactivity for UI binding, queue management, and action dispatching |
| Toast container rendered at App.vue root | Ensures toasts are always visible regardless of route/layout state |
| Log files are per-day with size splitting | Balances readability (one file per day) with file size limits (5MB split) |
| Logger uses StorageAdapter indirectly | Writes raw text via Tauri FS plugin directly (StorageAdapter is JSON-focused); uses `globalPath()` for path resolution |

## Architecture

```mermaid
graph TD
    subgraph UI Layer
        TC[ToastContainer.vue]
        EM[ErrorModalOverlay.vue]
        SP[SettingsPanel.vue]
    end

    subgraph Store Layer
        NS[NotificationStore]
    end

    subgraph Service/Module Layer
        L[Logger Module]
        B[logAndNotify bridge]
        HTTP[useHttp composable]
        WS[WorkspaceService]
    end

    subgraph Storage Layer
        SA[StorageAdapter - globalPath]
        FS[@tauri-apps/plugin-fs]
    end

    TC -->|reads queue| NS
    EM -->|reads modal queue| NS
    SP -->|opens log dir| FS

    HTTP -->|error| B
    WS -->|error| B
    B --> NS
    B --> L

    L -->|writes| FS
    L -->|path from| SA

    NS -->|dismiss/action| TC
    NS -->|acknowledge| EM
```

### Data Flow

1. **Service encounters error** → calls `logAndNotify('useHttp', 'Request timeout', { url }, { type: 'warn', action: 'Retry', callback: retryFn })`
2. **Bridge function** → writes log entry via Logger AND pushes notification via NotificationStore
3. **NotificationStore** → adds notification to reactive queue with unique ID
4. **ToastContainer** → renders active toasts from queue, handles dismiss/action clicks
5. **Logger** → formats entry as structured line, appends to current day's log file, checks rotation

## Components and Interfaces

### Logger Module (`src/services/Logger.ts`)

```typescript
// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// A single structured log entry
interface LogEntry {
  timestamp: string    // ISO 8601
  level: LogLevel
  source: string       // e.g., "WorkspaceService", "useHttp"
  message: string
  metadata?: Record<string, unknown>
}

// Logger public API
interface Logger {
  debug(source: string, message: string, metadata?: Record<string, unknown>): void
  info(source: string, message: string, metadata?: Record<string, unknown>): void
  warn(source: string, message: string, metadata?: Record<string, unknown>): void
  error(source: string, message: string, metadata?: Record<string, unknown>): void
}

// Factory
function createLogger(getLogsDir: () => string): Logger
```

The Logger is created once during `initServices()` and exported as a singleton from `src/services/provider.ts`. Internally it:
- Formats entries as JSON lines (one JSON object per line)
- Appends to `snag-YYYY-MM-DD.log`
- If file exceeds 5MB, renames to `snag-YYYY-MM-DD-001.log` and starts a new file
- On each write, checks for files older than 7 days and deletes them
- Falls back to `console.error()` if file write fails

### NotificationStore (`src/stores/notifications.ts`)

```typescript
type NotificationType = 'info' | 'success' | 'warn' | 'error'

interface NotificationAction {
  label: string
  callback: () => void
}

interface ToastNotification {
  id: string
  type: NotificationType
  message: string
  action?: NotificationAction
  persistent: boolean   // true for actionable toasts (warn/error with action)
  createdAt: number
}

interface ModalNotification {
  id: string
  title: string
  message: string
  createdAt: number
}

// Store API
interface NotificationStoreActions {
  info(message: string): void
  success(message: string): void
  warn(message: string, actionLabel?: string, callback?: () => void): void
  error(message: string, actionLabel?: string, callback?: () => void): void
  critical(title: string, message: string): void
  dismiss(id: string): void
  executeAction(id: string): void
  acknowledgeModal(id: string): void
}
```

### ToastContainer Component (`src/features/notifications/ToastContainer.vue`)

- Rendered in `App.vue` (Teleported to body or placed at root)
- Positioned fixed bottom-right
- Iterates over `toastQueue` from NotificationStore
- Each toast renders with:
  - Icon (CheckCircle for success, Info for info, AlertTriangle for warn, XCircle for error)
  - Message text
  - Optional action button
  - Dismiss (X) button
- Auto-dismiss: sets a `setTimeout(3000)` for non-persistent toasts
- Transition: 200ms enter (slide + fade), 150ms leave (fade out)

### ErrorModalOverlay Component (`src/features/notifications/ErrorModalOverlay.vue`)

- Uses existing `BaseModal` component
- Reads `modalQueue` from NotificationStore
- Displays only the first modal in queue (one at a time)
- Shows error icon, title, message, and "Acknowledge" button
- On acknowledge: calls `acknowledgeModal(id)` → removes from queue → next modal shows (if any)

### Bridge Function (`src/services/logAndNotify.ts`)

```typescript
import { logger } from '@/services/provider'
import { useNotificationStore } from '@/stores/notifications'

interface NotifyOptions {
  type?: 'info' | 'success' | 'warn' | 'error' | 'critical'
  actionLabel?: string
  callback?: () => void
  title?: string  // for critical only
}

function logAndNotify(
  source: string,
  message: string,
  metadata?: Record<string, unknown>,
  notify?: NotifyOptions
): void
```

This function always logs. If `notify` is provided, it also pushes a notification to the store. This keeps the bridge optional — services can log-only or log+notify.

### Settings Panel Integration

Add to existing `SettingsPanel.vue`:
- "View Logs" button that calls `@tauri-apps/plugin-opener` to open `~/.snag/logs/`
- Display total log directory size (computed by listing files and summing sizes)

## Data Models

### LogEntry (on disk format — JSON Lines)

Each line in a `.log` file is a self-contained JSON object:

```json
{"timestamp":"2024-01-15T10:23:45.123Z","level":"error","source":"useHttp","message":"Request timeout after 30s","metadata":{"url":"https://api.example.com/users","method":"GET"}}
```

### Log File Naming

| Pattern | Description |
|---------|-------------|
| `snag-2024-01-15.log` | Primary log file for the day |
| `snag-2024-01-15-001.log` | First split (original exceeded 5MB) |
| `snag-2024-01-15-002.log` | Second split |

### Notification Queue State (in-memory only)

```typescript
interface NotificationState {
  toastQueue: ToastNotification[]   // ordered by createdAt, max visible ~5
  modalQueue: ModalNotification[]   // FIFO, display one at a time
  nextId: number                    // monotonic counter for ID generation
}
```

### Toast Notification Object

```typescript
{
  id: "notif-1",
  type: "warn",
  message: "Request timed out after 30s",
  action: { label: "Retry", callback: () => { /* retry logic */ } },
  persistent: true,
  createdAt: 1705312345123
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Toast queue preserves insertion order

*For any* sequence of N notifications added to the toast queue, the queue order SHALL match the insertion order (most recent notification at the end/bottom of the array).

**Validates: Requirements 1.4**

### Property 2: Actionable toast invariants

*For any* notification created with a non-empty action label and callback (via `warn` or `error` actions), the resulting notification SHALL have `persistent: true` AND contain an action object with the provided label and callback, ensuring it will not auto-dismiss.

**Validates: Requirements 2.1, 2.2**

### Property 3: Modal queue single-display invariant

*For any* state of the modal queue containing N ≥ 1 modals, only the first modal in the queue SHALL be considered active/displayed. Acknowledging it removes it and promotes the next.

**Validates: Requirements 3.5**

### Property 4: Log entry structure completeness

*For any* valid combination of log level, source string, message string, and optional metadata object, the Logger SHALL produce a formatted log line that is valid JSON containing all required fields: `timestamp` (ISO 8601), `level`, `source`, `message`, and `metadata` (when provided).

**Validates: Requirements 4.1**

### Property 5: Error notification produces log entry

*For any* notification created at level "warn" or "error" through the `logAndNotify` bridge, the Logger SHALL receive a corresponding write call with the same source, message, and metadata.

**Validates: Requirements 4.2**

### Property 6: Size-based rotation trigger

*For any* log file whose size exceeds 5 megabytes, the Logger's rotation check SHALL determine that rotation is needed (returns true for the should-rotate decision).

**Validates: Requirements 5.1**

### Property 7: Age-based log cleanup

*For any* set of log files in the logs directory, after a rotation/cleanup pass, no file with a date component older than 7 days from the current date SHALL remain.

**Validates: Requirements 5.2**

### Property 8: Notification ID uniqueness

*For any* sequence of N notifications created (of any type: info, success, warn, error, critical), all assigned IDs SHALL be unique.

**Validates: Requirements 7.6**

### Property 9: HTTP error log metadata completeness

*For any* HTTP error logged via the bridge with source "useHttp", the log entry metadata SHALL contain both the request URL and the HTTP method.

**Validates: Requirements 10.4**

## Error Handling

| Scenario | Strategy |
|----------|----------|
| Log directory write failure | Fall back to `console.error()`, do not crash. Set internal `_fallbackMode` flag to avoid repeated fs attempts for the session. |
| Log file rotation failure | Log rotation error to console, continue writing to current file. |
| NotificationStore action throws | Wrap in try/catch, log error via Logger (avoid infinite loop by not re-notifying). |
| Toast dismiss after component unmount | Guard against stale timer references; clear timers on component unmount. |
| Multiple rapid notifications | Queue all, render up to 5 visible toasts (older ones slide out), no notification is lost. |
| `logAndNotify` called before store is ready | Logger writes immediately (it's standalone). Notification is queued — store is available as soon as Pinia initializes (before mount). |
| StorageAdapter not initialized | Logger checks if global root is available; if not, uses `console` fallback until init completes. |

## Testing Strategy

### Unit Tests (Vitest)

| Area | Tests |
|------|-------|
| Logger formatting | Verify log entry JSON structure for each level |
| Logger rotation logic | Test shouldRotate(), getExpiredFiles(), rotation renaming |
| NotificationStore actions | Test each action creates correct notification type |
| NotificationStore dismiss | Test dismiss removes correct item, executeAction calls callback |
| Toast auto-dismiss | Test timer-based removal (using vi.useFakeTimers) |
| Modal queuing | Test only first modal is active, acknowledge removes it |
| Bridge function | Test it calls both logger and store |
| HTTP error mapping | Test timeout, SSL, network errors produce correct notifications |

### Property-Based Tests (fast-check)

The project already has `fast-check` as a dev dependency. Property tests will:
- Use minimum 100 iterations per property
- Be tagged with property references: `// Feature: notification-and-logging, Property N: description`
- Test pure logic functions (formatLogEntry, shouldRotate, getExpiredFiles, notification ID generation, queue ordering)

| Property | What's Generated |
|----------|-----------------|
| P1: Queue order | Random sequences of notification types and messages |
| P2: Actionable invariants | Random message strings, action labels, callbacks |
| P3: Modal single-display | Random counts of modal notifications (1-20) |
| P4: Log structure | Random log levels, source strings, messages, metadata objects |
| P5: Error → log bridge | Random source/message/metadata combinations at warn/error level |
| P6: Size rotation | Random file sizes (0 to 20MB) |
| P7: Age cleanup | Random sets of dates (past 30 days) |
| P8: ID uniqueness | Random counts of notifications (1-1000) |
| P9: HTTP metadata | Random URLs and HTTP methods |

### Integration Tests

- Settings panel "View Logs" button opens correct directory (mock opener plugin)
- Logger writes actual files in test environment
- End-to-end: `useHttp` error → toast appears → log file contains entry
