import type { RequestConfig } from './request'
import type { UUID } from './common'

export interface CollectionItem {
  id: UUID
  type: 'request' | 'folder'
  name: string
  items?: CollectionItem[] // only for folders
  request?: RequestConfig // only for requests
}

export interface Collection {
  id: UUID
  name: string
  description?: string
  items: CollectionItem[]
  variables?: { key: string; value: string }[]
  createdAt: string
  updatedAt: string
}
