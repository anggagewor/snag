import type { KeyValuePair, UUID } from './common'
import type { AuthConfig } from './request'

/**
 * GraphQL request configuration.
 * Stub — will be fully implemented when GraphQL feature lands.
 */
export interface GraphQLConfig {
  id: UUID
  url: string
  headers: KeyValuePair[]
  auth: AuthConfig
  query: string
  variables?: string
  operationName?: string
  preRequestScript?: string
  testScript?: string
}

export interface GraphQLResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  data?: unknown
  errors?: { message: string; locations?: { line: number; column: number }[] }[]
  size: number
  time: number
}

export function createEmptyGraphQLConfig(): GraphQLConfig {
  return {
    id: crypto.randomUUID(),
    url: '',
    headers: [],
    auth: { type: 'none' },
    query: '',
    variables: '',
  }
}
