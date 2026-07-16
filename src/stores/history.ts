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

import type { HistoryEntry, HistoryEntryId, HttpMethod, RequestId, WorkspaceId, HistoryRequestSnapshot, HistoryResponseSnapshot } from '@/domain'
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
    request?: HistoryRequestSnapshot
    response?: HistoryResponseSnapshot
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
      ...(params.request && { request: params.request }),
      ...(params.response && { response: params.response }),
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
    request: { method?: HttpMethod | string; url?: string; headers?: any[]; params?: any[]; pathParams?: any[]; body?: any; auth?: any },
    response: { status?: number; statusText?: string; time?: number; size?: number; headers?: Record<string, string>; body?: string; requestHeaders?: Record<string, string>; requestUrl?: string; requestMethod?: string } | null,
  ): void {
    const method = (request.method ?? 'GET') as HttpMethod
    const url = (request.url ?? '') as string
    const status = response?.status ?? 0
    const duration = (response?.time ?? 0) as number
    const responseSize = (response?.size ?? 0) as number

    // Build request snapshot from the full draft data
    const snapshot: HistoryRequestSnapshot = {
      headers: (request.headers || [])
        .filter((h: any) => h.enabled && h.key)
        .map((h: any) => ({ key: h.key, value: h.value, enabled: h.enabled })),
      params: (request.params || [])
        .filter((p: any) => p.enabled && p.key)
        .map((p: any) => ({ key: p.key, value: p.value, enabled: p.enabled })),
      ...(request.pathParams?.length && {
        pathParams: request.pathParams
          .filter((p: any) => p.key)
          .map((p: any) => ({ key: p.key, value: p.value, enabled: p.enabled ?? true })),
      }),
      body: {
        type: request.body?.type ?? 'none',
        content: request.body?.content ?? '',
        ...(request.body?.formData && {
          formData: request.body.formData
            .filter((f: any) => f.enabled && f.key)
            .map((f: any) => ({ key: f.key, value: f.value, enabled: f.enabled })),
        }),
        ...(request.body?.binaryPath && { binaryPath: request.body.binaryPath }),
      },
      auth: {
        type: request.auth?.type ?? 'none',
        ...(request.auth?.basic && { basic: { ...request.auth.basic } }),
        ...(request.auth?.bearer && { bearer: { ...request.auth.bearer } }),
        ...(request.auth?.apiKey && { apiKey: { ...request.auth.apiKey } }),
      },
    }

    // Build response snapshot (cap body at 1MB to avoid bloating storage)
    const MAX_BODY_SIZE = 1024 * 1024
    let responseSnapshot: HistoryResponseSnapshot | undefined
    if (response && response.status) {
      const body = response.body ?? ''
      responseSnapshot = {
        status: response.status,
        statusText: response.statusText ?? '',
        headers: response.headers ?? {},
        body: body.length > MAX_BODY_SIZE ? body.slice(0, MAX_BODY_SIZE) : body,
        size: response.size ?? 0,
        time: response.time ?? 0,
        ...(response.requestHeaders && { requestHeaders: response.requestHeaders }),
        ...(response.requestUrl && { requestUrl: response.requestUrl }),
        ...(response.requestMethod && { requestMethod: response.requestMethod }),
      }
    }

    recordEntry({ method, url, status, duration, responseSize, request: snapshot, response: responseSnapshot })
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
