import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { useStorage } from '@/composables/useStorage'
import { debounce } from '@/utils/debounce'
import type { UUID } from '@/types/common'
import { ProtocolType } from '@/types/common'
import type { RequestConfig, ResponseData } from '@/types/request'
import type { WebSocketConfig, WebSocketSession } from '@/types/websocket'
import type { GraphQLConfig, GraphQLResponseData } from '@/types/graphql'
import type { GrpcConfig, GrpcResponseData } from '@/types/grpc'
import { createEmptyRequest } from '@/types/request'

const STORAGE_FILE = 'tabs.json'

export interface Tab {
  id: UUID
  type: 'request' | 'settings' | 'environments'
  title: string
  /** Protocol type — defaults to REST */
  protocol: ProtocolType
  request?: RequestConfig
  response?: ResponseData | null
  websocket?: WebSocketConfig
  websocketSession?: WebSocketSession | null
  graphql?: GraphQLConfig
  graphqlResponse?: GraphQLResponseData | null
  grpc?: GrpcConfig
  grpcResponse?: GrpcResponseData | null
  isDirty: boolean
  /** Links this tab to a collection item (collectionId:itemId) */
  sourceId?: string
  /** Collection-level variables (resolved from source collection) */
  collectionVariables?: { key: string; value: string }[]
}

interface TabsSnapshot {
  tabs: Tab[]
  activeTabId: UUID | null
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<UUID | null>(null)
  const isLoaded = ref(false)

  const { read, write } = useStorage()

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)
  const tabCount = computed(() => tabs.value.length)

  async function persist() {
    const snapshot: TabsSnapshot = {
      tabs: tabs.value.map((t) => ({
        ...t,
        // Don't persist response data (can be large, stale)
        response: null,
      })),
      activeTabId: activeTabId.value,
    }
    await write(STORAGE_FILE, snapshot)
  }

  const save = debounce(persist, 500)

  async function load() {
    const data = await read<TabsSnapshot>(STORAGE_FILE, { tabs: [], activeTabId: null })
    // Backward compat: ensure all tabs have protocol field
    tabs.value = data.tabs.map((t) => ({
      ...t,
      protocol: t.protocol || ProtocolType.REST,
    }))
    activeTabId.value = data.activeTabId
    isLoaded.value = true
  }

  // Auto-persist on tab changes
  watch([tabs, activeTabId], () => {
    if (isLoaded.value) save()
  }, { deep: true })

  /**
   * Open a request tab. If sourceId is provided and a tab with the same sourceId
   * already exists, activate that tab instead of creating a new one.
   */
  function openRequestTab(request?: RequestConfig, title?: string, sourceId?: string) {
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

    const req = request || createEmptyRequest()
    const tab: Tab = {
      id: crypto.randomUUID(),
      type: 'request',
      title: title || 'Untitled Request',
      protocol: ProtocolType.REST,
      request: req,
      response: null,
      isDirty: false,
      sourceId,
      collectionVariables,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
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
      protocol: ProtocolType.REST,
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
      protocol: ProtocolType.REST,
      isDirty: false,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function setActiveTab(id: UUID) {
    activeTabId.value = id
  }

  /** Pending tab ID awaiting close confirmation (dirty tab) */
  const pendingCloseTabId = ref<UUID | null>(null)

  function closeTab(id: UUID) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.isDirty) {
      pendingCloseTabId.value = id
      return
    }
    forceCloseTab(id)
  }

  function forceCloseTab(id: UUID) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return

    pendingCloseTabId.value = null
    tabs.value.splice(index, 1)

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

  function updateTabRequest(id: UUID, request: Partial<RequestConfig>) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.request) {
      Object.assign(tab.request, request)
      tab.isDirty = true
    }
  }

  function updateTabResponse(id: UUID, response: ResponseData | null) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.response = response
    }
  }

  function updateTabTitle(id: UUID, title: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.title = title
      tab.isDirty = true
    }
  }

  function markTabClean(id: UUID) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.isDirty = false
    }
  }

  function linkTabToSource(id: UUID, sourceId: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.sourceId = sourceId
      tab.isDirty = false
    }
  }

  /**
   * Save current tab back to its source.
   * NOTE: Actual persistence is handled by TabBar via workspaceStore.
   * This function now only marks the tab as clean for backward compat.
   */
  function saveTab(id: UUID) {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab || !tab.request || !tab.sourceId) return false
    tab.isDirty = false
    return true
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
    saveTab,
  }
})
