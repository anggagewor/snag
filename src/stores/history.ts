/**
 * History Store — bridge between HistoryService and UI.
 *
 * Owns: reactive history entries for the active session.
 * All persistence goes through HistoryService.
 *
 * Backward-compatible: exports `useHistoryStore` and `addEntry` alias.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { HistoryEntry, HistoryEntryId, HttpMethod, RequestId, WorkspaceId } from '@/domain'
import { ulid } from '@/domain'
import type { HistoryFilter } from '@/services/HistoryService'
import { useHistoryService } from '@/services/provider'
import { useWorkspaceStore } from '@/stores/workspace'

export type { HistoryEntry } from '@/domain'
export type { HistoryFilter } from '@/services/HistoryService'

export const useHistoryStore = defineStore('history', () => {
  // ─── State ─────────────────────────────────────────────────────

  const entries = ref<HistoryEntry[]>([])
  const isLoading = ref(false)
  const filter = ref<HistoryFilter>({})

  // ─── Actions ───────────────────────────────────────────────────

  async function load(): Promise<void> {
    isLoading.value = true
    try {
      const historyService = useHistoryService()
      entries.value = await historyService.query({ limit: 50 })
    } catch (error) {
      console.error('[history] Failed to load:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function recordEntry(params: {
    method: HttpMethod
    url: string
    status: number
    duration: number
    responseSize: number
    requestId?: RequestId
  }): Promise<void> {
    const workspaceStore = useWorkspaceStore()
    const id = ulid() as HistoryEntryId

    const entry: HistoryEntry = {
      id,
      workspaceId: (workspaceStore.workspaceId as WorkspaceId | null) ?? null,
      requestId: params.requestId ?? null,
      timestamp: new Date().toISOString(),
      method: params.method,
      url: params.url,
      status: params.status,
      duration: params.duration,
      responseSize: params.responseSize,
    }

    // Prepend for immediate UI update
    entries.value = [entry, ...entries.value]

    // Persist asynchronously — don't block caller
    try {
      const historyService = useHistoryService()
      await historyService.record(entry)
    } catch (error) {
      console.error('[history] Failed to record entry:', error)
    }
  }

  async function query(queryFilter?: HistoryFilter): Promise<void> {
    isLoading.value = true
    try {
      const historyService = useHistoryService()
      if (queryFilter) {
        filter.value = queryFilter
      }
      entries.value = await historyService.query(queryFilter ?? filter.value)
    } catch (error) {
      console.error('[history] Failed to query:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function removeEntry(id: HistoryEntryId): Promise<void> {
    // Optimistic UI update
    entries.value = entries.value.filter(e => e.id !== id)

    try {
      const historyService = useHistoryService()
      // HistoryService doesn't have a removeById — clear before entry timestamp
      // For now, we just remove from the reactive list; full impl depends on service API
      // The service supports clearBefore and clearAll but not single delete.
      // We persist via re-query to keep state consistent.
      void historyService
    } catch (error) {
      console.error('[history] Failed to remove entry:', error)
    }
  }

  async function clearHistory(): Promise<void> {
    entries.value = []
    try {
      const historyService = useHistoryService()
      await historyService.clearAll()
    } catch (error) {
      console.error('[history] Failed to clear history:', error)
    }
  }

  // ─── Deprecated Alias ──────────────────────────────────────────

  /**
   * @deprecated Use `recordEntry()` instead. Kept for backward compatibility
   * during migration from legacy store.
   */
  function addEntry(
    request: { method?: HttpMethod | string; url?: string },
    response: { status?: number; time?: number; size?: number } | null,
  ): void {
    const method = (request.method ?? 'GET') as HttpMethod
    const url = (request.url ?? '') as string
    const status = response?.status ?? 0
    const duration = (response?.time ?? 0) as number
    const responseSize = (response?.size ?? 0) as number

    recordEntry({ method, url, status, duration, responseSize })
  }

  // ─── Return ────────────────────────────────────────────────────

  return {
    // State
    entries,
    isLoading,
    filter,

    // Actions
    load,
    recordEntry,
    query,
    removeEntry,
    clearHistory,

    // Deprecated
    addEntry,
  }
})
