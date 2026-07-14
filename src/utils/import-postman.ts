import { HttpMethod } from '@/types/common'
import type { KeyValuePair } from '@/types/common'
import type { Collection, CollectionItem } from '@/types/collection'
import type { RequestConfig, AuthConfig, RequestBody, FormDataField } from '@/types/request'

/**
 * Import a Postman Collection v2.1 JSON file into Snag Collection format.
 * Supports: folders, requests, headers, params, body (raw/json/formdata/urlencoded), auth (bearer/basic/apikey).
 */
export function importPostmanCollection(json: unknown): Collection {
  const data = json as PostmanCollection
  const info = data.info || {}

  const collection: Collection = {
    id: crypto.randomUUID(),
    name: info.name || 'Imported Collection',
    description: info.description || undefined,
    items: parseItems(data.item || []),
    variables: (data.variable || []).map((v: PostmanVariable) => ({
      key: v.key || '',
      value: v.value || '',
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return collection
}

function parseItems(items: PostmanItem[]): CollectionItem[] {
  return items.map((item) => {
    // Folder: has sub-items array (regardless of whether it also has request)
    if (item.item && Array.isArray(item.item) && item.item.length > 0) {
      return {
        id: crypto.randomUUID(),
        type: 'folder' as const,
        name: item.name || 'Unnamed Folder',
        items: parseItems(item.item),
      }
    }

    // Request
    return {
      id: crypto.randomUUID(),
      type: 'request' as const,
      name: item.name || 'Unnamed Request',
      request: parseRequest(item.request),
    }
  })
}

function parseRequest(req: PostmanRequest | undefined): RequestConfig {
  if (!req) {
    return {
      id: crypto.randomUUID(),
      method: HttpMethod.GET,
      url: '',
      headers: [],
      params: [],
      body: { type: 'none' },
      auth: { type: 'none' },
    }
  }

  const method = (typeof req.method === 'string' ? req.method.toUpperCase() : 'GET') as HttpMethod
  const url = parseUrl(req.url)
  const params = parseParams(req.url)
  const headers = parseHeaders(req.header)
  const body = parseBody(req.body)
  const auth = parseAuth(req.auth)

  return {
    id: crypto.randomUUID(),
    method: Object.values(HttpMethod).includes(method) ? method : HttpMethod.GET,
    url,
    headers,
    params,
    body,
    auth,
  }
}

function parseUrl(url: PostmanUrl | string | undefined): string {
  if (!url) return ''
  if (typeof url === 'string') return url
  if (url.raw) return url.raw.split('?')[0]
  // Build from parts
  const protocol = url.protocol || 'https'
  const host = Array.isArray(url.host) ? url.host.join('.') : (url.host || '')
  const path = Array.isArray(url.path) ? '/' + url.path.join('/') : (url.path || '')
  return `${protocol}://${host}${path}`
}

function parseParams(url: PostmanUrl | string | undefined): KeyValuePair[] {
  if (!url || typeof url === 'string') {
    // Parse from query string
    if (typeof url === 'string' && url.includes('?')) {
      const queryStr = url.split('?')[1]
      return queryStr.split('&').map((pair) => {
        const [key, value] = pair.split('=')
        return {
          id: crypto.randomUUID(),
          key: decodeURIComponent(key || ''),
          value: decodeURIComponent(value || ''),
          enabled: true,
        }
      })
    }
    return []
  }
  return (url.query || []).map((q: PostmanQueryParam) => ({
    id: crypto.randomUUID(),
    key: q.key || '',
    value: q.value || '',
    enabled: !q.disabled,
  }))
}

function parseHeaders(headers: PostmanHeader[] | undefined): KeyValuePair[] {
  if (!headers) return []
  return headers.map((h) => ({
    id: crypto.randomUUID(),
    key: h.key || '',
    value: h.value || '',
    enabled: !h.disabled,
  }))
}

function parseBody(body: PostmanBody | undefined): RequestBody {
  if (!body || body.mode === 'none') return { type: 'none' }

  if (body.mode === 'raw') {
    const lang = body.options?.raw?.language || ''
    const isJson = lang === 'json' || (body.raw || '').trim().startsWith('{')
    return {
      type: isJson ? 'json' : 'raw',
      raw: body.raw || '',
    }
  }

  if (body.mode === 'urlencoded') {
    return {
      type: 'x-www-form-urlencoded',
      urlencoded: (body.urlencoded || []).map((p: PostmanUrlencoded) => ({
        id: crypto.randomUUID(),
        key: p.key || '',
        value: p.value || '',
        enabled: !p.disabled,
      })),
    }
  }

  if (body.mode === 'formdata') {
    const fields: FormDataField[] = (body.formdata || []).map((f: PostmanFormdata) => ({
      id: crypto.randomUUID(),
      key: f.key || '',
      value: f.value || f.src || '',
      enabled: !f.disabled,
      fieldType: f.type === 'file' ? 'file' as const : 'text' as const,
      fileName: f.src ? f.src.split('/').pop() : undefined,
    }))
    return { type: 'form-data', formData: fields }
  }

  return { type: 'none' }
}

function parseAuth(auth: PostmanAuth | undefined): AuthConfig {
  if (!auth || auth.type === 'noauth') return { type: 'none' }

  if (auth.type === 'bearer') {
    const token = findAuthValue(auth.bearer, 'token')
    return { type: 'bearer', bearer: { token } }
  }

  if (auth.type === 'basic') {
    const username = findAuthValue(auth.basic, 'username')
    const password = findAuthValue(auth.basic, 'password')
    return { type: 'basic', basic: { username, password } }
  }

  if (auth.type === 'apikey') {
    const key = findAuthValue(auth.apikey, 'key')
    const value = findAuthValue(auth.apikey, 'value')
    const addTo = findAuthValue(auth.apikey, 'in') === 'query' ? 'query' : 'header'
    return { type: 'api-key', apiKey: { key, value, addTo } }
  }

  return { type: 'none' }
}

function findAuthValue(arr: PostmanAuthParam[] | undefined, key: string): string {
  if (!arr) return ''
  const found = arr.find((p) => p.key === key)
  return found?.value || ''
}

// --- Postman types (internal, for parsing) ---

interface PostmanCollection {
  info?: { name?: string; description?: string }
  item?: PostmanItem[]
  variable?: PostmanVariable[]
}

interface PostmanItem {
  name?: string
  item?: PostmanItem[]
  request?: PostmanRequest
}

interface PostmanRequest {
  method?: string
  url?: PostmanUrl | string
  header?: PostmanHeader[]
  body?: PostmanBody
  auth?: PostmanAuth
}

interface PostmanUrl {
  raw?: string
  protocol?: string
  host?: string[] | string
  path?: string[] | string
  query?: PostmanQueryParam[]
}

interface PostmanQueryParam {
  key?: string
  value?: string
  disabled?: boolean
}

interface PostmanHeader {
  key?: string
  value?: string
  disabled?: boolean
}

interface PostmanBody {
  mode?: string
  raw?: string
  urlencoded?: PostmanUrlencoded[]
  formdata?: PostmanFormdata[]
  options?: { raw?: { language?: string } }
}

interface PostmanUrlencoded {
  key?: string
  value?: string
  disabled?: boolean
}

interface PostmanFormdata {
  key?: string
  value?: string
  src?: string
  type?: string
  disabled?: boolean
}

interface PostmanAuth {
  type?: string
  bearer?: PostmanAuthParam[]
  basic?: PostmanAuthParam[]
  apikey?: PostmanAuthParam[]
}

interface PostmanAuthParam {
  key?: string
  value?: string
}

interface PostmanVariable {
  key?: string
  value?: string
}
