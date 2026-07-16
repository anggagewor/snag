import type { HttpMethod } from '@/domain'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/**
 * Imported collection item — intermediate format used by ImportModal
 * to create requests in the workspace.
 */
export interface ImportedCollectionItem {
  id: string
  type: 'request' | 'folder'
  name: string
  items?: ImportedCollectionItem[]
  request?: ImportedRequest
}

export interface ImportedRequest {
  method: HttpMethod
  url: string
  headers: { key: string; value: string; enabled: boolean }[]
  params: { key: string; value: string; enabled: boolean }[]
  pathParams: { key: string; value: string }[]
  body: ImportedRequestBody
  auth: ImportedRequestAuth
  preRequest: string
  tests: string
}

export interface ImportedRequestBody {
  type: 'none' | 'json' | 'text' | 'xml' | 'formdata' | 'urlencoded' | 'binary' | 'graphql'
  content: string
  formData?: { key: string; value: string; enabled: boolean; fieldType?: 'text' | 'file'; fileName?: string }[]
  binaryPath?: string
}

export interface ImportedRequestAuth {
  type: 'none' | 'basic' | 'bearer' | 'apikey'
  basic?: { username: string; password: string }
  bearer?: { token: string }
  apiKey?: { key: string; value: string; in: 'header' | 'query' }
}

export interface ImportedCollection {
  id: string
  name: string
  description?: string
  items: ImportedCollectionItem[]
  variables?: { key: string; value: string }[]
}

/**
 * Import a Postman Collection v2.1 JSON file into Snag Collection format.
 * Supports: folders, requests, headers, params, body (raw/json/formdata/urlencoded), auth (bearer/basic/apikey).
 */
export function importPostmanCollection(json: unknown): ImportedCollection {
  const data = json as PostmanCollection
  const info = data.info || {}

  return {
    id: crypto.randomUUID(),
    name: info.name || 'Imported Collection',
    description: info.description || undefined,
    items: parseItems(data.item || []),
    variables: (data.variable || []).map((v: PostmanVariable) => ({
      key: v.key || '',
      value: v.value || '',
    })),
  }
}

function parseItems(items: PostmanItem[]): ImportedCollectionItem[] {
  return items.map((item) => {
    // Folder: has sub-items array (even if empty — empty folders are valid)
    if (item.item && Array.isArray(item.item)) {
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

function parseRequest(req: PostmanRequest | undefined): ImportedRequest {
  if (!req) {
    return {
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      pathParams: [],
      body: { type: 'none', content: '' },
      auth: { type: 'none' },
      preRequest: '',
      tests: '',
    }
  }

  const method = (typeof req.method === 'string' ? req.method.toUpperCase() : 'GET') as HttpMethod
  const url = parseUrl(req.url)
  const params = parseParams(req.url)
  const headers = parseHeaders(req.header)
  const body = parseBody(req.body)
  const auth = parseAuth(req.auth)

  return {
    method: HTTP_METHODS.includes(method) ? method : 'GET',
    url,
    headers,
    params,
    pathParams: [],
    body,
    auth,
    preRequest: '',
    tests: '',
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

function parseParams(url: PostmanUrl | string | undefined): { key: string; value: string; enabled: boolean }[] {
  if (!url || typeof url === 'string') {
    // Parse from query string
    if (typeof url === 'string' && url.includes('?')) {
      const queryStr = url.split('?')[1]
      return queryStr.split('&').map((pair) => {
        const [key, value] = pair.split('=')
        return {
          key: decodeURIComponent(key || ''),
          value: decodeURIComponent(value || ''),
          enabled: true,
        }
      })
    }
    return []
  }
  return (url.query || []).map((q: PostmanQueryParam) => ({
    key: q.key || '',
    value: q.value || '',
    enabled: !q.disabled,
  }))
}

function parseHeaders(headers: PostmanHeader[] | undefined): { key: string; value: string; enabled: boolean }[] {
  if (!headers) return []
  return headers.map((h) => ({
    key: h.key || '',
    value: h.value || '',
    enabled: !h.disabled,
  }))
}

function parseBody(body: PostmanBody | undefined): ImportedRequestBody {
  if (!body || body.mode === 'none') return { type: 'none', content: '' }

  if (body.mode === 'raw') {
    const lang = body.options?.raw?.language || ''
    const isJson = lang === 'json' || (body.raw || '').trim().startsWith('{')
    return {
      type: isJson ? 'json' : 'text',
      content: body.raw || '',
    }
  }

  if (body.mode === 'urlencoded') {
    return {
      type: 'urlencoded',
      content: '',
      formData: (body.urlencoded || []).map((p: PostmanUrlencoded) => ({
        key: p.key || '',
        value: p.value || '',
        enabled: !p.disabled,
      })),
    }
  }

  if (body.mode === 'formdata') {
    const fields = (body.formdata || []).map((f: PostmanFormdata) => ({
      key: f.key || '',
      value: f.value || f.src || '',
      enabled: !f.disabled,
      fieldType: f.type === 'file' ? 'file' as const : 'text' as const,
      fileName: f.src ? f.src.split('/').pop() : undefined,
    }))
    return { type: 'formdata', content: '', formData: fields }
  }

  return { type: 'none', content: '' }
}

function parseAuth(auth: PostmanAuth | undefined): ImportedRequestAuth {
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
    return { type: 'apikey', apiKey: { key, value, in: addTo } }
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
