/**
 * WorkspaceService — orchestration layer.
 *
 * Satu-satunya entry point untuk semua operasi workspace.
 * Store memanggil service. Service memanggil StorageAdapter.
 * UI dan Store TIDAK BOLEH bypass service.
 *
 * Depends on: domain/, storage/
 * Does NOT depend on: stores/, UI, Vue, Pinia
 */

import type {
  CollectionId,
  RequestId,
  EnvironmentId,
  FolderId,
  Workspace,
  Collection,
  Request,
  Environment,
} from '../domain'

// ─── Result Types ────────────────────────────────────────────────

export interface OrphanedRequest {
  readonly id: RequestId
  readonly name: string
}

export interface WorkspaceHealth {
  readonly isHealthy: boolean
  readonly orphanedRequests: readonly OrphanedRequest[]
  readonly missingRequests: readonly RequestId[]
}

export type ImportSource =
  | { readonly type: 'postman'; readonly content: string }
  | { readonly type: 'openapi'; readonly content: string }
  | { readonly type: 'curl'; readonly content: string }

export interface ImportPreview {
  readonly source: ImportSource
  readonly collectionName: string
  readonly requestCount: number
  readonly folderCount: number
  readonly environmentCount: number
  readonly requests: readonly { readonly name: string; readonly method: string; readonly url: string }[]
}

export type ExportFormat = 'postman' | 'curl'

// ─── Interface ───────────────────────────────────────────────────

export interface WorkspaceService {
  // ─── Workspace Lifecycle ─────────────────────────────────────

  /** Open workspace from path. Loads manifest, validates, hydrates. */
  openWorkspace(path: string): Promise<Workspace>

  /** Close current workspace. Persists dirty state. */
  closeWorkspace(): Promise<void>

  /** Create new workspace at path. Initializes folder structure. */
  createWorkspace(name: string, path: string): Promise<Workspace>

  /** Get currently active workspace. Null if none open. */
  getActiveWorkspace(): Workspace | null

  /** Get workspace root path. */
  getWorkspacePath(): string | null

  // ─── Collections ─────────────────────────────────────────────

  /** List all collections in workspace (meta only, no tree). */
  listCollections(): Promise<Collection[]>

  /** Get full collection with tree. */
  getCollection(id: CollectionId): Promise<Collection>

  /** Create new empty collection. */
  createCollection(name: string): Promise<Collection>

  /** Save collection (tree structure, variables). */
  saveCollection(collection: Collection): Promise<void>

  /** Delete collection. Requests become orphans. */
  deleteCollection(id: CollectionId): Promise<void>

  /** Rename collection. */
  renameCollection(id: CollectionId, name: string): Promise<Collection>

  // ─── Tree Operations ─────────────────────────────────────────

  /** Add folder to collection tree. */
  addFolder(collectionId: CollectionId, parentFolderId: FolderId | null, name: string): Promise<Collection>

  /** Remove folder from tree. Children request refs become orphans. */
  removeFolder(collectionId: CollectionId, folderId: FolderId): Promise<Collection>

  /** Rename folder. */
  renameFolder(collectionId: CollectionId, folderId: FolderId, name: string): Promise<Collection>

  /** Move item (request ref or folder) within or across folders. */
  moveItem(
    collectionId: CollectionId,
    itemId: RequestId | FolderId,
    targetParentId: FolderId | null,
    index: number,
  ): Promise<Collection>

  // ─── Requests ────────────────────────────────────────────────

  /** Load request from disk (lazy). */
  getRequest(id: RequestId): Promise<Request>

  /** Save request to disk. */
  saveRequest(request: Request): Promise<void>

  /** Create new request and add ref to collection tree. */
  createRequest(
    collectionId: CollectionId,
    folderId: FolderId | null,
    defaults?: Partial<Pick<Request, 'name' | 'method' | 'protocol'>>,
  ): Promise<Request>

  /** Delete request file and remove ref from all trees. */
  deleteRequest(id: RequestId): Promise<void>

  /** Duplicate request with new ID. */
  duplicateRequest(id: RequestId): Promise<Request>

  /** Move request ref between collections/folders. */
  moveRequest(
    requestId: RequestId,
    fromCollectionId: CollectionId,
    toCollectionId: CollectionId,
    toFolderId: FolderId | null,
    index?: number,
  ): Promise<void>

  // ─── Environments ────────────────────────────────────────────

  /** List all environments in workspace. */
  listEnvironments(): Promise<Environment[]>

  /** Get environment by ID. */
  getEnvironment(id: EnvironmentId): Promise<Environment>

  /** Save environment. */
  saveEnvironment(env: Environment): Promise<void>

  /** Create new environment. */
  createEnvironment(name: string): Promise<Environment>

  /** Delete environment. Clears defaultEnvironment if was active. */
  deleteEnvironment(id: EnvironmentId): Promise<void>

  /** Duplicate environment with new ID. */
  duplicateEnvironment(id: EnvironmentId): Promise<Environment>

  /** Set workspace default environment. */
  setDefaultEnvironment(id: EnvironmentId | null): Promise<void>

  // ─── Workspace Health ────────────────────────────────────────

  /** Check workspace integrity (orphans, missing refs). */
  checkHealth(): Promise<WorkspaceHealth>

  /** Recover orphaned requests into a collection. */
  recoverOrphans(requestIds: RequestId[], targetCollectionId: CollectionId, folderId?: FolderId): Promise<void>

  // ─── Import / Export ─────────────────────────────────────────

  /** Parse import source and return preview. */
  previewImport(source: ImportSource): Promise<ImportPreview>

  /** Confirm import — write files to workspace. */
  confirmImport(preview: ImportPreview, targetCollectionId?: CollectionId): Promise<CollectionId>

  /** Export collection in given format. */
  exportCollection(collectionId: CollectionId, format: ExportFormat): Promise<string>
}
