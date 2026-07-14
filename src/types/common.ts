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

export interface KeyValuePair {
  id: UUID
  key: string
  value: string
  enabled: boolean
}

export type ThemeMode = 'light' | 'dark' | 'system'
