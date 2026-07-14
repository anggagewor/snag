import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useStorage } from '@/composables/useStorage'
import type { ThemeMode } from '@/types/common'

const STORAGE_FILE = 'settings.json'

export interface DefaultHeader {
  key: string
  value: string
  enabled: boolean
}

export interface AppSettings {
  theme: ThemeMode
  defaultMethod: string
  followRedirects: boolean
  timeout: number // seconds
  maxHistoryItems: number
  sidebarWidth: number
  defaultHeaders: DefaultHeader[]
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultMethod: 'GET',
  followRedirects: true,
  timeout: 30,
  maxHistoryItems: 100,
  sidebarWidth: 280,
  defaultHeaders: [
    { key: 'User-Agent', value: 'SnagRuntime/1.0.0', enabled: true },
    { key: 'Accept', value: '*/*', enabled: true },
    { key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true },
  ],
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const isLoading = ref(false)

  const { read, write } = useStorage()

  async function load() {
    isLoading.value = true
    const stored = await read<AppSettings>(STORAGE_FILE, DEFAULT_SETTINGS)
    settings.value = { ...DEFAULT_SETTINGS, ...stored }
    isLoading.value = false
  }

  async function save() {
    await write(STORAGE_FILE, settings.value)
  }

  function updateSettings(updates: Partial<AppSettings>) {
    Object.assign(settings.value, updates)
    save()
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    save()
  }

  return {
    settings,
    isLoading,
    load,
    save,
    updateSettings,
    resetSettings,
  }
})
