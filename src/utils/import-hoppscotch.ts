import type { HttpMethod } from '@/domain'
import type {
  ImportedCollection,
  ImportedCollectionItem,
  ImportedRequest,
  ImportedRequestBody,
  ImportedRequestAuth,
} from '@/utils/import-postman'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/**
 * Import a Hoppscotch Collection JSON into Snag's intermediate format.
 * Supports nested folders, requests with headers/params/body/auth, and pre-request/test scripts.
 * Converts Hoppscotch variable syntax `<<var>>` to Snag/Postman syntax `{{var}}`.
 */
export function importHoppscotchCollection(json: unknown): ImportedCollection {
  const data = json as HoppCollection

  return {
    id: crypto.randomUUID(),
    name: data.name || 'Imported Collection',
    items: parseItems(data),
    variables: (data.variables || []).map((v) => ({
      key: v.key || '',
      value: v.value || '',
    })),
  }
}

/**
 * Detect whether a parsed JSON object looks like a Hoppscotch collection.
 */
export function isHoppscotchCollection(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false
  const obj = json as Record<string, unknown>
  return (
    typeof obj.v === 'number' &&
    Array.isArray(obj.folders) &&
    Array.isArray(obj.requests)
  )
}

function parseItems(collection: HoppCollection): ImportedCollectionItem[] {
  const items: ImportedCollectionItem[] = []

  // Folders first
  for (const folder of collection.folders || []) {
    items.push({
      id: folder.id || crypto.randomUUID(),
      type: 'folder',
      name: folder.name || 'Unnamed Folder',
      items: parseItems(folder),
    })
  }

  // Then requests
  for (const req of collection.requests || []) {
    items.push({
      id: req.id || crypto.randomUUID(),
      type: 'request',
      name: req.name || 'Unnamed Request',
      request: parseRequest(req),
    })
  }

  return items
}

function parseRequest(req: HoppRequest): ImportedRequest {
  const method = (req.method?.toUpperCase() || 'GET') as HttpMethod

  return {
    method: HTTP_METHODS.includes(method) ? method : 'GET',
    url: convertVariables(req.endpoint || ''),
    headers: parseHeaders(req.headers),
    params: parseParams(req.params),
    pathParams: parseRequestVariables(req.requestVariables),
    body: parseBody(req.body),
    auth: parseAuth(req.auth),
    preRequest: convertScriptApi(req.preRequestScript || ''),
    tests: convertScriptApi(req.testScript || ''),
  }
}

function parseHeaders(headers: HoppHeader[] | undefined): { key: string; value: string; enabled: boolean }[] {
  if (!headers) return []
  return headers.map((h) => ({
    key: h.key || '',
    value: convertVariables(h.value || ''),
    enabled: h.active ?? true,
  }))
}

function parseParams(params: HoppParam[] | undefined): { key: string; value: string; enabled: boolean }[] {
  if (!params) return []
  return params.map((p) => ({
    key: p.key || '',
    value: convertVariables(p.value || ''),
    enabled: p.active ?? true,
  }))
}

function parseRequestVariables(vars: HoppRequestVariable[] | undefined): { key: string; value: string }[] {
  if (!vars) return []
  return vars
    .filter((v) => v.active && v.key)
    .map((v) => ({
      key: v.key || '',
      value: convertVariables(v.value || ''),
    }))
}

