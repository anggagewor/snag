import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import type {
  RequestId,
  ProtocolType,
  RequestDraft,
  ResponseData,
  WebSocketConfig,
  WebSocketSession,
  GraphQLConfig,
  GraphQLResponseData,
  GrpcConfig,
  GrpcResponseData,
} from '@/domain'
import { requestToDraft, draftToRequest, isDirty } from '@/domain'

export interface Tab {
  readonly id: string
  readonly type: 'request' | 'settings' | 'environments'
  title: string
  protocol: ProtocolType
  /** Reference to the persisted request (lazy-loaded from workspace) */
  requestId?: RequestId
  /** Runtime editing state — mutable working copy of the domain Request */
  requestDraft?: RequestDraft
  /** Response from last send (runtime only, not persisted) */
  response?: ResponseData | null
  /** WebSocket config (future protocol support) */
  websocket?: WebSocketConfig
  websocketSession?: WebSocketSession | null
  /** GraphQL config (future protocol support) */
  graphql?: GraphQLConfig
  graphqlResponse?: GraphQLResponseData | null
  /** gRPC config (future protocol support) */
  grpc?: GrpcConfig
  grpcResponse?: GrpcResponseData | null
  isDirty: boolean
  isError?: boolean
  errorMessage?: string
  /** Links this tab to a collection item (collectionId:itemId) */
  sourceId?: string
  /** Collection-level variables (resolved from source collection) */
  collectionVariables?: { key: string; value: string }[]
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)
  const isLoaded = ref(true)

  /** Private snapshot storage: tabId → snapshot of RequestDraft at load/save time */
  const snapshots = new Map<string, RequestDraft>()

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)
  const tabCount = computed(() => tabs.value.length)

  /**
   * Open a request tab by requestId + sourceId.
   * Deduplicates by sourceId — if a tab with the same sourceId exists, activates it.
   * The requestDraft starts as undefined (lazy — call loadTabDraft to populate).
   */
  function openRequestTab(requestId?: RequestId, sourceId?: string, title?: string): Tab {
    // Check if tab with same sourceId is already open
    if (sourceId) {
      const existing = tabs.value.find((t) => t.sourceId === sourceId)
      if (existing) {
        activeTabId.value = existing.id
        return existing
      }
    }

    // Resolve collection variables from source
    let collectionVariables: { key: string; value: string }[] | undefined
    if (sourceId) {
      const [collectionId] = sourceId.split(':')
      const workspaceStore = useWorkspaceStore()
      const collection = workspaceStore.collections.find((c) => c.id === collectionId)
      if (collection?.variables && collection.variables.length > 0) {
        collectionVariables = collection.variables.map(v => ({ key: v.key, value: v.value }))
      }
    }

    const tab: Tab = {
      id: crypto.randomUUID(),
      type: 'request',
      title: title || 'Untitled Request',
      protocol: 'rest',
      requestId,
      requestDraft: requestId ? undefined : {
        name: title || 'Untitled Request',
        protocol: 'rest',
        method: 'GET',
        url: '',
        headers: [],
        params: [],
        body: { type: 'none', content: '' },
        auth: { type: 'none' },
        preRequest: '',
        tests: '',
      },
      response: null,
      isDirty: false,
      sourceId,
      collectionVariables,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  /**
   * Lazy-load the request draft for a tab.
   * Loads the domain Request from workspaceStore, converts to RequestDraft,
   * and stores a snapshot for dirty detection.
   */
  async function loadTabDraft(tabId: string): Promise<void> {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || !tab.requestId) return

    const workspaceStore = useWorkspaceStore()
    try {
      const request = await workspaceStore.getRequest(tab.requestId)
      const draft = requestToDraft(request)
      tab.requestDraft = draft
      tab.protocol = request.protocol
      tab.isError = false
      tab.errorMessage = undefined

      // Store snapshot (deep clone via requestToDraft of the same request)
      const snapshot = requestToDraft(request)
      snapshots.set(tabId, snapshot)
    } catch (err) {
      tab.isError = true
      tab.errorMessage = 'Request not found'
      console.error(`[TabsStore] Failed to load request for tab ${tabId}:`, err)
    }
  }

  /**
   * Save a tab's draft back to disk.
   * Converts RequestDraft → domain Request via draftToRequest(),
   * persists via workspaceStore.saveRequest(), updates snapshot, marks clean.
   */
  async function saveTab(tabId: string): Promise<boolean> {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || !tab.requestDraft || !tab.requestId) return false
    if (!tab.isDirty) return true // nothing to save

    const workspaceStore = useWorkspaceStore()
    try {
      // Get the original request for its meta (createdAt)
      const original = await workspaceStore.getRequest(tab.requestId)
      const request = draftToRequest(tab.requestDraft, tab.requestId, original.meta)

      // Also update the name from tab title
      const namedRequest = { ...request, name: tab.title }
      await workspaceStore.saveRequest(namedRequest)

      // Update snapshot and mark clean
      const newSnapshot = requestToDraft(namedRequest)
      snapshots.set(tabId, newSnapshot)
      tab.isDirty = false
      return true
    } catch (err) {
      console.error(`[TabsStore] Failed to save tab ${tabId}:`, err)
      return false
    }
  }

  /**
   * Recompute dirty state for a tab by comparing current draft to snapshot.
   */
  function recomputeDirty(tabId: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || !tab.requestDraft) return

    const snapshot = snapshots.get(tabId)
    if (!snapshot) {
      // No snapshot means tab hasn't been loaded yet — not dirty
      tab.isDirty = false
      return
    }
    tab.isDirty = isDirty(tab.requestDraft, snapshot)
  }

  function openSettingsTab() {
    const existing = tabs.value.find((t) => t.type === 'settings')
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const tab: Tab = {
      id: crypto.randomUUID(),
      type: 'settings',
      title: 'Settings',
      protocol: 'rest',
      isDirty: false,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function openEnvironmentsTab() {
    const existing = tabs.value.find((t) => t.type === 'environments')
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const tab: Tab = {
      id: crypto.randomUUID(),
      type: 'environments',
      title: 'Environments',
      protocol: 'rest',
      isDirty: false,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function setActiveTab(id: string) {
    activeTabId.value = id
  }

  /** Pending tab ID awaiting close confirmation (dirty tab) */
  const pendingCloseTabId = ref<string | null>(null)

  function closeTab(id: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.isDirty) {
      pendingCloseTabId.value = id
      return
    }
    forceCloseTab(id)
  }

  function forceCloseTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return

    pendingCloseTabId.value = null
    tabs.value.splice(index, 1)
    snapshots.delete(id)

    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
      } else {
        activeTabId.value = null
      }
    }
  }

  function cancelCloseTab() {
    pendingCloseTabId.value = null
  }

  function updateTabResponse(id: string, response: ResponseData | null) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.response = response
    }
  }

  function updateTabTitle(id: string, title: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.title = title
      if (tab.requestDraft) {
        tab.requestDraft.name = title
        recomputeDirty(id)
      }
    }
  }

  function markTabClean(id: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.isDirty = false
      // Update snapshot to current draft state
      if (tab.requestDraft) {
        snapshots.set(id, JSON.parse(JSON.stringify(tab.requestDraft)))
      }
    }
  }

  function linkTabToSource(id: string, sourceId: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.sourceId = sourceId
      tab.isDirty = false
    }
  }

  /**
   * Clear all tabs (used during workspace switch).
   */
  function clearAllTabs() {
    tabs.value = []
    activeTabId.value = null
    snapshots.clear()
  }

  /**
   * No-op load — tabs are now transient references, not persisted to a flat file.
   * Kept for backward compatibility with App.vue startup sequence.
   */
  async function load(): Promise<void> {
    isLoaded.value = true
  }

  /**
   * @deprecated Use direct draft mutation + recomputeDirty() instead.
   * Kept temporarily for UI consumers until task 2.3 migrates them.
   */
  function updateTabRequest(id: string, _request: Record<string, unknown>) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.requestDraft) {
      // Apply partial updates to the draft
      const partial = _request as Record<string, unknown>

      if ('method' in partial) tab.requestDraft.method = partial.method as any
      if ('url' in partial) tab.requestDraft.url = partial.url as string
      if ('headers' in partial) tab.requestDraft.headers = partial.headers as any
      if ('params' in partial) tab.requestDraft.params = partial.params as any
      if ('body' in partial) tab.requestDraft.body = partial.body as any
      if ('auth' in partial) tab.requestDraft.auth = partial.auth as any
      if ('preRequest' in partial) tab.requestDraft.preRequest = partial.preRequest as string
      if ('tests' in partial) tab.requestDraft.tests = partial.tests as string
      if ('name' in partial) tab.requestDraft.name = partial.name as string

      recomputeDirty(id)
    }
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    tabCount,
    isLoaded,
    pendingCloseTabId,
    load,
    openRequestTab,
    loadTabDraft,
    saveTab,
    recomputeDirty,
    openSettingsTab,
    openEnvironmentsTab,
    setActiveTab,
    closeTab,
    forceCloseTab,
    cancelCloseTab,
    updateTabRequest,
    updateTabResponse,
    updateTabTitle,
    markTabClean,
    linkTabToSource,
    clearAllTabs,
  }
})
