/**
 * Service Provider — singleton service instances.
 *
 * Creates and holds references to all services.
 * Call initServices() once at app startup.
 * Stores and composables access services via getters.
 */

import type { StorageAdapter } from '../storage'
import type { WorkspaceService } from './WorkspaceService'
import type { RegistryService } from './RegistryService'
import type { HistoryService } from './HistoryService'
import type { SettingsService } from './SettingsService'
import { createTauriStorageAdapter, initGlobalRoot } from '../storage/TauriStorageAdapter'
import { createWorkspaceService } from './createWorkspaceService'
import { createRegistryService } from './createRegistryService'
import { createHistoryService } from './createHistoryService'
import { createSettingsService } from './createSettingsService'

let _storage: StorageAdapter | null = null
let _workspace: WorkspaceService | null = null
let _registry: RegistryService | null = null
let _history: HistoryService | null = null
let _settings: SettingsService | null = null
let _initialized = false

/**
 * Initialize all services. Call once at app startup (main.ts).
 */
export async function initServices(): Promise<void> {
  if (_initialized) return

  await initGlobalRoot()

  _storage = createTauriStorageAdapter()
  _workspace = createWorkspaceService(_storage)
  _registry = createRegistryService(_storage)
  _history = createHistoryService(_storage)
  _settings = createSettingsService(_storage)

  // Ensure global directories exist
  await _storage.ensureDir(_storage.globalPath('history'))

  _initialized = true
}

function requireInit<T>(service: T | null, name: string): T {
  if (!service) {
    throw new Error(`Service "${name}" not initialized. Call initServices() first.`)
  }
  return service
}

export function useWorkspaceService(): WorkspaceService {
  return requireInit(_workspace, 'WorkspaceService')
}

export function useRegistryService(): RegistryService {
  return requireInit(_registry, 'RegistryService')
}

export function useHistoryService(): HistoryService {
  return requireInit(_history, 'HistoryService')
}

export function useSettingsService(): SettingsService {
  return requireInit(_settings, 'SettingsService')
}

export function useStorageAdapter(): StorageAdapter {
  return requireInit(_storage, 'StorageAdapter')
}
