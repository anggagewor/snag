/**
 * Mappers: Domain ↔ Persistence conversion.
 *
 * Satu-satunya tempat yang tahu hubungan antara
 * domain model dan file format. Kalau format berubah,
 * cukup update mapper — domain dan UI tidak terpengaruh.
 */

import type {
  WorkspaceId,
  CollectionId,
  RequestId,
  EnvironmentId,
  FolderId,
  HistoryEntryId,
  HttpMethod,
  ProtocolType,
  KeyValuePair,
  Workspace,
  WorkspaceEntry,
  Collection,
  TreeNode,
  Folder,
  RequestRef,
  Request,
  RequestBody,
  RequestAuth,
  BodyType,
  AuthType,
  Environment,
  EnvironmentVariable,
  HistoryEntry,
  GlobalSettings,
  WorkspaceSettings,
} from '../domain'

import type {
  WorkspaceFile,
  CollectionFile,
  CollectionFileTreeNode,
  RequestFile,
  EnvironmentFile,
  RegistryEntry,
  HistoryFileEntry,
  GlobalSettingsFile,
  WorkspaceSettingsFile,
} from './models'

// ─── Workspace ───────────────────────────────────────────────────

export function workspaceFromFile(file: WorkspaceFile): Workspace {
  return {
    id: file.id as WorkspaceId,
    name: file.name,
    createdAt: file.createdAt,
    lastOpenedAt: file.lastOpenedAt,
    defaultEnvironment: file.defaultEnvironment as EnvironmentId | null,
    collections: file.collections.map(id => id as CollectionId),
  }
}

export function workspaceToFile(workspace: Workspace): WorkspaceFile {
  return {
    type: 'workspace',
    version: 1,
    id: workspace.id,
    name: workspace.name,
    createdAt: workspace.createdAt,
    lastOpenedAt: workspace.lastOpenedAt,
    defaultEnvironment: workspace.defaultEnvironment,
    collections: [...workspace.collections],
  }
}

// ─── Collection ──────────────────────────────────────────────────

export function collectionFromFile(file: CollectionFile): Collection {
  return {
    id: file.id as CollectionId,
    name: file.name,
    variables: file.variables.map(v => ({
      key: v.key,
      value: v.value,
      enabled: v.enabled,
      description: v.description,
    })),
    items: file.items.map(mapTreeNodeFromFile),
  }
}

function mapTreeNodeFromFile(node: CollectionFileTreeNode): TreeNode {
  if (node.type === 'folder') {
    return {
      type: 'folder',
      id: node.id as FolderId,
      name: node.name,
      children: node.children.map(mapTreeNodeFromFile),
    } satisfies Folder
  }
  return {
    type: 'request',
    requestId: node.requestId as RequestId,
  } satisfies RequestRef
}

export function collectionToFile(collection: Collection): CollectionFile {
  return {
    type: 'collection',
    version: 1,
    id: collection.id,
    name: collection.name,
    variables: collection.variables.map(v => ({
      key: v.key,
      value: v.value,
      enabled: v.enabled,
      ...(v.description ? { description: v.description } : {}),
    })),
    items: collection.items.map(mapTreeNodeToFile),
  }
}

function mapTreeNodeToFile(node: TreeNode): CollectionFileTreeNode {
  if (node.type === 'folder') {
    return {
      type: 'folder',
      id: node.id,
      name: node.name,
      children: node.children.map(mapTreeNodeToFile),
    }
  }
  return {
    type: 'request',
    requestId: node.requestId,
  }
}

// ─── Request ─────────────────────────────────────────────────────

export function requestFromFile(file: RequestFile): Request {
  return {
    id: file.id as RequestId,
    name: file.name,
    protocol: file.protocol as ProtocolType,
    method: file.method as HttpMethod,
    url: file.url,
    headers: file.headers as KeyValuePair[],
    params: file.params as KeyValuePair[],
    pathParams: file.pathParams as KeyValuePair[] | undefined,
    body: {
      type: file.body.type as BodyType,
      content: file.body.content,
      formData: file.body.formData as KeyValuePair[] | undefined,
      binaryPath: file.body.binaryPath,
    } satisfies RequestBody,
    auth: {
      type: file.auth.type as AuthType,
      basic: file.auth.basic,
      bearer: file.auth.bearer,
      apiKey: file.auth.apiKey ? {
        key: file.auth.apiKey.key,
        value: file.auth.apiKey.value,
        in: file.auth.apiKey.in as 'header' | 'query',
      } : undefined,
    } satisfies RequestAuth,
    preRequest: file.preRequest,
    tests: file.tests,
    meta: {
      createdAt: file.meta.createdAt,
      updatedAt: file.meta.updatedAt,
    },
  }
}

