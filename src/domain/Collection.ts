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
}

export type TreeNode = Folder | RequestRef

export interface Collection {
  readonly id: CollectionId
  readonly name: string
  readonly variables: readonly KeyValuePair[]
  readonly items: readonly TreeNode[]
}
