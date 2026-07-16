import type { KeyValuePair, UUID } from './common'
import type { AuthConfig } from './request'

/**
 * WebSocket connection configuration.
 * Stub — will be fully implemented when WebSocket feature lands.
 */
export interface WebSocketConfig {
  id: UUID
  url: string
  headers: KeyValuePair[]
  auth: AuthConfig
  /** Message to auto-send on connect (optional) */
  initialMessage?: string
  /** Message format hint for the editor */
  messageFormat: 'json' | 'text' | 'binary'
  preRequestScript?: string
  testScript?: string
}

export interface WebSocketMessage {
  id: UUID
  direction: 'sent' | 'received'
  data: string
  timestamp: string
  size: number
}

export interface WebSocketSession {
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  messages: WebSocketMessage[]
  connectedAt?: string
  error?: string
}

export function createEmptyWebSocketConfig(): WebSocketConfig {
  return {
    id: crypto.randomUUID(),
    url: '',
    headers: [],
    auth: { type: 'none' },
    messageFormat: 'json',
  }
}