function parseBody(body: HoppBody | undefined): ImportedRequestBody {
  if (!body || !body.contentType) return { type: 'none', content: '' }

  const contentType = body.contentType

  if (contentType === 'application/json') {
    return {
      type: 'json',
      content: convertVariables(typeof body.body === 'string' ? body.body : ''),
    }
  }

  if (contentType === 'application/xml' || contentType === 'text/xml') {
    return {
      type: 'xml',
      content: convertVariables(typeof body.body === 'string' ? body.body : ''),
    }
  }

  if (contentType === 'text/plain') {
    return {
      type: 'text',
      content: convertVariables(typeof body.body === 'string' ? body.body : ''),
    }
  }

  if (contentType === 'multipart/form-data') {
    const fields = Array.isArray(body.body) ? body.body : []
    return {
      type: 'formdata',
      content: '',
      formData: fields.map((f: HoppFormDataField) => ({
        key: f.key || '',
        value: convertVariables(f.value || ''),
        enabled: f.active ?? true,
        fieldType: f.isFile ? 'file' as const : 'text' as const,
      })),
    }
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    const fields = Array.isArray(body.body) ? body.body : []
    return {
      type: 'urlencoded',
      content: '',
      formData: fields.map((f: HoppFormDataField) => ({
        key: f.key || '',
        value: convertVariables(f.value || ''),
        enabled: f.active ?? true,
      })),
    }
  }

  // Fallback: treat as raw text
  return {
    type: 'text',
    content: convertVariables(typeof body.body === 'string' ? body.body : ''),
  }
}

function parseAuth(auth: HoppAuth | undefined): ImportedRequestAuth {
  if (!auth || !auth.authActive || auth.authType === 'none' || auth.authType === 'inherit') {
    return { type: 'none' }
  }

  if (auth.authType === 'bearer') {
    return {
      type: 'bearer',
      bearer: { token: convertVariables(auth.token || '') },
    }
  }

  if (auth.authType === 'basic') {
    return {
      type: 'basic',
      basic: {
        username: convertVariables(auth.username || ''),
        password: convertVariables(auth.password || ''),
      },
    }
  }

  if (auth.authType === 'api-key') {
    return {
      type: 'apikey',
      apiKey: {
        key: auth.key || '',
        value: convertVariables(auth.value || ''),
        in: auth.addTo === 'QUERY_PARAMS' ? 'query' : 'header',
      },
    }
  }

  return { type: 'none' }
}

/**
 * Convert Hoppscotch variable syntax `<<var>>` to Snag syntax `{{var}}`.
 */
function convertVariables(str: string): string {
  return str.replace(/<<([^>]+)>>/g, '{{$1}}')
}

/**
 * Convert Hoppscotch script API (`pw.*`) to Snag script API (`snag.*`).
 * Basic mapping — covers the most common patterns.
 */
function convertScriptApi(script: string): string {
  if (!script) return ''
  return script
    .replace(/pw\.env\.set\(/g, 'snag.variables.set(')
    .replace(/pw\.env\.get\(/g, 'snag.variables.get(')
    .replace(/pw\.response\.status/g, 'snag.response.status')
    .replace(/pw\.response\.body/g, 'snag.response.body')
    .replace(/pw\.response\.headers/g, 'snag.response.headers')
    .replace(/pw\.test\(/g, 'snag.test(')
    .replace(/pw\.expect\(/g, 'snag.expect(')
}

// --- Hoppscotch types (internal, for parsing) ---

interface HoppCollection {
  v?: number
  id?: string
  name?: string
  folders?: HoppCollection[]
  requests?: HoppRequest[]
  auth?: HoppAuth
  headers?: HoppHeader[]
  variables?: { key: string; value: string }[]
}

interface HoppRequest {
  v?: string
  id?: string
  name?: string
  method?: string
  endpoint?: string
  params?: HoppParam[]
  headers?: HoppHeader[]
  preRequestScript?: string
  testScript?: string
  auth?: HoppAuth
  body?: HoppBody
  requestVariables?: HoppRequestVariable[]
}

interface HoppHeader {
  key?: string
  value?: string
  active?: boolean
  description?: string
}

interface HoppParam {
  key?: string
  value?: string
  active?: boolean
  description?: string
}

interface HoppRequestVariable {
  key?: string
  value?: string
  active?: boolean
}

interface HoppBody {
  contentType?: string | null
  body?: string | HoppFormDataField[] | null
}

interface HoppFormDataField {
  key?: string
  value?: string
  active?: boolean
  isFile?: boolean
}

interface HoppAuth {
  authType?: string
  authActive?: boolean
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  addTo?: string
}
