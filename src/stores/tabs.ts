import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { useCollectionsStore } from '@/stores/collections'
import type { UUID } from '@/types/common'
import type { CollectionItem } from '@/types/collection'
import type { RequestConfig, ResponseData } from '@/types/request'
import { createEmptyRequest } from '@/types/request'

export interface Tab {
  id: UUID
  type: 'request' | 'settings' | 'environments'
  title: string
  request?: RequestConfig
  response?: ResponseData | null
  isDirty: boolean
  /** Links this tab to a collection item (collectionId:itemId) */
  sourceId?: string
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<UUID | null>(null)

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value) || null)
  const tabCount = computed(() => tabs.value.length)

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

    const req = request || createEmptyRequest()
    const tab: Tab = {
      id: crypto.randomUUID(),
      type: 'request',
      title: title || 'Untitled Request',
      request: req,
      response: null,
      isDirty: false,
      sourceId,
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
      isDirty: false,
    }
    tabs.value.push(tab)
    activeTabId.value = tab.id
    return tab
  }

  function setActiveTab(id: UUID) {
    activeTabId.value = id
  }

  function closeTab(id: UUID) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return

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

  /**
   * Save current tab back to its source collection item.
   * Also syncs title.
   */
  function saveTab(id: UUID) {
    const tab = tabs.value.find((t) => t.id === id)
    if (!tab || !tab.request || !tab.sourceId) return false

    const [collectionId, itemId] = tab.sourceId.split(':')
    if (!collectionId || !itemId) return false

    const collectionsStore = useCollectionsStore()
    const collection = collectionsStore.collections.find((c) => c.id === collectionId)
    if (!collection) return false

    // Find and update the item in collection
    function updateItem(items: CollectionItem[]): boolean {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === itemId) {
          items[i].name = tab!.title
          items[i].request = JSON.parse(JSON.stringify(tab!.request))
          return true
        }
        if (items[i].items && updateItem(items[i].items!)) {
          return true
        }
      }
      return false
    }

    const updated = updateItem(collection.items)
    if (updated) {
      collection.updatedAt = new Date().toISOString()
      collectionsStore.save()
      tab.isDirty = false
      return true
    }
    return false
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    tabCount,
    openRequestTab,
    openSettingsTab,
    openEnvironmentsTab,
    setActiveTab,
    closeTab,
    updateTabRequest,
    updateTabResponse,
    updateTabTitle,
    markTabClean,
    saveTab,
  }
})
