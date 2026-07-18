/**
 * Collection domain model.
 *
 * Berisi tree structure saja (folder hierarchy + request references).
 * Tidak menyimpan data request. Source of truth untuk posisi
 * request dalam hierarki.
 */

import type { CollectionId, FolderId, RequestId } from './ids'
import type { KeyValuePair } from './http'

export interface RequestRef {
  readonly type: 'request'
  readonly requestId: RequestId
}

export interface Folder {
  readonly type: 'folder'
  readonly id: FolderId
  readonly name: string
  readonly children: readonly TreeNode[]
  readonly auth?: FolderAuth
}

export interface FolderAuth {
  readonly type: 'none' | 'bearer' | 'basic' | 'apikey'
  readonly basic?: { readonly username: string; readonly password: string }
  readonly bearer?: { readonly token: string }
  readonly apiKey?: { readonly key: string; readonly value: string; readonly in: 'header' | 'query' }
}

export type TreeNode = Folder | RequestRef

export interface Collection {
  readonly id: CollectionId
  readonly name: string
  readonly variables: readonly KeyValuePair[]
  readonly items: readonly TreeNode[]
}
