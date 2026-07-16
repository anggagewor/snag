/**
 * HTTP primitives used across the domain.
 */

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export type ProtocolType =
  | 'rest'
  | 'websocket'
  | 'graphql'
  | 'grpc'

export interface KeyValuePair {
  readonly key: string
  readonly value: string
  readonly enabled: boolean
  readonly description?: string
}
