# Requirements Document

## Introduction

A unified notification and structured logging system for Snag. The system provides three tiers of user-facing feedback (info toast, actionable toast, critical modal) and a structured logging backend that captures all application events with rotation and accessibility from the Settings panel. This replaces the current ad-hoc `console.error()` / `console.warn()` usage throughout the codebase.

## Glossary

- **Notification_System**: The subsystem responsible for displaying user-facing feedback messages (toasts and modals) in the Snag application UI
- **Toast**: A lightweight, non-blocking notification rendered in the bottom-right corner of the application window
- **Actionable_Toast**: A toast variant that includes one or more interactive buttons (e.g., "Retry", "Go to Settings") and persists until dismissed or acted upon
- **Error_Modal**: A blocking modal dialog displayed for critical errors that require user acknowledgment before the application continues
- **Logger**: The subsystem responsible for writing structured log entries to disk in the `~/.snag/logs/` directory
- **Log_Entry**: A single structured record containing timestamp, level, source, message, and optional metadata
- **Log_Level**: One of debug, info, warn, or error indicating the severity of a log entry
- **Log_Source**: The module or service name that produced the log entry (e.g., "WorkspaceService", "useHttp")
- **Log_Rotation**: The automatic process of archiving or deleting old log files based on age or size constraints
- **Notification_Store**: The Pinia store that manages the queue of active notifications and exposes actions for creating and dismissing them
- **Settings_Panel**: The existing settings UI where users can access the "View Logs" functionality

## Requirements

### Requirement 1: Display Info Toasts

**User Story:** As a user, I want to see lightweight success and informational feedback, so that I know my actions completed successfully without interrupting my workflow.

#### Acceptance Criteria

1. WHEN a success or informational event occurs, THE Notification_System SHALL display a Toast in the bottom-right corner of the application window
2. WHEN a Toast is displayed, THE Notification_System SHALL auto-dismiss the Toast after 3 seconds
3. WHILE a Toast is visible, THE Notification_System SHALL allow the user to manually dismiss the Toast before the auto-dismiss timer expires
4. WHEN multiple Toasts are triggered in sequence, THE Notification_System SHALL stack them vertically with the most recent Toast at the bottom
5. THE Notification_System SHALL display each Toast with an icon corresponding to its type (success or info)

### Requirement 2: Display Actionable Toasts

**User Story:** As a user, I want to see warning or error notifications with recovery actions, so that I can quickly resolve recoverable issues without navigating away from my current task.

#### Acceptance Criteria

1. WHEN a recoverable error or warning occurs, THE Notification_System SHALL display an Actionable_Toast with a descriptive message and at least one action button
2. WHILE an Actionable_Toast is visible, THE Notification_System SHALL keep the Actionable_Toast displayed until the user clicks the action button or the dismiss button
3. WHEN the user clicks an action button on an Actionable_Toast, THE Notification_System SHALL execute the associated callback and dismiss the Actionable_Toast
4. WHEN the user dismisses an Actionable_Toast without acting, THE Notification_System SHALL remove the Actionable_Toast without executing any callback
5. THE Notification_System SHALL render Actionable_Toasts in the same bottom-right stack as info Toasts

### Requirement 3: Display Critical Error Modals

**User Story:** As a user, I want to be clearly alerted about critical unrecoverable errors, so that I understand the application state and can take appropriate action.

#### Acceptance Criteria

1. WHEN a critical unrecoverable error occurs, THE Notification_System SHALL display an Error_Modal that blocks interaction with the rest of the application
2. WHILE an Error_Modal is visible, THE Notification_System SHALL prevent interaction with UI elements behind the modal overlay
3. WHEN the user acknowledges an Error_Modal, THE Notification_System SHALL dismiss the modal and resume normal application interaction
4. THE Notification_System SHALL display the Error_Modal with an error icon, a descriptive title, a detailed message, and an "Acknowledge" button
5. IF multiple critical errors occur simultaneously, THEN THE Notification_System SHALL queue Error_Modals and display them one at a time

### Requirement 4: Write Structured Log Entries

**User Story:** As a developer, I want all application events to be written to structured log files, so that I can diagnose issues by reviewing detailed event history.

#### Acceptance Criteria

