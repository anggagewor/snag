/**
 * WorkspaceService implementation.
 *
 * Orchestrates all workspace operations: lifecycle, collections,
 * requests, environments, tree manipulation, health, import/export.
 */

import type {
  WorkspaceId,
  CollectionId,
  RequestId,
  EnvironmentId,
  FolderId,
  Workspace,
  Collection,
  Request,
  Environment,
  TreeNode,
  Folder,
  RequestRef,
} from '../domain'
import { ulid } from '../domain'
import type { StorageAdapter } from '../storage'
import type { WorkspaceFile, CollectionFile, RequestFile, EnvironmentFile } from '../storage/models'
import {
  workspaceFromFile,
  workspaceToFile,
  collectionFromFile,
  collectionToFile,
  requestFromFile,
  requestToFile,
  environmentFromFile,
  environmentToFile,
} from '../storage'
import { setWorkspaceRoot, getWorkspaceRoot } from '../storage/TauriStorageAdapter'
import type {
  WorkspaceService,
  OrphanedRequest,
  WorkspaceHealth,
  ImportSource,
  ImportPreview,
  ExportFormat,
} from './WorkspaceService'

const WORKSPACE_MANIFEST = 'workspace.json'
const COLLECTIONS_DIR = 'collections'
const REQUESTS_DIR = 'requests'
const ENVIRONMENTS_DIR = 'environments'

