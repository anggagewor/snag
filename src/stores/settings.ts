/**
 * Settings Store — layered settings management (global + workspace).
 *
 * Delegates persistence to SettingsService.
 * Merges global + workspace settings into a reactive ResolvedSettings.
 *
 * Backward compat:
 * - `settings` computed maps to `resolved` so existing UI keeps working
 * - `updateSettings` deprecated alias maps to `updateGlobal`
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { GlobalSettings, WorkspaceSettings } from '@/domain'
import { useSettingsService } from '@/services/provider'
import type { ResolvedSettings } from '@/services/SettingsService'

export type { ResolvedSettings } from '@/services/SettingsService'

const DEFAULT_GLOBAL: GlobalSettings = {
  theme: 'system',
  fontSize: 13,
  fontFamily: 'SF Mono, Menlo, Monaco, monospace',
  language: 'en',
}

const DEFAULT_HEADERS: readonly { readonly key: string; readonly value: string }[] = [
  { key: 'User-Agent', value: 'SnagRuntime/1.0.0' },
  { key: 'Accept', value: '*/*' },
  { key: 'Accept-Encoding', value: 'gzip, deflate, br' },
]

function mergeSettings(
  global: GlobalSettings,
  workspace: WorkspaceSettings | null,
): ResolvedSettings {
  return {
    // Global-only fields
    theme: global.theme,
    fontSize: global.fontSize,
    fontFamily: global.fontFamily,
    language: global.language,
    // Workspace-overridable fields (with defaults)
    proxy: workspace?.proxy ?? undefined,
    defaultHeaders: workspace?.defaultHeaders ?? DEFAULT_HEADERS,
    timeout: workspace?.timeout ?? 30,
    followRedirects: workspace?.followRedirects ?? true,
    validateSsl: workspace?.validateSsl ?? true,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const global = ref<GlobalSettings>({ ...DEFAULT_GLOBAL })
  const workspace = ref<WorkspaceSettings | null>(null)
  const resolved = ref<ResolvedSettings>(mergeSettings(DEFAULT_GLOBAL, null))
  const isLoading = ref(false)

  /** Backward-compat: existing components read `settingsStore.settings.*` */
  const settings = computed(() => resolved.value)

  async function load(): Promise<void> {
    const settingsService = useSettingsService()
    isLoading.value = true
    try {
      let loadedGlobal: GlobalSettings
      try {
        loadedGlobal = await settingsService.loadGlobal()
      } catch (err) {
        console.warn('[settingsStore] Failed to load global settings, using defaults:', err)
        loadedGlobal = { ...DEFAULT_GLOBAL }
      }

      let loadedWorkspace: WorkspaceSettings | null
      try {
        loadedWorkspace = await settingsService.loadWorkspace()
      } catch (err) {
        console.warn('[settingsStore] Failed to load workspace settings, using null:', err)
        loadedWorkspace = null
      }

      global.value = loadedGlobal
      workspace.value = loadedWorkspace
      resolved.value = mergeSettings(loadedGlobal, loadedWorkspace)
    } finally {
      isLoading.value = false
    }
  }

  async function updateGlobal(partial: Partial<GlobalSettings>): Promise<void> {
    const settingsService = useSettingsService()
    try {
      const updated = await settingsService.updateGlobal(partial)
      global.value = updated
      resolved.value = mergeSettings(updated, workspace.value)
    } catch (err) {
      console.error('[settingsStore] Failed to update global settings:', err)
    }
  }

  async function updateWorkspace(partial: Partial<WorkspaceSettings>): Promise<void> {
    const settingsService = useSettingsService()
    try {
      const updated = await settingsService.updateWorkspace(partial)
      workspace.value = updated
      resolved.value = mergeSettings(global.value, updated)
    } catch (err) {
      console.error('[settingsStore] Failed to update workspace settings:', err)
    }
  }

  async function resetGlobal(): Promise<void> {
    const settingsService = useSettingsService()
    try {
      const defaults = settingsService.getDefaults()
      await settingsService.saveGlobal(defaults)
      global.value = defaults
      resolved.value = mergeSettings(defaults, workspace.value)
    } catch (err) {
      console.error('[settingsStore] Failed to reset global settings:', err)
    }
  }

  async function reloadWorkspaceSettings(): Promise<void> {
    const settingsService = useSettingsService()
    try {
      const loadedWorkspace = await settingsService.loadWorkspace()
      workspace.value = loadedWorkspace
      resolved.value = mergeSettings(global.value, loadedWorkspace)
    } catch (err) {
      console.warn('[settingsStore] Failed to reload workspace settings:', err)
      workspace.value = null
      resolved.value = mergeSettings(global.value, null)
    }
  }

  /**
   * @deprecated Use `updateGlobal` instead. Kept for backward compat with existing UI.
   */
  function updateSettings(updates: Partial<GlobalSettings>): void {
    updateGlobal(updates)
  }

  return {
    // State
    global,
    workspace,
    resolved,
    isLoading,

    // Backward-compat computed
    settings,

    // Actions
    load,
    updateGlobal,
    updateWorkspace,
    resetGlobal,
    reloadWorkspaceSettings,

    // Deprecated
    updateSettings,
  }
})
