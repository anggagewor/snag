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

export interface ResponseData {
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