export function createWorkspaceService(storage: StorageAdapter): WorkspaceService {
  let activeWorkspace: Workspace | null = null

  // ─── Helpers ─────────────────────────────────────────────────

  function requireWorkspace(): Workspace {
    if (!activeWorkspace) {
      throw new Error('No workspace is currently open.')
    }
    return activeWorkspace
  }

  function collectionPath(id: CollectionId): string {
    return storage.workspacePath(COLLECTIONS_DIR, `${id}.collection.json`)
  }

  function requestPath(id: RequestId): string {
    return storage.workspacePath(REQUESTS_DIR, `${id}.request.json`)
  }

  function environmentPath(id: EnvironmentId): string {
    return storage.workspacePath(ENVIRONMENTS_DIR, `${id}.environment.json`)
  }

  function now(): string {
    return new Date().toISOString()
  }

  function generateId<T extends string>(): T {
    return ulid() as T
  }

  function collectRequestIds(nodes: readonly TreeNode[]): RequestId[] {
    const ids: RequestId[] = []
    for (const node of nodes) {
      if (node.type === 'request') {
        ids.push(node.requestId)
      } else {
        ids.push(...collectRequestIds(node.children))
      }
    }
    return ids
  }

  function removeFromTree(nodes: readonly TreeNode[], targetId: RequestId | FolderId): TreeNode[] {
    const result: TreeNode[] = []
    for (const node of nodes) {
      if (node.type === 'request' && node.requestId === targetId) continue
      if (node.type === 'folder' && node.id === targetId) continue
      if (node.type === 'folder') {
        result.push({ ...node, children: removeFromTree(node.children, targetId) })
      } else {
        result.push(node)
      }
    }
    return result
  }

  function insertIntoTree(
    nodes: readonly TreeNode[],
    parentId: FolderId | null,
    item: TreeNode,
    index: number,
  ): TreeNode[] {
    if (parentId === null) {
      const result = [...nodes]
      result.splice(index, 0, item)
      return result
    }

    return nodes.map(node => {
      if (node.type === 'folder' && node.id === parentId) {
        const children = [...node.children]
        children.splice(index, 0, item)
        return { ...node, children }
      }
      if (node.type === 'folder') {
        return { ...node, children: insertIntoTree(node.children, parentId, item, index) }
      }
      return node
    })
  }

  function updateFolderInTree(nodes: readonly TreeNode[], folderId: FolderId, update: Partial<Folder>): TreeNode[] {
    return nodes.map(node => {
      if (node.type === 'folder' && node.id === folderId) {
        return { ...node, ...update }
      }
      if (node.type === 'folder') {
        return { ...node, children: updateFolderInTree(node.children, folderId, update) }
      }
      return node
    })
  }

  // ─── Interface Implementation ────────────────────────────────

  return {
    // ─── Workspace Lifecycle ───────────────────────────────────

    async openWorkspace(path: string): Promise<Workspace> {
      setWorkspaceRoot(path)

      const manifestPath = storage.workspacePath(WORKSPACE_MANIFEST)
      const file = await storage.readJson<WorkspaceFile>(manifestPath)
      const workspace = workspaceFromFile(file)

      // Update lastOpenedAt
      activeWorkspace = { ...workspace, lastOpenedAt: now() }
      await storage.writeJson(manifestPath, workspaceToFile(activeWorkspace))

      return activeWorkspace
    },

    async closeWorkspace(): Promise<void> {
      activeWorkspace = null
      setWorkspaceRoot(null)
    },

    async createWorkspace(name: string, path: string): Promise<Workspace> {
      setWorkspaceRoot(path)

      // Create directory structure
      await storage.ensureDir(storage.workspacePath(COLLECTIONS_DIR))
      await storage.ensureDir(storage.workspacePath(REQUESTS_DIR))
      await storage.ensureDir(storage.workspacePath(ENVIRONMENTS_DIR))

      const workspace: Workspace = {
        id: generateId<WorkspaceId>(),
        name,
        createdAt: now(),
        lastOpenedAt: now(),
        defaultEnvironment: null,
        collections: [],
      }

      const manifestPath = storage.workspacePath(WORKSPACE_MANIFEST)
      await storage.writeJson(manifestPath, workspaceToFile(workspace))

      activeWorkspace = workspace
      return workspace
    },

    getActiveWorkspace(): Workspace | null {
      return activeWorkspace
    },

    getWorkspacePath(): string | null {
      return getWorkspaceRoot()
    },

    // ─── Collections ───────────────────────────────────────────

    async listCollections(): Promise<Collection[]> {
      const workspace = requireWorkspace()
      const collections: Collection[] = []

      for (const colId of workspace.collections) {
        try {
          const file = await storage.readJson<CollectionFile>(collectionPath(colId))
          collections.push(collectionFromFile(file))
        } catch {
          console.error(`[WorkspaceService] Failed to load collection: ${colId}`)
        }
      }

      return collections
    },

    async getCollection(id: CollectionId): Promise<Collection> {
      const file = await storage.readJson<CollectionFile>(collectionPath(id))
      return collectionFromFile(file)
    },

    async createCollection(name: string): Promise<Collection> {
      const workspace = requireWorkspace()
      const id = generateId<CollectionId>()

      const collection: Collection = {
        id,
        name,
        variables: [],
        items: [],
      }

      await storage.writeJson(collectionPath(id), collectionToFile(collection))

      // Update workspace manifest
      activeWorkspace = {
        ...workspace,
        collections: [...workspace.collections, id],
      }
      await storage.writeJson(
        storage.workspacePath(WORKSPACE_MANIFEST),
        workspaceToFile(activeWorkspace),
      )

      return collection
    },

    async saveCollection(collection: Collection): Promise<void> {
      await storage.writeJson(collectionPath(collection.id), collectionToFile(collection))
    },

    async deleteCollection(id: CollectionId): Promise<void> {
      const workspace = requireWorkspace()

      await storage.deleteFile(collectionPath(id))

      activeWorkspace = {
        ...workspace,
        collections: workspace.collections.filter(c => c !== id),
      }
      await storage.writeJson(
        storage.workspacePath(WORKSPACE_MANIFEST),
        workspaceToFile(activeWorkspace),
      )
    },

    async renameCollection(id: CollectionId, name: string): Promise<Collection> {
      const collection = await this.getCollection(id)
      const updated: Collection = { ...collection, name }
      await this.saveCollection(updated)
      return updated
    },

    // ─── Tree Operations ───────────────────────────────────────

    async addFolder(collectionId: CollectionId, parentFolderId: FolderId | null, name: string): Promise<Collection> {
      const collection = await this.getCollection(collectionId)
      const folderId = generateId<FolderId>()
      const folder: Folder = { type: 'folder', id: folderId, name, children: [] }

      let items: TreeNode[]
      if (parentFolderId === null) {
        items = [...collection.items, folder]
      } else {
        items = insertIntoTree(collection.items, parentFolderId, folder, Infinity)
      }

      const updated: Collection = { ...collection, items }
      await this.saveCollection(updated)
      return updated
    },

    async removeFolder(collectionId: CollectionId, folderId: FolderId): Promise<Collection> {
      const collection = await this.getCollection(collectionId)
      const items = removeFromTree(collection.items, folderId)
      const updated: Collection = { ...collection, items }
      await this.saveCollection(updated)
      return updated
    },

    async renameFolder(collectionId: CollectionId, folderId: FolderId, name: string): Promise<Collection> {
      const collection = await this.getCollection(collectionId)
      const items = updateFolderInTree(collection.items, folderId, { name })
      const updated: Collection = { ...collection, items }
      await this.saveCollection(updated)
      return updated
    },

    async moveItem(
      collectionId: CollectionId,
      itemId: RequestId | FolderId,
      targetParentId: FolderId | null,
      index: number,
    ): Promise<Collection> {
      const collection = await this.getCollection(collectionId)

      // Find the item first
      let item: TreeNode | null = null
      const findItem = (nodes: readonly TreeNode[]): void => {
        for (const node of nodes) {
          if (node.type === 'request' && node.requestId === itemId) {
            item = node
            return
          }
          if (node.type === 'folder' && node.id === itemId) {
            item = node
            return
          }
          if (node.type === 'folder') findItem(node.children)
        }
      }
      findItem(collection.items)

      if (!item) throw new Error(`Item not found: ${itemId}`)

      // Remove from current position, insert at new position
      const withoutItem = removeFromTree(collection.items, itemId)
      const withItem = insertIntoTree(withoutItem, targetParentId, item, index)

      const updated: Collection = { ...collection, items: withItem }
      await this.saveCollection(updated)
      return updated
    },

    // ─── Requests ──────────────────────────────────────────────

    async getRequest(id: RequestId): Promise<Request> {
      const file = await storage.readJson<RequestFile>(requestPath(id))
      return requestFromFile(file)
    },

    async saveRequest(request: Request): Promise<void> {
      const updated: Request = {
        ...request,
        meta: { ...request.meta, updatedAt: now() },
      }
      await storage.writeJson(requestPath(request.id), requestToFile(updated))
    },

    async createRequest(
      collectionId: CollectionId,
      folderId: FolderId | null,
      defaults?: Partial<Pick<Request, 'name' | 'method' | 'protocol'>>,
    ): Promise<Request> {
      const id = generateId<RequestId>()
      const timestamp = now()

      const request: Request = {
        id,
        name: defaults?.name ?? 'Untitled Request',
        protocol: defaults?.protocol ?? 'rest',
        method: defaults?.method ?? 'GET',
        url: '',
        headers: [],
        params: [],
        body: { type: 'none', content: '' },
        auth: { type: 'none' },
        preRequest: '',
        tests: '',
        meta: { createdAt: timestamp, updatedAt: timestamp },
      }

      // Write request file
      await storage.writeJson(requestPath(id), requestToFile(request))

      // Add ref to collection tree
      const collection = await this.getCollection(collectionId)
      const ref: RequestRef = { type: 'request', requestId: id }

      let items: TreeNode[]
      if (folderId === null) {
        items = [...collection.items, ref]
      } else {
        items = insertIntoTree(collection.items, folderId, ref, Infinity)
      }

      await this.saveCollection({ ...collection, items })

      return request
    },

    async deleteRequest(id: RequestId): Promise<void> {
      // Remove file
      await storage.deleteFile(requestPath(id))

      // Remove ref from all collections
      const workspace = requireWorkspace()
      for (const colId of workspace.collections) {
        try {
          const collection = await this.getCollection(colId)
          const items = removeFromTree(collection.items, id)
          if (items.length !== collection.items.length || JSON.stringify(items) !== JSON.stringify(collection.items)) {
            await this.saveCollection({ ...collection, items })
          }
        } catch {
          // Collection might not exist
        }
      }
    },

    async duplicateRequest(id: RequestId): Promise<Request> {
      const original = await this.getRequest(id)
      const newId = generateId<RequestId>()
      const timestamp = now()

      const duplicate: Request = {
        ...original,
        id: newId,
        name: `${original.name} (copy)`,
        meta: { createdAt: timestamp, updatedAt: timestamp },
      }

      await storage.writeJson(requestPath(newId), requestToFile(duplicate))
      return duplicate
    },

    async moveRequest(
      requestId: RequestId,
      fromCollectionId: CollectionId,
      toCollectionId: CollectionId,
      toFolderId: FolderId | null,
      index?: number,
    ): Promise<void> {
      // Remove from source
      const fromCollection = await this.getCollection(fromCollectionId)
      const fromItems = removeFromTree(fromCollection.items, requestId)
      await this.saveCollection({ ...fromCollection, items: fromItems })

      // Add to target
      const ref: RequestRef = { type: 'request', requestId }
      const toCollection = await this.getCollection(toCollectionId)
      const toItems = insertIntoTree(toCollection.items, toFolderId, ref, index ?? Infinity)
      await this.saveCollection({ ...toCollection, items: toItems })
    },

    // ─── Environments ──────────────────────────────────────────

    async listEnvironments(): Promise<Environment[]> {
      const dir = storage.workspacePath(ENVIRONMENTS_DIR)
      await storage.ensureDir(dir)
      const files = await storage.listFiles(dir, '*.environment.json')
      const environments: Environment[] = []

      for (const filename of files) {
        try {
          const path = storage.workspacePath(ENVIRONMENTS_DIR, filename)
          const file = await storage.readJson<EnvironmentFile>(path)
          environments.push(environmentFromFile(file))
        } catch {
          // Skip corrupt files
        }
      }

      return environments
    },

    async getEnvironment(id: EnvironmentId): Promise<Environment> {
      const file = await storage.readJson<EnvironmentFile>(environmentPath(id))
      return environmentFromFile(file)
    },

    async saveEnvironment(env: Environment): Promise<void> {
      await storage.writeJson(environmentPath(env.id), environmentToFile(env))
    },

    async createEnvironment(name: string): Promise<Environment> {
      const id = generateId<EnvironmentId>()
      const env: Environment = { id, name, variables: [] }
      await storage.writeJson(environmentPath(id), environmentToFile(env))
      return env
    },

    async deleteEnvironment(id: EnvironmentId): Promise<void> {
      await storage.deleteFile(environmentPath(id))

      // Clear defaultEnvironment if it was the deleted one
      const workspace = requireWorkspace()
      if (workspace.defaultEnvironment === id) {
        activeWorkspace = { ...workspace, defaultEnvironment: null }
        await storage.writeJson(
          storage.workspacePath(WORKSPACE_MANIFEST),
          workspaceToFile(activeWorkspace),
        )
      }
    },

    async duplicateEnvironment(id: EnvironmentId): Promise<Environment> {
      const original = await this.getEnvironment(id)
      const newId = generateId<EnvironmentId>()
      const duplicate: Environment = {
        ...original,
        id: newId,
        name: `${original.name} (copy)`,
      }
      await storage.writeJson(environmentPath(newId), environmentToFile(duplicate))
      return duplicate
    },

    async setDefaultEnvironment(id: EnvironmentId | null): Promise<void> {
      const workspace = requireWorkspace()
      activeWorkspace = { ...workspace, defaultEnvironment: id }
      await storage.writeJson(
        storage.workspacePath(WORKSPACE_MANIFEST),
        workspaceToFile(activeWorkspace),
      )
    },

    // ─── Workspace Health ──────────────────────────────────────

    async checkHealth(): Promise<WorkspaceHealth> {
      const workspace = requireWorkspace()

      // Get all request IDs referenced in collections
      const referencedIds = new Set<string>()
      for (const colId of workspace.collections) {
        try {
          const collection = await this.getCollection(colId)
          for (const id of collectRequestIds(collection.items)) {
            referencedIds.add(id)
          }
        } catch {
          // Collection might be corrupt
        }
      }

      // Get all request files on disk
      const dir = storage.workspacePath(REQUESTS_DIR)
      await storage.ensureDir(dir)
      const files = await storage.listFiles(dir, '*.request.json')
      const fileIds = new Set(files.map(f => f.replace('.request.json', '')))

      // Orphans: on disk but not in any tree
      const orphanedRequests: OrphanedRequest[] = []
      for (const fileId of fileIds) {
        if (!referencedIds.has(fileId)) {
          try {
            const request = await this.getRequest(fileId as RequestId)
            orphanedRequests.push({ id: request.id, name: request.name })
          } catch {
            orphanedRequests.push({ id: fileId as RequestId, name: 'Unknown' })
          }
        }
      }

      // Missing: in tree but not on disk
      const missingRequests: RequestId[] = []
      for (const refId of referencedIds) {
        if (!fileIds.has(refId)) {
          missingRequests.push(refId as RequestId)
        }
      }

      return {
        isHealthy: orphanedRequests.length === 0 && missingRequests.length === 0,
        orphanedRequests,
        missingRequests,
      }
    },

    async recoverOrphans(requestIds: RequestId[], targetCollectionId: CollectionId, folderId?: FolderId): Promise<void> {
      const collection = await this.getCollection(targetCollectionId)
      const refs: TreeNode[] = requestIds.map(id => ({ type: 'request', requestId: id }))

      let items: TreeNode[]
      if (folderId) {
        items = collection.items as TreeNode[]
        for (const ref of refs) {
          items = insertIntoTree(items, folderId, ref, Infinity)
        }
      } else {
        items = [...collection.items, ...refs]
      }

      await this.saveCollection({ ...collection, items })
    },

    // ─── Import / Export ───────────────────────────────────────

    async previewImport(_source: ImportSource): Promise<ImportPreview> {
      // TODO: Implement per format (postman, openapi, curl)
      throw new Error('Import not yet implemented in workspace service.')
    },

    async confirmImport(_preview: ImportPreview, _targetCollectionId?: CollectionId): Promise<CollectionId> {
      // TODO: Implement
      throw new Error('Import not yet implemented in workspace service.')
    },

    async exportCollection(_collectionId: CollectionId, _format: ExportFormat): Promise<string> {
      // TODO: Implement per format
      throw new Error('Export not yet implemented in workspace service.')
    },
  }
}
