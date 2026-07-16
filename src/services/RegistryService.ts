/**
 * RegistryService — global workspace registry.
 *
 * Manages ~/.snag/workspaces.json (cache, not database).
 * Tracks recently opened workspaces for quick access.
 *
 * Depends on: domain/, storage/
 * Does NOT depend on: stores/, UI, Vue, Pinia
 */

import type { WorkspaceId, WorkspaceEntry } from '../domain'

// ─── Result Types ────────────────────────────────────────────────

export interface WorkspaceValidation {
  readonly entry: WorkspaceEntry
  readonly exists: boolean
}

// ─── Interface ───────────────────────────────────────────────────

export interface RegistryService {
  /** Load all registered workspaces. */
  listWorkspaces(): Promise<WorkspaceEntry[]>

  /** Register a workspace (on open or create). Upserts by ID. */
  registerWorkspace(entry: WorkspaceEntry): Promise<void>

  /** Remove workspace from registry. Does NOT delete workspace files. */
  unregisterWorkspace(id: WorkspaceId): Promise<void>

  /** Update lastOpenedAt timestamp. */
  updateLastOpened(id: WorkspaceId): Promise<void>

  /** Update workspace path (user relocated folder). */
  updatePath(id: WorkspaceId, newPath: string): Promise<void>

  /** Validate all registered paths exist on disk. */
  validatePaths(): Promise<WorkspaceValidation[]>

  /** Get most recently opened workspace. */
  getLastOpened(): Promise<WorkspaceEntry | null>
}
