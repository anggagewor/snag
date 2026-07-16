import { HttpMethod } from './common'
import type { KeyValuePair, UUID } from './common'

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary'

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key'

export interface AuthConfig {
  type: AuthType
  bearer?: { token: string }
  basic?: { username: string; password: string }
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' }
}

export interface PathParam {
  key: string
  value: string
}

export interface FormDataField {
  id: UUID
  key: string
  value: string
  enabled: boolean
  fieldType: 'text' | 'file' // text = plain value, file = path to file
  fileName?: string // original filename (display purpose)
}

export interface RequestBody {
  type: BodyType
  raw?: string
  formData?: FormDataField[]
  urlencoded?: KeyValuePair[]
  binary?: string // file path
  binaryFileName?: string // display name for binary file
}

export interface RequestConfig {
  id: UUID
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  params: KeyValuePair[]
  pathParams?: PathParam[]
  body: RequestBody
  auth: AuthConfig
  preRequestScript?: string
  testScript?: string
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number
  time: number // ms
  /** The actual headers that were sent (including defaults) */
  requestHeaders?: Record<string, string>
  /** The final resolved URL that was sent */
  requestUrl?: string
  /** The method used */
  requestMethod?: string
}

export function createEmptyRequest(): RequestConfig {
  return {
    id: crypto.randomUUID(),
    method: HttpMethod.GET,
    url: '',
    headers: [],
    params: [],
    pathParams: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  }
}

/**
 * Extract path parameter names from a URL pattern.
 * Matches `:paramName` segments (e.g., /users/:id/posts/:postId)
 */
export function extractPathParams(url: string): string[] {
  const matches = url.match(/:([a-zA-Z_]\w*)/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1)))]
}
