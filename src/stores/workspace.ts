/**
 * Workspace Store — bridge between WorkspaceService and UI.
 *
 * Owns: active workspace state, collections, requests (cache),
 * environments for the active workspace.
 *
 * All data access goes through WorkspaceService.
 * UI reads reactive state from this store.
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'

import type {
  CollectionId,
  RequestId,
  EnvironmentId,
  FolderId,
  Workspace,
  WorkspaceEntry,
  Collection,
  TreeNode,
  Request,
  Environment,
} from '@/domain'
import type { WorkspaceHealth } from '@/services/WorkspaceService'
import {
  useWorkspaceService,
  useRegistryService,
} from '@/services/provider'

export const useWorkspaceStore = defineStore('workspace', () => {
  // ─── State ─────────────────────────────────────────────────────

  const workspace = ref<Workspace | null>(null)
  const collections = ref<Collection[]>([])
  const environments = ref<Environment[]>([])
  const activeEnvironmentId = ref<EnvironmentId | null>(null)
  const recentWorkspaces = ref<WorkspaceEntry[]>([])
  const health = ref<WorkspaceHealth | null>(null)

  /** Cache of loaded requests (lazy-loaded on demand) */
  const requestCache = shallowRef<Map<RequestId, Request>>(new Map())

  const isLoading = ref(false)
  const isReady = ref(false)

  // ─── Getters ───────────────────────────────────────────────────

  const isWorkspaceOpen = computed(() => workspace.value !== null)
  const workspaceName = computed(() => workspace.value?.name ?? '')
  const workspaceId = computed(() => workspace.value?.id ?? null)

  const activeEnvironment = computed(() =>
    environments.value.find(e => e.id === activeEnvironmentId.value) ?? null
  )

  const resolvedVariables = computed(() => {
    const vars: Record<string, string> = {}
    const env = activeEnvironment.value
    if (env) {
      for (const v of env.variables) {
        if (v.enabled) vars[v.key] = v.value
      }
    }
    return vars
  })

  const isHealthy = computed(() => health.value?.isHealthy ?? true)

  // ─── Workspace Lifecycle ───────────────────────────────────────

  async function loadRecentWorkspaces(): Promise<void> {
    const registry = useRegistryService()
    recentWorkspaces.value = await registry.listWorkspaces()
  }

  async function openWorkspace(path: string): Promise<void> {
    isLoading.value = true
    try {
      const service = useWorkspaceService()
      const registry = useRegistryService()

      workspace.value = await service.openWorkspace(path)

      // Register / update in registry
      await registry.registerWorkspace({
        id: workspace.value.id,
        name: workspace.value.name,
        path,
        lastOpenedAt: workspace.value.lastOpenedAt,
      })

      // Load collections and environments
      collections.value = await service.listCollections()
      environments.value = await service.listEnvironments()
      activeEnvironmentId.value = workspace.value.defaultEnvironment

      // Clear request cache
      requestCache.value = new Map()

      // Check health async (non-blocking)
      checkHealth()

      isReady.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function createWorkspace(name: string, path: string): Promise<void> {
    isLoading.value = true
    try {
      const service = useWorkspaceService()
      const registry = useRegistryService()

      workspace.value = await service.createWorkspace(name, path)

      await registry.registerWorkspace({
        id: workspace.value.id,
        name: workspace.value.name,
        path,
        lastOpenedAt: workspace.value.lastOpenedAt,
      })

      collections.value = []
      environments.value = []
      activeEnvironmentId.value = null
      requestCache.value = new Map()
      health.value = { isHealthy: true, orphanedRequests: [], missingRequests: [] }

      isReady.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function closeWorkspace(): Promise<void> {
    const service = useWorkspaceService()
    await service.closeWorkspace()

    workspace.value = null
    collections.value = []
    environments.value = []
    activeEnvironmentId.value = null
    requestCache.value = new Map()
    health.value = null
    isReady.value = false
  }

  async function switchWorkspace(path: string): Promise<void> {
    isLoading.value = true
    try {
      // 1. Close current workspace
      await closeWorkspace()

      // 2. Clear all tabs
      const { useTabsStore } = await import('@/stores/tabs')
      const tabsStore = useTabsStore()
      tabsStore.clearAllTabs()

      // 3. Open new workspace
      await openWorkspace(path)

      // 4. Reload workspace settings
      const { useSettingsStore } = await import('@/stores/settings')
      const settingsStore = useSettingsStore()
      await settingsStore.reloadWorkspaceSettings()
    } catch (err) {
      console.error('[workspaceStore] Workspace switch failed:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ─── Collections ───────────────────────────────────────────────

  async function createCollection(name: string): Promise<Collection> {
    const service = useWorkspaceService()
    const collection = await service.createCollection(name)
    collections.value = [...collections.value, collection]
    workspace.value = service.getActiveWorkspace()
    return collection
  }

  async function deleteCollection(id: CollectionId): Promise<void> {
    const service = useWorkspaceService()
    await service.deleteCollection(id)
    collections.value = collections.value.filter(c => c.id !== id)
    workspace.value = service.getActiveWorkspace()
  }

  async function renameCollection(id: CollectionId, name: string): Promise<void> {
    const service = useWorkspaceService()
    const updated = await service.renameCollection(id, name)
    collections.value = collections.value.map(c => c.id === id ? updated : c)
  }

  async function reloadCollection(id: CollectionId): Promise<void> {
    const service = useWorkspaceService()
    const updated = await service.getCollection(id)
    collections.value = collections.value.map(c => c.id === id ? updated : c)
  }

  async function saveCollectionTree(id: CollectionId, items: TreeNode[]): Promise<void> {
    const service = useWorkspaceService()
    const collection = await service.getCollection(id)
    await service.saveCollection({ ...collection, items })
    collections.value = collections.value.map(c => c.id === id ? { ...collection, items } : c)
  }

  // ─── Tree Operations ───────────────────────────────────────────

  async function addFolder(collectionId: CollectionId, parentFolderId: FolderId | null, name: string): Promise<void> {
    const service = useWorkspaceService()
    const updated = await service.addFolder(collectionId, parentFolderId, name)
    collections.value = collections.value.map(c => c.id === collectionId ? updated : c)
  }

  async function removeFolder(collectionId: CollectionId, folderId: FolderId): Promise<void> {
    const service = useWorkspaceService()
    const updated = await service.removeFolder(collectionId, folderId)
    collections.value = collections.value.map(c => c.id === collectionId ? updated : c)
  }

  async function renameFolder(collectionId: CollectionId, folderId: FolderId, name: string): Promise<void> {
    const service = useWorkspaceService()
    const updated = await service.renameFolder(collectionId, folderId, name)
    collections.value = collections.value.map(c => c.id === collectionId ? updated : c)
  }

  async function moveItem(collectionId: CollectionId, itemId: RequestId | FolderId, targetParentId: FolderId | null, index: number): Promise<void> {
    const service = useWorkspaceService()
    const updated = await service.moveItem(collectionId, itemId, targetParentId, index)
    collections.value = collections.value.map(c => c.id === collectionId ? updated : c)
  }

  // ─── Requests ──────────────────────────────────────────────────

  async function getRequest(id: RequestId): Promise<Request> {
    // Check cache first
    const cached = requestCache.value.get(id)
    if (cached) return cached

    const service = useWorkspaceService()
    const request = await service.getRequest(id)

    // Update cache
    const newCache = new Map(requestCache.value)
    newCache.set(id, request)
    requestCache.value = newCache

    return request
  }

  async function saveRequest(request: Request): Promise<void> {
    const service = useWorkspaceService()
    await service.saveRequest(request)

    // Update cache
    const newCache = new Map(requestCache.value)
    newCache.set(request.id, request)
    requestCache.value = newCache
  }

  async function createRequest(
    collectionId: CollectionId,
    folderId: FolderId | null,
    defaults?: Partial<Pick<Request, 'name' | 'method' | 'protocol'>>,
  ): Promise<Request> {
    const service = useWorkspaceService()
    const request = await service.createRequest(collectionId, folderId, defaults)

    // Update cache
    const newCache = new Map(requestCache.value)
    newCache.set(request.id, request)
    requestCache.value = newCache

    // Reload collection tree
    await reloadCollection(collectionId)

    return request
  }

  async function deleteRequest(id: RequestId): Promise<void> {
    const service = useWorkspaceService()
    await service.deleteRequest(id)

    // Remove from cache
    const newCache = new Map(requestCache.value)
    newCache.delete(id)
    requestCache.value = newCache

    // Reload all collections (request ref might have been in any)
    const ws = useWorkspaceService()
    collections.value = await ws.listCollections()
  }

  async function duplicateRequest(id: RequestId): Promise<Request> {
    const service = useWorkspaceService()
    const duplicate = await service.duplicateRequest(id)

    const newCache = new Map(requestCache.value)
    newCache.set(duplicate.id, duplicate)
    requestCache.value = newCache

    return duplicate
  }

  async function moveRequest(
    requestId: RequestId,
    fromCollectionId: CollectionId,
    toCollectionId: CollectionId,
    toFolderId: FolderId | null,
    index?: number,
  ): Promise<void> {
    const service = useWorkspaceService()
    await service.moveRequest(requestId, fromCollectionId, toCollectionId, toFolderId, index)

    // Reload affected collections
    await reloadCollection(fromCollectionId)
    if (fromCollectionId !== toCollectionId) {
      await reloadCollection(toCollectionId)
    }
  }

  // ─── Environments ──────────────────────────────────────────────

  async function createEnvironment(name: string): Promise<Environment> {
    const service = useWorkspaceService()
    const env = await service.createEnvironment(name)
    environments.value = [...environments.value, env]
    return env
  }

  async function saveEnvironment(env: Environment): Promise<void> {
    const service = useWorkspaceService()
    await service.saveEnvironment(env)
    environments.value = environments.value.map(e => e.id === env.id ? env : e)
  }

  async function deleteEnvironment(id: EnvironmentId): Promise<void> {
    const service = useWorkspaceService()
    await service.deleteEnvironment(id)
    environments.value = environments.value.filter(e => e.id !== id)
    if (activeEnvironmentId.value === id) {
      activeEnvironmentId.value = null
    }
    workspace.value = service.getActiveWorkspace()
  }

  async function setActiveEnvironment(id: EnvironmentId | null): Promise<void> {
    const service = useWorkspaceService()
    await service.setDefaultEnvironment(id)
    activeEnvironmentId.value = id
    workspace.value = service.getActiveWorkspace()
  }

  function resolveVariablesInString(str: string, collectionVariables?: { key: string; value: string }[]): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (collectionVariables) {
        const cv = collectionVariables.find(v => v.key === key)
        if (cv) return cv.value
      }
      return resolvedVariables.value[key] ?? `{{${key}}}`
    })
  }

  // ─── Health ────────────────────────────────────────────────────

  async function checkHealth(): Promise<void> {
    try {
      const service = useWorkspaceService()
      health.value = await service.checkHealth()
    } catch {
      // Non-critical, ignore
    }
  }

  async function recoverOrphans(requestIds: RequestId[], targetCollectionId: CollectionId, folderId?: FolderId): Promise<void> {
    const service = useWorkspaceService()
    await service.recoverOrphans(requestIds, targetCollectionId, folderId)
    await reloadCollection(targetCollectionId)
    await checkHealth()
  }

  // ─── Return ────────────────────────────────────────────────────

  return {
    // State
    workspace,
    collections,
    environments,
    activeEnvironmentId,
    recentWorkspaces,
    health,
    isLoading,
    isReady,

    // Getters
    isWorkspaceOpen,
    workspaceName,
    workspaceId,
    activeEnvironment,
    resolvedVariables,
    isHealthy,

    // Workspace lifecycle
    loadRecentWorkspaces,
    openWorkspace,
    createWorkspace,
    closeWorkspace,
    switchWorkspace,

    // Collections
    createCollection,
    deleteCollection,
    renameCollection,
    reloadCollection,
    saveCollectionTree,

    // Tree
    addFolder,
    removeFolder,
    renameFolder,
    moveItem,

    // Requests
    getRequest,
    saveRequest,
    createRequest,
    deleteRequest,
    duplicateRequest,
    moveRequest,

    // Environments
    createEnvironment,
    saveEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    resolveVariablesInString,

    // Health
    checkHealth,
    recoverOrphans,
  }
})
