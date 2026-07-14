import { HttpMethod } from '@/types/common'
import type { KeyValuePair } from '@/types/common'
import type { Collection, CollectionItem } from '@/types/collection'
import type { RequestConfig, RequestBody, AuthConfig } from '@/types/request'

/**
 * Import an OpenAPI 3.x / Swagger 2.x spec into a Snag Collection.
 * Creates folders per tag (or per path prefix), with requests for each operation.
 */
export function importOpenApiSpec(json: unknown): Collection {
  const spec = json as OpenApiSpec

  const isV3 = spec.openapi?.startsWith('3')
  const title = isV3
    ? spec.info?.title || 'OpenAPI Import'
    : (spec as SwaggerSpec).info?.title || 'Swagger Import'

  const baseUrl = resolveBaseUrl(spec)
  const items = parsePathsToItems(spec, baseUrl)

  return {
    id: crypto.randomUUID(),
    name: title,
    description: spec.info?.description || undefined,
    items,
    variables: baseUrl
      ? [{ key: 'baseUrl', value: baseUrl }]
      : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function resolveBaseUrl(spec: OpenApiSpec): string {
  // OpenAPI 3.x
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url || ''
  }
  // Swagger 2.x
  const swagger = spec as SwaggerSpec
  if (swagger.host) {
    const scheme = swagger.schemes?.[0] || 'https'
    const basePath = swagger.basePath || ''
    return `${scheme}://${swagger.host}${basePath}`
  }
  return ''
}

function parsePathsToItems(spec: OpenApiSpec, baseUrl: string): CollectionItem[] {
  const paths = spec.paths || {}
  const taggedFolders: Record<string, CollectionItem[]> = {}
  const untagged: CollectionItem[] = []

  for (const [path, methods] of Object.entries(paths)) {
    if (!methods) continue

    for (const [method, operation] of Object.entries(methods as Record<string, OpenApiOperation>)) {
      if (!isHttpMethod(method)) continue

      const op = operation as OpenApiOperation
      const tags = op.tags || []
      const item = createRequestItem(method, path, op, baseUrl, spec)

      if (tags.length > 0) {
        const tag = tags[0]
        if (!taggedFolders[tag]) taggedFolders[tag] = []
        taggedFolders[tag].push(item)
      } else {
        untagged.push(item)
      }
    }
  }

  const items: CollectionItem[] = []

  // Create folders for tags
  for (const [tag, requests] of Object.entries(taggedFolders)) {
    items.push({
      id: crypto.randomUUID(),
      type: 'folder',
      name: tag,
      items: requests,
    })
  }

  // Add untagged at root
  items.push(...untagged)

  return items
}

function createRequestItem(
  method: string,
  path: string,
  operation: OpenApiOperation,
  baseUrl: string,
  spec: OpenApiSpec
): CollectionItem {
  const httpMethod = method.toUpperCase() as HttpMethod
  const name = operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`

  // Build URL
  const url = baseUrl ? `{{baseUrl}}${path}` : path

  // Parse parameters
  const params: KeyValuePair[] = []
  const headers: KeyValuePair[] = []
  const pathParams: { key: string; value: string }[] = []

  for (const param of operation.parameters || []) {
    const resolved = resolveParam(param, spec)
    if (!resolved) continue

    if (resolved.in === 'query') {
      params.push({
        id: crypto.randomUUID(),
        key: resolved.name,
        value: String(resolved.example || resolved.schema?.example || ''),
        enabled: resolved.required || false,
      })
    } else if (resolved.in === 'header') {
      headers.push({
        id: crypto.randomUUID(),
        key: resolved.name,
        value: String(resolved.example || resolved.schema?.example || ''),
        enabled: true,
      })
    } else if (resolved.in === 'path') {
      pathParams.push({ key: resolved.name, value: resolved.example || `{${resolved.name}}` })
    }
  }

  // Build body from requestBody (OpenAPI 3.x)
  const body = parseRequestBody(operation.requestBody, spec)

  // Auth
  const auth = parseSecurityToAuth(operation.security || spec.security, spec)

  // Replace path params in URL
  let finalUrl = url
  for (const pp of pathParams) {
    finalUrl = finalUrl.replace(`{${pp.key}}`, `{{${pp.key}}}`)
  }

  const request: RequestConfig = {
    id: crypto.randomUUID(),
    method: Object.values(HttpMethod).includes(httpMethod) ? httpMethod : HttpMethod.GET,
    url: finalUrl,
    headers,
    params,
    body,
    auth,
  }

  return {
    id: crypto.randomUUID(),
    type: 'request',
    name,
    request,
  }
}

function parseRequestBody(reqBody: OpenApiRequestBody | undefined, spec: OpenApiSpec): RequestBody {
  if (!reqBody) return { type: 'none' }

  // Resolve $ref
  if (reqBody.$ref) {
    const resolved = resolveRef(reqBody.$ref, spec)
    if (resolved) return parseRequestBody(resolved as OpenApiRequestBody, spec)
  }

  const content = reqBody.content || {}

  if (content['application/json']) {
    const schema = content['application/json'].schema
    const example = content['application/json'].example
    const raw = example
      ? JSON.stringify(example, null, 2)
      : schema ? generateExampleFromSchema(schema, spec) : ''
    return { type: 'json', raw }
  }

  if (content['application/x-www-form-urlencoded']) {
    const schema = content['application/x-www-form-urlencoded'].schema
    const fields = schemaToKeyValuePairs(schema, spec)
    return { type: 'x-www-form-urlencoded', urlencoded: fields }
  }

  if (content['multipart/form-data']) {
    const schema = content['multipart/form-data'].schema
    const fields = schemaToFormDataFields(schema, spec)
    return { type: 'form-data', formData: fields }
  }

  // Fallback: raw
  const firstType = Object.keys(content)[0]
  if (firstType) {
    return { type: 'raw', raw: '' }
  }

  return { type: 'none' }
}

function parseSecurityToAuth(
  security: OpenApiSecurity[] | undefined,
  spec: OpenApiSpec
): AuthConfig {
  if (!security || security.length === 0) return { type: 'none' }

  const schemes = spec.components?.securitySchemes || (spec as SwaggerSpec).securityDefinitions || {}
  const firstScheme = Object.keys(security[0])[0]
  if (!firstScheme) return { type: 'none' }

  const scheme = schemes[firstScheme] as OpenApiSecurityScheme
  if (!scheme) return { type: 'none' }

  if (scheme.type === 'http' && scheme.scheme === 'bearer') {
    return { type: 'bearer', bearer: { token: '' } }
  }
  if (scheme.type === 'http' && scheme.scheme === 'basic') {
    return { type: 'basic', basic: { username: '', password: '' } }
  }
  if (scheme.type === 'apiKey') {
    return {
      type: 'api-key',
      apiKey: {
        key: scheme.name || 'X-API-Key',
        value: '',
        addTo: scheme.in === 'query' ? 'query' : 'header',
      },
    }
  }

  return { type: 'none' }
}

function resolveParam(param: OpenApiParam | { $ref?: string }, spec: OpenApiSpec): OpenApiParam | null {
  if ('$ref' in param && param.$ref) {
    return resolveRef(param.$ref, spec) as OpenApiParam | null
  }
  return param as OpenApiParam
}

function resolveRef(ref: string, spec: unknown): unknown {
  // #/components/schemas/Foo -> traverse the object
  const parts = ref.replace('#/', '').split('/')
  let current: unknown = spec
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return null
    }
  }
  return current
}

function generateExampleFromSchema(schema: OpenApiSchema | undefined, spec: OpenApiSpec): string {
  if (!schema) return '{}'
  const obj = schemaToExample(schema, spec, 0)
  return JSON.stringify(obj, null, 2)
}

function schemaToExample(schema: OpenApiSchema, spec: OpenApiSpec, depth: number): unknown {
  if (depth > 5) return null
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, spec) as OpenApiSchema | null
    if (resolved) return schemaToExample(resolved, spec, depth + 1)
    return null
  }

  if (schema.example !== undefined) return schema.example

  if (schema.type === 'object' || schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      obj[key] = schemaToExample(prop as OpenApiSchema, spec, depth + 1)
    }
    return obj
  }

  if (schema.type === 'array' && schema.items) {
    return [schemaToExample(schema.items as OpenApiSchema, spec, depth + 1)]
  }

  if (schema.type === 'string') return schema.enum?.[0] || 'string'
  if (schema.type === 'number' || schema.type === 'integer') return 0
  if (schema.type === 'boolean') return false

  return null
}

function schemaToKeyValuePairs(schema: OpenApiSchema | undefined, _spec: OpenApiSpec): KeyValuePair[] {
  if (!schema || !schema.properties) return []
  return Object.entries(schema.properties).map(([key, prop]) => {
    const p = prop as OpenApiSchema
    return {
      id: crypto.randomUUID(),
      key,
      value: p.example?.toString() || '',
      enabled: true,
    }
  })
}

function schemaToFormDataFields(schema: OpenApiSchema | undefined, _spec: OpenApiSpec): import('@/types/request').FormDataField[] {
  if (!schema || !schema.properties) return []
  return Object.entries(schema.properties).map(([key, prop]) => {
    const p = prop as OpenApiSchema
    const isFile = p.type === 'string' && p.format === 'binary'
    return {
      id: crypto.randomUUID(),
      key,
      value: isFile ? '' : (p.example?.toString() || ''),
      enabled: true,
      fieldType: isFile ? 'file' as const : 'text' as const,
    }
  })
}

function isHttpMethod(method: string): boolean {
  return ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method.toLowerCase())
}

// --- OpenAPI Types (internal) ---

interface OpenApiSpec {
  openapi?: string
  swagger?: string
  info?: { title?: string; description?: string }
  servers?: { url?: string }[]
  paths?: Record<string, Record<string, OpenApiOperation>>
  components?: { securitySchemes?: Record<string, OpenApiSecurityScheme>; schemas?: Record<string, OpenApiSchema> }
  security?: OpenApiSecurity[]
}

interface SwaggerSpec extends OpenApiSpec {
  host?: string
  basePath?: string
  schemes?: string[]
  securityDefinitions?: Record<string, OpenApiSecurityScheme>
}

interface OpenApiOperation {
  summary?: string
  operationId?: string
  tags?: string[]
  parameters?: (OpenApiParam | { $ref?: string })[]
  requestBody?: OpenApiRequestBody
  security?: OpenApiSecurity[]
}

interface OpenApiParam {
  name: string
  in: string
  required?: boolean
  example?: string
  schema?: OpenApiSchema
}

interface OpenApiRequestBody {
  $ref?: string
  content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>
}

interface OpenApiSchema {
  $ref?: string
  type?: string
  format?: string
  properties?: Record<string, OpenApiSchema>
  items?: OpenApiSchema
  example?: unknown
  enum?: string[]
}

interface OpenApiSecurityScheme {
  type?: string
  scheme?: string
  name?: string
  in?: string
}

type OpenApiSecurity = Record<string, string[]>
