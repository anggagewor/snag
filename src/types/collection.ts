import type { RequestConfig } from './request'
import type { WebSocketConfig } from './websocket'
import type { GraphQLConfig } from './graphql'
import type { GrpcConfig } from './grpc'
import type { UUID } from './common'
import { ProtocolType } from './common'

export interface CollectionItem {
  id: UUID
  type: 'request' | 'folder'
  name: string
  items?: CollectionItem[] // only for folders
  /** Protocol type — defaults to 'rest' if omitted (backward compat) */
  protocol?: ProtocolType
  request?: RequestConfig // REST requests
  websocket?: WebSocketConfig // WebSocket connections
  graphql?: GraphQLConfig // GraphQL requests
  grpc?: GrpcConfig // gRPC calls
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

/** Helper to get the effective protocol of a collection item */
export function getItemProtocol(item: CollectionItem): ProtocolType {
  if (item.protocol) return item.protocol
  if (item.websocket) return ProtocolType.WEBSOCKET
  if (item.graphql) return ProtocolType.GRAPHQL
  if (item.grpc) return ProtocolType.GRPC
  return ProtocolType.REST
}
