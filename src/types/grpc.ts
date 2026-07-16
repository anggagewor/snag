import type { KeyValuePair, UUID } from './common'
import type { AuthConfig } from './request'

/**
 * gRPC request configuration.
 * Stub — will be fully implemented when gRPC feature lands.
 */
export interface GrpcConfig {
  id: UUID
  url: string
  /** Path to .proto file or inline proto definition */
  protoSource: 'file' | 'inline' | 'reflection'
  protoFilePath?: string
  protoContent?: string
  /** Selected service and method from proto */
  service?: string
  method?: string
  /** Request metadata (equivalent to headers) */
  metadata: KeyValuePair[]
  auth: AuthConfig
  /** JSON body for the request message */
  body: string
  /** Stream type determined by proto definition */
  streamType: 'unary' | 'server-stream' | 'client-stream' | 'bidirectional'
  preRequestScript?: string
  testScript?: string
}

export interface GrpcResponseData {
  status: number
  statusMessage: string
  metadata: Record<string, string>
  trailers: Record<string, string>
  body: string
  messages: { data: string; timestamp: string }[]
  time: number
  size: number
}

export function createEmptyGrpcConfig(): GrpcConfig {
  return {
    id: crypto.randomUUID(),
    url: '',
    protoSource: 'file',
    metadata: [],
    auth: { type: 'none' },
    body: '{}',
    streamType: 'unary',
  }
}
