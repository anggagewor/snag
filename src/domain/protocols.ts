/**
 * Protocol-specific configuration types.
 *
 * Stubs for future protocol features (WebSocket, GraphQL, gRPC).
 * Only interfaces are defined here — implementations will arrive
 * when each protocol feature lands.
 */

import type { KeyValuePair } from './http'
import type { RequestAuth } from './Request'

// ─── WebSocket ───────────────────────────────────────────────────────────────

export interface WebSocketConfig {
  readonly id: string
  readonly url: string
  readonly headers: KeyValuePair[]
  readonly auth: RequestAuth
  readonly initialMessage?: string
  readonly messageFormat: 'json' | 'text' | 'binary'
  readonly preRequestScript?: string
  readonly testScript?: string
}

export interface WebSocketMessage {
  readonly id: string
  readonly direction: 'sent' | 'received'
  readonly data: string
  readonly timestamp: string
  readonly size: number
}

export interface WebSocketSession {
  readonly status: 'connected' | 'disconnected' | 'connecting' | 'error'
  readonly messages: WebSocketMessage[]
  readonly connectedAt?: string
  readonly error?: string
}

// ─── GraphQL ─────────────────────────────────────────────────────────────────

export interface GraphQLConfig {
  readonly id: string
  readonly url: string
  readonly headers: KeyValuePair[]
  readonly auth: RequestAuth
  readonly query: string
  readonly variables?: string
  readonly operationName?: string
  readonly preRequestScript?: string
  readonly testScript?: string
}

export interface GraphQLResponseData {
  readonly status: number
  readonly statusText: string
  readonly headers: Record<string, string>
  readonly body: string
  readonly data?: unknown
  readonly errors?: { message: string; locations?: { line: number; column: number }[] }[]
  readonly size: number
  readonly time: number
}

// ─── gRPC ────────────────────────────────────────────────────────────────────

export interface GrpcConfig {
  readonly id: string
  readonly url: string
  readonly protoSource: 'file' | 'inline' | 'reflection'
  readonly protoFilePath?: string
  readonly protoContent?: string
  readonly service?: string
  readonly method?: string
  readonly metadata: KeyValuePair[]
  readonly auth: RequestAuth
  readonly body: string
  readonly streamType: 'unary' | 'server-stream' | 'client-stream' | 'bidirectional'
  readonly preRequestScript?: string
  readonly testScript?: string
}

export interface GrpcResponseData {
  readonly status: number
  readonly statusMessage: string
  readonly metadata: Record<string, string>
  readonly trailers: Record<string, string>
  readonly body: string
  readonly messages: { data: string; timestamp: string }[]
  readonly time: number
  readonly size: number
}
