/**
 * History domain model.
 *
 * Global (cross-workspace). Record dari eksekusi request.
 * Immutable setelah dibuat — tidak pernah di-update.
 */

import type { HistoryEntryId, WorkspaceId, RequestId } from './ids'
import type { HttpMethod, KeyValuePair } from './http'

export interface HistoryRequestSnapshot {
  readonly headers: readonly KeyValuePair[]
  readonly params: readonly KeyValuePair[]
  readonly pathParams?: readonly KeyValuePair[]
  readonly body: {
    readonly type: string
    readonly content: string
    readonly formData?: readonly KeyValuePair[]
    readonly binaryPath?: string
  }
  readonly auth: {
    readonly type: string
    readonly basic?: { readonly username: string; readonly password: string }
    readonly bearer?: { readonly token: string }
    readonly apiKey?: { readonly key: string; readonly value: string; readonly in: 'header' | 'query' }
  }
}

export interface HistoryResponseSnapshot {
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

export interface HistoryEntry {
  readonly id: HistoryEntryId
  readonly workspaceId: WorkspaceId | null
  readonly requestId: RequestId | null
  readonly timestamp: string
  readonly method: HttpMethod
  readonly url: string
  readonly status: number
  readonly duration: number
  readonly responseSize: number
  readonly request?: HistoryRequestSnapshot
  readonly response?: HistoryResponseSnapshot
}
