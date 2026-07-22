/**
 * Protocol UI constants — shared across all protocol panels.
 */

export interface ProtocolOption {
  label: string
  value: string
  color: string
}

export const PROTOCOL_OPTIONS: ProtocolOption[] = [
  { label: 'REST', value: 'rest', color: '#10b981' },
  { label: 'WS', value: 'websocket', color: '#f59e0b' },
  { label: 'GQL', value: 'graphql', color: '#e535ab' },
  { label: 'gRPC', value: 'grpc', color: '#3b82f6' },
]
