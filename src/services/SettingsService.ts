/**
 * SettingsService — layered settings management.
 *
 * Two persistent layers: Global (~/.snag/settings.json)
 * and Workspace (<workspace>/settings.json).
 * Merge strategy: workspace overrides global.
 *
 * Depends on: domain/, storage/
 * Does NOT depend on: stores/, UI, Vue, Pinia
 */

import type { GlobalSettings, WorkspaceSettings } from '../domain'

// ─── Merged Settings ─────────────────────────────────────────────

export type ResolvedSettings = GlobalSettings & WorkspaceSettings

export type SettingsScope = 'global' | 'workspace'

// ─── Interface ───────────────────────────────────────────────────

export interface SettingsService {
  /** Load global settings. Creates default file if not exists. */
  loadGlobal(): Promise<GlobalSettings>

  /** Save global settings. */
  saveGlobal(settings: GlobalSettings): Promise<void>

  /** Update partial global settings. */
  updateGlobal(partial: Partial<GlobalSettings>): Promise<GlobalSettings>

  /** Load workspace settings. Returns null if no workspace open. */
  loadWorkspace(): Promise<WorkspaceSettings | null>

  /** Save workspace settings. Throws if no workspace open. */
  saveWorkspace(settings: WorkspaceSettings): Promise<void>

  /** Update partial workspace settings. */
  updateWorkspace(partial: Partial<WorkspaceSettings>): Promise<WorkspaceSettings>

  /** Get merged settings (global + workspace). */
  getResolved(): Promise<ResolvedSettings>

  /** Get default global settings (factory reset values). */
  getDefaults(): GlobalSettings
}
