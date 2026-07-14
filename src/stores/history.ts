import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useStorage } from '@/composables/useStorage'
import type { RequestConfig, ResponseData } from '@/types/request'
import type { UUID } from '@/types/common'

const STORAGE_FILE = 'history.json'
const MAX_HISTORY_ITEMS = 100

export interface HistoryEntry {
  id: UUID
  request: RequestConfig
  response: ResponseData | null
  timestamp: string
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const isLoading = ref(false)

  const { read, write } = useStorage()

  async function load() {
    isLoading.value = true
    entries.value = await read<HistoryEntry[]>(STORAGE_FILE, [])
    isLoading.value = false
  }

  async function save() {
    await write(STORAGE_FILE, entries.value)
  }

  function addEntry(request: RequestConfig, response: ResponseData | null) {
    try {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        request: JSON.parse(JSON.stringify(request)),
        response: response ? JSON.parse(JSON.stringify(response)) : null,
        timestamp: new Date().toISOString(),
      }

      entries.value.unshift(entry)

      // Trim to max
      if (entries.value.length > MAX_HISTORY_ITEMS) {
        entries.value = entries.value.slice(0, MAX_HISTORY_ITEMS)
      }

      save()
      return entry
    } catch (error) {
      console.error('[history] Failed to add entry:', error)
      return null
    }
  }

  function removeEntry(id: UUID) {
    entries.value = entries.value.filter((e) => e.id !== id)
    save()
  }

  function clearHistory() {
    entries.value = []
    save()
  }

  return {
    entries,
    isLoading,
    load,
    save,
    addEntry,
    removeEntry,
    clearHistory,
  }
})
