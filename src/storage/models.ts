/**
 * Persistence models — what lives on disk.
 *
 * Berbeda dari domain model:
 * - Punya `type` dan `version` (storage metadata)
 * - Menggunakan plain string untuk ID (bukan branded)
 * - Flat structure yang JSON-serializable
 *
 * Mapper layer bertanggung jawab konversi domain ↔ persistence.
 */

// ─── Base ────────────────────────────────────────────────────────

export interface FileHeader {
  readonly type: string
  readonly version: number
}

// ─── Workspace File (workspace.json) ─────────────────────────────

export interface WorkspaceFile extends FileHeader {
  readonly type: 'workspace'
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly lastOpenedAt: string
  readonly defaultEnvironment: string | null
  readonly collections: readonly string[]
}

// ─── Collection File (<ULID>.collection.json) ────────────────────

export interface CollectionFileFolder {
  readonly type: 'folder'
  readonly id: string
  readonly name: string
  readonly children: readonly CollectionFileTreeNode[]
}

export interface CollectionFileRequestRef {
  readonly type: 'request'
  readonly requestId: string
}

export type CollectionFileTreeNode = CollectionFileFolder | CollectionFileRequestRef

export interface CollectionFile extends FileHeader {
  readonly type: 'collection'
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly variables: readonly CollectionFileVariable[]
  readonly items: readonly CollectionFileTreeNode[]
}

export interface CollectionFileVariable {
  readonly key: string
  readonly value: string
  readonly enabled: boolean
  readonly description?: string
}

// ─── Request File (<ULID>.request.json) ──────────────────────────

export interface RequestFileBody {
  readonly type: string
  readonly content: string
  readonly formData?: readonly RequestFileKeyValue[]
  readonly binaryPath?: string
}

export interface RequestFileAuth {
  readonly type: string
  readonly basic?: { readonly username: string; readonly password: string }
  readonly bearer?: { readonly token: string }
  readonly apiKey?: { readonly key: string; readonly value: string; readonly in: string }
}

export interface RequestFileKeyValue {
  readonly key: string
  readonly value: string
  readonly enabled: boolean
  readonly description?: string
}

export interface RequestFileMeta {
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RequestFile extends FileHeader {
  readonly type: 'request'
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly protocol: string
  readonly method: string
  readonly url: string
  readonly headers: readonly RequestFileKeyValue[]
  readonly params: readonly RequestFileKeyValue[]
  readonly pathParams?: readonly RequestFileKeyValue[]
  readonly body: RequestFileBody
  readonly auth: RequestFileAuth
  readonly preRequest: string
  readonly tests: string
  readonly meta: RequestFileMeta
}

// ─── Environment File (<ULID>.environment.json) ──────────────────

export interface EnvironmentFileVariable {
  readonly key: string
  readonly value: string
  readonly enabled: boolean
}

export interface EnvironmentFile extends FileHeader {
  readonly type: 'environment'
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly variables: readonly EnvironmentFileVariable[]
}

// ─── Registry File (~/.snag/workspaces.json) ─────────────────────

export interface RegistryFile {
  readonly version: 1
  readonly workspaces: readonly RegistryEntry[]
}

export interface RegistryEntry {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly lastOpenedAt: string
}

// ─── History File (~/.snag/history/<date>.json) ──────────────────

export interface HistoryFile {
  readonly version: 1
  readonly entries: readonly HistoryFileEntry[]
}

export interface HistoryFileEntry {
  readonly id: string
  readonly workspaceId: string | null
  readonly requestId: string | null
  readonly timestamp: string
  readonly method: string
  readonly url: string
  readonly status: number
  readonly duration: number
  readonly responseSize: number
  readonly request?: {
    readonly headers: readonly { key: string; value: string; enabled: boolean }[]
    readonly params: readonly { key: string; value: string; enabled: boolean }[]
    readonly pathParams?: readonly { key: string; value: string; enabled: boolean }[]
    readonly body: {
      readonly type: string
      readonly content: string
      readonly formData?: readonly { key: string; value: string; enabled: boolean }[]
      readonly binaryPath?: string
    }
    readonly auth: {
      readonly type: string
      readonly basic?: { readonly username: string; readonly password: string }
      readonly bearer?: { readonly token: string }
      readonly apiKey?: { readonly key: string; readonly value: string; readonly in: 'header' | 'query' }
    }
  }
  readonly response?: {
    readonly status: number
    readonly statusText: string
    readonly headers: Record<string, string>
    readonly body: string
    readonly size: number
    readonly time: number
    readonly requestHeaders?: Record<string, string>
    readonly requestUrl?: string
    readonly requestMethod?: string
  }
}

// ─── Global Settings File (~/.snag/settings.json) ────────────────

export interface GlobalSettingsFile {
  readonly version: 1
  readonly theme: string
  readonly fontSize: number
  readonly fontFamily: string
  readonly language: string
}

// ─── Workspace Settings File (<workspace>/settings.json) ─────────

export interface WorkspaceSettingsFile {
  readonly version: 1
  readonly proxy?: {
    readonly enabled: boolean
    readonly url: string
    readonly auth?: { readonly username: string; readonly password: string }
  }
  readonly defaultHeaders?: readonly { readonly key: string; readonly value: string }[]
  readonly timeout?: number
  readonly followRedirects?: boolean
  readonly validateSsl?: boolean
}
