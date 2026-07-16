/**
 * Migration: v0 → v1
 *
 * Converts the old single-file format (appDataDir/collections.json, etc.)
 * into the new workspace-based file-per-request format.
 *
 * Strategy:
 * 1. Detect if v0 data exists (collections.json in appDataDir)
 * 2. Create a default workspace ("Migrated Workspace")
 * 3. Extract each request into its own file
 * 4. Build collection trees (folder + request refs)
 * 5. Migrate environments
 * 6. Backup old files (.bak)
 * 7. Register workspace
 *
 * This runs inline at startup. User does not need to know.
 */

import type {
  WorkspaceId,
  CollectionId,
  RequestId,
  EnvironmentId,
  FolderId,
  HttpMethod,
  ProtocolType,
} from '../domain'
import { ulid } from '../domain'
import type { StorageAdapter } from '../storage'
import type {
  WorkspaceFile,
  CollectionFile,
  CollectionFileTreeNode,
  RequestFile,
  EnvironmentFile,
} from '../storage/models'
import type { RegistryService } from './RegistryService'

// ─── v0 Types (old format) ───────────────────────────────────────

interface V0KeyValuePair {
  id?: string
  key: string
  value: string
  enabled: boolean
}

interface V0FormDataField {
  id?: string
  key: string
  value: string
  enabled: boolean
  fieldType: 'text' | 'file'
  fileName?: string
}

interface V0RequestBody {
  type: string
  raw?: string
  formData?: V0FormDataField[]
  urlencoded?: V0KeyValuePair[]
  binary?: string
  binaryFileName?: string
}

interface V0AuthConfig {
  type: string
  bearer?: { token: string }
  basic?: { username: string; password: string }
  apiKey?: { key: string; value: string; addTo: string }
}

interface V0RequestConfig {
  id: string
  method: string
  url: string
  headers: V0KeyValuePair[]
  params: V0KeyValuePair[]
  pathParams?: { key: string; value: string }[]
  body: V0RequestBody
  auth: V0AuthConfig
  preRequestScript?: string
  testScript?: string
}

interface V0CollectionItem {
  id: string
  type: 'request' | 'folder'
  name: string
  items?: V0CollectionItem[]
  protocol?: string
  request?: V0RequestConfig
  websocket?: unknown
  graphql?: unknown
  grpc?: unknown
}

interface V0Collection {
  id: string
  name: string
  description?: string
  items: V0CollectionItem[]
  variables?: { key: string; value: string }[]
  createdAt: string
  updatedAt: string
}

interface V0Environment {
  id: string
  name: string
  variables: { key: string; value: string; enabled: boolean }[]
  createdAt?: string
  updatedAt?: string
}

interface V0EnvironmentsState {
  environments: V0Environment[]
  activeEnvironmentId: string | null
}

// ─── Migration Logic ─────────────────────────────────────────────

export interface MigrationResult {
  migrated: boolean
  workspacePath: string | null
  collectionsCount: number
  requestsCount: number
  environmentsCount: number
}

/**
 * Detect if v0 data exists and needs migration.
 */
export async function detectV0Data(storage: StorageAdapter): Promise<boolean> {
  const collectionsPath = storage.globalPath('collections.json')
  return storage.exists(collectionsPath)
}

/**
 * Run full migration from v0 to v1.
 */
export async function migrateV0ToV1(
  storage: StorageAdapter,
  registry: RegistryService,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: false,
    workspacePath: null,
    collectionsCount: 0,
    requestsCount: 0,
    environmentsCount: 0,
  }

  // ─── 1. Read old data ──────────────────────────────────────

  const collectionsPath = storage.globalPath('collections.json')
  const environmentsPath = storage.globalPath('environments.json')

  let v0Collections: V0Collection[] = []
  let v0EnvState: V0EnvironmentsState = { environments: [], activeEnvironmentId: null }

  try {
    v0Collections = await storage.readJson<V0Collection[]>(collectionsPath)
  } catch {
    // No collections to migrate
    return result
  }

  try {
    v0EnvState = await storage.readJson<V0EnvironmentsState>(environmentsPath)
  } catch {
    // No environments, continue
  }

  // ─── 2. Create workspace directory ─────────────────────────

  const workspacePath = storage.globalPath('migrated-workspace')
  await storage.ensureDir(workspacePath)
  await storage.ensureDir(`${workspacePath}/collections`)
  await storage.ensureDir(`${workspacePath}/requests`)
  await storage.ensureDir(`${workspacePath}/environments`)

  const workspaceId = ulid() as WorkspaceId
  const timestamp = new Date().toISOString()

  // ─── 3. Migrate environments ───────────────────────────────

  const environmentIds: EnvironmentId[] = []
  let defaultEnvId: EnvironmentId | null = null

  for (const v0Env of v0EnvState.environments) {
    const envId = ulid() as EnvironmentId
    environmentIds.push(envId)

    if (v0Env.id === v0EnvState.activeEnvironmentId) {
      defaultEnvId = envId
    }

    const envFile: EnvironmentFile = {
      type: 'environment',
      version: 1,
      id: envId,
      name: v0Env.name,
      variables: v0Env.variables.map(v => ({
        key: v.key,
        value: v.value,
        enabled: v.enabled ?? true,
      })),
    }

    await storage.writeJson(`${workspacePath}/environments/${envId}.environment.json`, envFile)
    result.environmentsCount++
  }

  // ─── 4. Migrate collections ────────────────────────────────

  const collectionIds: CollectionId[] = []

  for (const v0Col of v0Collections) {
    const colId = ulid() as CollectionId
    collectionIds.push(colId)

    // Process items recursively — extract requests, build tree
    async function processItems(items: V0CollectionItem[]): Promise<CollectionFileTreeNode[]> {
      const nodes: CollectionFileTreeNode[] = []

      for (const item of items) {
        if (item.type === 'folder') {
          const folderId = ulid() as FolderId
          const children = item.items ? await processItems(item.items) : []
          nodes.push({
            type: 'folder',
            id: folderId,
            name: item.name,
            children,
          })
        } else if (item.type === 'request') {
          const requestId = ulid() as RequestId

          // Convert v0 request to v1 file format
          const requestFile = convertV0Request(item, requestId, timestamp)
          await storage.writeJson(
            `${workspacePath}/requests/${requestId}.request.json`,
            requestFile,
          )
          result.requestsCount++

          nodes.push({
            type: 'request',
            requestId,
          })
        }
      }

      return nodes
    }

    const items = await processItems(v0Col.items)

    const collectionFile: CollectionFile = {
      type: 'collection',
      version: 1,
      id: colId,
      name: v0Col.name,
      variables: (v0Col.variables ?? []).map(v => ({
        key: v.key,
        value: v.value,
        enabled: true,
      })),
      items,
    }

    await storage.writeJson(`${workspacePath}/collections/${colId}.collection.json`, collectionFile)
    result.collectionsCount++
  }

  // ─── 5. Write workspace manifest ──────────────────────────

  const workspaceFile: WorkspaceFile = {
    type: 'workspace',
    version: 1,
    id: workspaceId,
    name: 'Migrated Workspace',
    createdAt: timestamp,
    lastOpenedAt: timestamp,
    defaultEnvironment: defaultEnvId,
    collections: collectionIds,
  }

  await storage.writeJson(`${workspacePath}/workspace.json`, workspaceFile)

  // ─── 6. Register workspace ─────────────────────────────────

  await registry.registerWorkspace({
    id: workspaceId,
    name: 'Migrated Workspace',
    path: workspacePath,
    lastOpenedAt: timestamp,
  })

  // ─── 7. Backup old files ───────────────────────────────────

  await backupOldFile(storage, 'collections.json')
  await backupOldFile(storage, 'environments.json')
  await backupOldFile(storage, 'history.json')
  await backupOldFile(storage, 'settings.json')
  await backupOldFile(storage, 'tabs.json')

  result.migrated = true
  result.workspacePath = workspacePath
  return result
}

