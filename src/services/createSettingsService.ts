/**
 * SettingsService implementation.
 *
 * Two layers: global (~/.snag/settings.json) + workspace (<root>/settings.json).
 * Merge: workspace overrides global.
 */

import type { GlobalSettings, WorkspaceSettings } from '../domain'
import type { StorageAdapter } from '../storage'
import type { GlobalSettingsFile, WorkspaceSettingsFile } from '../storage/models'
import type { SettingsService, ResolvedSettings } from './SettingsService'
import {
  globalSettingsFromFile,
  globalSettingsToFile,
  workspaceSettingsFromFile,
  workspaceSettingsToFile,
} from '../storage'

const SETTINGS_FILE = 'settings.json'

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: 'system',
  fontSize: 13,
  fontFamily: 'SF Mono, Menlo, Monaco, monospace',
  language: 'en',
}

export function createSettingsService(storage: StorageAdapter): SettingsService {
  return {
    async loadGlobal(): Promise<GlobalSettings> {
      const path = storage.globalPath(SETTINGS_FILE)
      const exists = await storage.exists(path)
      if (!exists) {
        await this.saveGlobal(DEFAULT_GLOBAL_SETTINGS)
        return DEFAULT_GLOBAL_SETTINGS
      }
      try {
        const file = await storage.readJson<GlobalSettingsFile>(path)
        return globalSettingsFromFile(file)
      } catch {
        return DEFAULT_GLOBAL_SETTINGS
      }
    },

    async saveGlobal(settings: GlobalSettings): Promise<void> {
      const path = storage.globalPath(SETTINGS_FILE)
      const file = globalSettingsToFile(settings)
      await storage.writeJson(path, file)
    },

    async updateGlobal(partial: Partial<GlobalSettings>): Promise<GlobalSettings> {
      const current = await this.loadGlobal()
      const updated: GlobalSettings = { ...current, ...partial }
      await this.saveGlobal(updated)
      return updated
    },

    async loadWorkspace(): Promise<WorkspaceSettings | null> {
      try {
        const path = storage.workspacePath(SETTINGS_FILE)
        const exists = await storage.exists(path)
        if (!exists) return null
        const file = await storage.readJson<WorkspaceSettingsFile>(path)
        return workspaceSettingsFromFile(file)
      } catch {
        return null
      }
    },

    async saveWorkspace(settings: WorkspaceSettings): Promise<void> {
      const path = storage.workspacePath(SETTINGS_FILE)
      const file = workspaceSettingsToFile(settings)
      await storage.writeJson(path, file)
    },

    async updateWorkspace(partial: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
      const current = await this.loadWorkspace() ?? {}
      const updated: WorkspaceSettings = { ...current, ...partial }
      await this.saveWorkspace(updated)
      return updated
    },

    async getResolved(): Promise<ResolvedSettings> {
      const global = await this.loadGlobal()
      const workspace = await this.loadWorkspace()
      return { ...global, ...workspace } as ResolvedSettings
    },

    getDefaults(): GlobalSettings {
      return { ...DEFAULT_GLOBAL_SETTINGS }
    },
  }
}
