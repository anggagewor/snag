/**
 * Startup — app initialization orchestrator.
 *
 * Handles the full startup sequence:
 * 1. Init services
 * 2. Detect & run migration (v0 → v1)
 * 3. Ensure scratch pad exists
 * 4. Determine which workspace to open
 * 5. Return startup result for UI to act on
 *
 * Called once from main.ts / App.vue.
 */

import type { WorkspaceEntry } from '../domain'
import { initServices, useRegistryService, useStorageAdapter } from './provider'
import { detectV0Data, migrateV0ToV1, type MigrationResult } from './migration'
import { ensureScratchPad } from './scratch'

export interface StartupResult {
  /** Whether v0 data was migrated */
  migration: MigrationResult | null
  /** Path to scratch pad workspace */
  scratchPadPath: string
  /** Last opened workspace (if any) */
  lastOpened: WorkspaceEntry | null
  /** All registered workspaces */
  workspaces: WorkspaceEntry[]
}

/**
 * Run full app startup sequence.
 * Call once at application boot.
 */
export async function startApp(): Promise<StartupResult> {
  // 1. Initialize all services
  await initServices()

  const storage = useStorageAdapter()
  const registry = useRegistryService()

  // 2. Detect & run migration
  let migration: MigrationResult | null = null
  const hasV0Data = await detectV0Data(storage)
  if (hasV0Data) {
    migration = await migrateV0ToV1(storage, registry)
    console.info('[startup] Migration complete:', migration)
  }

  // 3. Ensure scratch pad
  const scratchPadPath = await ensureScratchPad(storage)

  // 4. Load workspace registry
  const workspaces = await registry.listWorkspaces()
  const lastOpened = await registry.getLastOpened()

  return {
    migration,
    scratchPadPath,
    lastOpened,
    workspaces,
  }
}