1. THE Logger SHALL write each Log_Entry with the following fields: timestamp (ISO 8601), level (Log_Level), source (Log_Source), message (string), and metadata (optional JSON object)
2. WHEN any error is displayed via Toast or Error_Modal, THE Logger SHALL also write a corresponding Log_Entry with level "error" or "warn"
3. WHEN a technical error occurs that has no user-facing representation, THE Logger SHALL write a Log_Entry without triggering a notification
4. THE Logger SHALL write log files to the `~/.snag/logs/` directory
5. THE Logger SHALL create the `~/.snag/logs/` directory if the directory does not exist on first write

### Requirement 5: Rotate Log Files

**User Story:** As a user, I want log files to be automatically managed, so that they do not consume excessive disk space over time.

#### Acceptance Criteria

1. THE Logger SHALL rotate log files when the active log file exceeds 5 megabytes in size
2. THE Logger SHALL delete log files older than 7 days during rotation
3. WHEN a rotation is triggered, THE Logger SHALL close the current log file, rename it with a timestamp suffix, and create a new active log file
4. IF the log directory cannot be written to, THEN THE Logger SHALL fall back to writing to the application console without crashing

### Requirement 6: Access Logs from Settings Panel

**User Story:** As a user, I want to view application logs from within the Settings panel, so that I can inspect recent errors and share diagnostic information when reporting issues.

#### Acceptance Criteria

1. THE Settings_Panel SHALL display a "View Logs" button in the settings interface
2. WHEN the user clicks "View Logs", THE Settings_Panel SHALL open the `~/.snag/logs/` directory in the system file manager
3. THE Settings_Panel SHALL display the current total size of the logs directory next to the "View Logs" button

### Requirement 7: Provide Notification API for Services and Stores

**User Story:** As a developer, I want a consistent API to trigger notifications from any service or store, so that error handling is uniform across the codebase.

#### Acceptance Criteria

1. THE Notification_Store SHALL expose an `info` action that accepts a message string and displays an info Toast
2. THE Notification_Store SHALL expose a `success` action that accepts a message string and displays a success Toast
3. THE Notification_Store SHALL expose a `warn` action that accepts a message string, an optional action label, and an optional callback, and displays an Actionable_Toast
4. THE Notification_Store SHALL expose an `error` action that accepts a message string, an optional action label, and an optional callback, and displays an Actionable_Toast
5. THE Notification_Store SHALL expose a `critical` action that accepts a title and message string and displays an Error_Modal
6. THE Notification_Store SHALL assign a unique identifier to each notification for tracking and programmatic dismissal

### Requirement 8: Provide Logger API for All Layers

**User Story:** As a developer, I want a logging function accessible from domain services and stores, so that I can replace ad-hoc console statements with structured logging.

#### Acceptance Criteria

1. THE Logger SHALL expose a `debug` function that accepts source, message, and optional metadata and writes a Log_Entry with level "debug"
2. THE Logger SHALL expose an `info` function that accepts source, message, and optional metadata and writes a Log_Entry with level "info"
3. THE Logger SHALL expose a `warn` function that accepts source, message, and optional metadata and writes a Log_Entry with level "warn"
4. THE Logger SHALL expose an `error` function that accepts source, message, and optional metadata and writes a Log_Entry with level "error"
5. THE Logger SHALL be importable from any layer (services, stores, composables) without introducing circular dependencies

### Requirement 9: Support Dark Mode for Notification UI

**User Story:** As a user, I want notifications to follow the application theme, so that they are visually consistent with the rest of the interface.

#### Acceptance Criteria

1. THE Notification_System SHALL render Toasts and Error_Modals using the application semantic color tokens (bg-surface, text-primary, border-muted, text-success, text-warning, text-error)
2. WHILE the application is in dark mode, THE Notification_System SHALL apply `dark:` variant styles to all notification elements
3. THE Notification_System SHALL use transition animations consistent with other Snag UI components (200ms enter, 150ms leave)

### Requirement 10: Handle HTTP Error Notifications

**User Story:** As a user, I want clear feedback when HTTP requests fail, so that I understand what went wrong and can take corrective action.

#### Acceptance Criteria

1. WHEN an HTTP request times out, THE Notification_System SHALL display an Actionable_Toast with the message including the timeout duration and a "Retry" action button
2. WHEN an HTTP request fails due to an SSL certificate error, THE Notification_System SHALL display an Actionable_Toast with the error details and a "Go to Settings" action button
3. WHEN an HTTP request fails due to a network error, THE Notification_System SHALL display an error Toast with the failure reason
4. WHEN any HTTP error occurs, THE Logger SHALL write a Log_Entry with level "error", source "useHttp", and metadata containing the request URL and method
