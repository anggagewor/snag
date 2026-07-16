export type UUID = string

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export enum ProtocolType {
  REST = 'rest',
  WEBSOCKET = 'websocket',
  GRAPHQL = 'graphql',
  GRPC = 'grpc',
}

export interface KeyValuePair {
  id: UUID
  key: string
  value: string
  enabled: boolean
}

export type ThemeMode = 'light' | 'dark' | 'system'