export function requestToFile(request: Request): RequestFile {
  return {
    type: 'request',
    version: 1,
    id: request.id,
    name: request.name,
    protocol: request.protocol,
    method: request.method,
    url: request.url,
    headers: request.headers.map(h => ({
      key: h.key,
      value: h.value,
      enabled: h.enabled,
      ...(h.description ? { description: h.description } : {}),
    })),
    params: request.params.map(p => ({
      key: p.key,
      value: p.value,
      enabled: p.enabled,
      ...(p.description ? { description: p.description } : {}),
    })),
    ...(request.pathParams?.length ? {
      pathParams: request.pathParams.map(p => ({
        key: p.key,
        value: p.value,
        enabled: p.enabled,
        ...(p.description ? { description: p.description } : {}),
      })),
    } : {}),
    body: {
      type: request.body.type,
      content: request.body.content,
      ...(request.body.formData ? { formData: [...request.body.formData] } : {}),
      ...(request.body.binaryPath ? { binaryPath: request.body.binaryPath } : {}),
    },
    auth: {
      type: request.auth.type,
      ...(request.auth.basic ? { basic: { ...request.auth.basic } } : {}),
      ...(request.auth.bearer ? { bearer: { ...request.auth.bearer } } : {}),
      ...(request.auth.apiKey ? { apiKey: { ...request.auth.apiKey } } : {}),
    },
    preRequest: request.preRequest,
    tests: request.tests,
    meta: {
      createdAt: request.meta.createdAt,
      updatedAt: request.meta.updatedAt,
    },
  }
}

// ─── Environment ─────────────────────────────────────────────────

export function environmentFromFile(file: EnvironmentFile): Environment {
  return {
    id: file.id as EnvironmentId,
    name: file.name,
    variables: file.variables.map(v => ({
      key: v.key,
      value: v.value,
      enabled: v.enabled,
    })) as EnvironmentVariable[],
  }
}

export function environmentToFile(env: Environment): EnvironmentFile {
  return {
    type: 'environment',
    version: 1,
    id: env.id,
    name: env.name,
    variables: env.variables.map(v => ({
      key: v.key,
      value: v.value,
      enabled: v.enabled,
    })),
  }
}

// ─── History ─────────────────────────────────────────────────────

export function historyEntryFromFile(entry: HistoryFileEntry): HistoryEntry {
  return {
    id: entry.id as HistoryEntryId,
    workspaceId: entry.workspaceId as WorkspaceId | null,
    requestId: entry.requestId as RequestId | null,
    timestamp: entry.timestamp,
    method: entry.method as HttpMethod,
    url: entry.url,
    status: entry.status,
    duration: entry.duration,
    responseSize: entry.responseSize,
    ...(entry.request && { request: entry.request }),
    ...(entry.response && { response: entry.response }),
  }
}

export function historyEntryToFile(entry: HistoryEntry): HistoryFileEntry {
  return {
    id: entry.id,
    workspaceId: entry.workspaceId,
    requestId: entry.requestId,
    timestamp: entry.timestamp,
    method: entry.method,
    url: entry.url,
    status: entry.status,
    duration: entry.duration,
    responseSize: entry.responseSize,
    ...(entry.request && { request: entry.request }),
    ...(entry.response && { response: entry.response }),
  }
}

// ─── Registry ────────────────────────────────────────────────────

export function workspaceEntryFromRegistry(entry: RegistryEntry): WorkspaceEntry {
  return {
    id: entry.id as WorkspaceId,
    name: entry.name,
    path: entry.path,
    lastOpenedAt: entry.lastOpenedAt,
  }
}

export function workspaceEntryToRegistry(entry: WorkspaceEntry): RegistryEntry {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    lastOpenedAt: entry.lastOpenedAt,
  }
}

// ─── Settings ────────────────────────────────────────────────────

export function globalSettingsFromFile(file: GlobalSettingsFile): GlobalSettings {
  return {
    theme: file.theme as GlobalSettings['theme'],
    fontSize: file.fontSize,
    fontFamily: file.fontFamily,
    language: file.language,
  }
}

export function globalSettingsToFile(settings: GlobalSettings): GlobalSettingsFile {
  return {
    version: 1,
    theme: settings.theme,
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    language: settings.language,
  }
}

export function workspaceSettingsFromFile(file: WorkspaceSettingsFile): WorkspaceSettings {
  return {
    proxy: file.proxy ? {
      enabled: file.proxy.enabled,
      url: file.proxy.url,
      auth: file.proxy.auth,
    } : undefined,
    defaultHeaders: file.defaultHeaders,
    timeout: file.timeout,
    followRedirects: file.followRedirects,
    validateSsl: file.validateSsl,
  }
}

export function workspaceSettingsToFile(settings: WorkspaceSettings): WorkspaceSettingsFile {
  return {
    version: 1,
    ...(settings.proxy ? { proxy: settings.proxy } : {}),
    ...(settings.defaultHeaders ? { defaultHeaders: settings.defaultHeaders } : {}),
    ...(settings.timeout !== undefined ? { timeout: settings.timeout } : {}),
    ...(settings.followRedirects !== undefined ? { followRedirects: settings.followRedirects } : {}),
    ...(settings.validateSsl !== undefined ? { validateSsl: settings.validateSsl } : {}),
  }
}