// ─── Helpers ─────────────────────────────────────────────────────

function convertV0Request(
  item: V0CollectionItem,
  requestId: RequestId,
  timestamp: string,
): RequestFile {
  const req = item.request
  const protocol = (item.protocol ?? 'rest') as ProtocolType
  const method = (req?.method ?? 'GET') as HttpMethod

  // Convert body
  let bodyType = 'none'
  let bodyContent = ''
  let formData: { key: string; value: string; enabled: boolean; description?: string }[] | undefined

  if (req?.body) {
    switch (req.body.type) {
      case 'json':
        bodyType = 'json'
        bodyContent = req.body.raw ?? ''
        break
      case 'raw':
        bodyType = 'text'
        bodyContent = req.body.raw ?? ''
        break
      case 'form-data':
        bodyType = 'formdata'
        formData = (req.body.formData ?? []).map(f => ({
          key: f.key,
          value: f.value,
          enabled: f.enabled,
        }))
        break
      case 'x-www-form-urlencoded':
        bodyType = 'urlencoded'
        formData = (req.body.urlencoded ?? []).map(f => ({
          key: f.key,
          value: f.value,
          enabled: f.enabled,
        }))
        break
      case 'binary':
        bodyType = 'binary'
        break
      default:
        bodyType = 'none'
    }
  }

  // Convert auth
  const auth: RequestFile['auth'] = { type: 'none' }
  if (req?.auth) {
    if (req.auth.type === 'bearer' && req.auth.bearer) {
      Object.assign(auth, { type: 'bearer', bearer: { token: req.auth.bearer.token } })
    } else if (req.auth.type === 'basic' && req.auth.basic) {
      Object.assign(auth, { type: 'basic', basic: { username: req.auth.basic.username, password: req.auth.basic.password } })
    } else if (req.auth.type === 'api-key' && req.auth.apiKey) {
      Object.assign(auth, {
        type: 'apikey',
        apiKey: {
          key: req.auth.apiKey.key,
          value: req.auth.apiKey.value,
          in: req.auth.apiKey.addTo === 'query' ? 'query' : 'header',
        },
      })
    }
  }

  // Convert headers/params (strip `id` field from old format)
  const headers = (req?.headers ?? []).map(h => ({
    key: h.key,
    value: h.value,
    enabled: h.enabled,
  }))

  const params = (req?.params ?? []).map(p => ({
    key: p.key,
    value: p.value,
    enabled: p.enabled,
  }))

  return {
    type: 'request',
    version: 1,
    id: requestId,
    name: item.name,
    protocol,
    method,
    url: req?.url ?? '',
    headers,
    params,
    body: {
      type: bodyType,
      content: bodyContent,
      ...(formData ? { formData } : {}),
      ...(req?.body?.binary ? { binaryPath: req.body.binary } : {}),
    },
    auth: auth as RequestFile['auth'],
    preRequest: req?.preRequestScript ?? '',
    tests: req?.testScript ?? '',
    meta: {
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }
}

async function backupOldFile(storage: StorageAdapter, filename: string): Promise<void> {
  const path = storage.globalPath(filename)
  const backupPath = storage.globalPath(`${filename}.v0.bak`)
  try {
    const exists = await storage.exists(path)
    if (exists) {
      const content = await storage.readJson(path)
      await storage.writeJson(backupPath, content)
      await storage.deleteFile(path)
    }
  } catch {
    // Non-critical, skip
  }
}
