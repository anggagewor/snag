/**
 * useGraphQL — composable for GraphQL query execution.
 *
 * Sends GraphQL queries as HTTP POST requests to the configured endpoint.
 * Parses response into data/errors structure.
 * Reuses the same Tauri HTTP plugin / browser fetch pattern as useHttp.
 */

import { ref } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { logAndNotify } from '@/services/logAndNotify'
import type { GraphQLConfig, GraphQLResponseData } from '@/domain'
import type { RequestAuthDraft } from '@/domain'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function doFetch(url: string, init: RequestInit & { dangerAcceptInvalidCerts?: boolean }): Promise<Response> {
  if (isTauri) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(url, init as Parameters<typeof tauriFetch>[1])
  }
  return globalThis.fetch(url, init)
}

// ─── Introspection Types ──────────────────────────────────────────

export interface IntrospectionField {
  readonly name: string
  readonly description: string | null
  readonly type: string
  readonly args: readonly { name: string; type: string }[]
}

export interface IntrospectionType {
  readonly name: string
  readonly kind: string
  readonly description: string | null
  readonly fields: readonly IntrospectionField[]
}

export interface IntrospectionSchema {
  readonly queryType: string | null
  readonly mutationType: string | null
  readonly subscriptionType: string | null
  readonly types: readonly IntrospectionType[]
}

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        name
        kind
        description
        fields(includeDeprecated: true) {
          name
          description
          type {
            name
            kind
            ofType { name kind ofType { name kind ofType { name kind } } }
          }
          args {
            name
            type {
              name
              kind
              ofType { name kind ofType { name kind ofType { name kind } } }
            }
          }
        }
      }
    }
  }
`

function resolveTypeName(typeObj: Record<string, unknown>): string {
  if (!typeObj) return 'Unknown'
  const kind = typeObj.kind as string
  const name = typeObj.name as string | null
  const ofType = typeObj.ofType as Record<string, unknown> | null

  if (kind === 'NON_NULL') return `${resolveTypeName(ofType!)}!`
  if (kind === 'LIST') return `[${resolveTypeName(ofType!)}]`
  return name ?? 'Unknown'
}

function parseIntrospectionResult(raw: Record<string, unknown>): IntrospectionSchema {
  const rawTypes = (raw.types ?? []) as Record<string, unknown>[]
  const queryType = raw.queryType as { name: string } | null
  const mutationType = raw.mutationType as { name: string } | null
  const subscriptionType = raw.subscriptionType as { name: string } | null

  const types: IntrospectionType[] = rawTypes
    .filter((t) => {
      const name = t.name as string
      return !name.startsWith('__')
    })
    .map((t) => {
      const rawFields = (t.fields ?? []) as Record<string, unknown>[]
      const fields: IntrospectionField[] = rawFields.map((f) => ({
        name: f.name as string,
        description: (f.description as string | null) ?? null,
        type: resolveTypeName(f.type as Record<string, unknown>),
        args: ((f.args ?? []) as Record<string, unknown>[]).map((a) => ({
          name: a.name as string,
          type: resolveTypeName(a.type as Record<string, unknown>),
        })),
      }))

      return {
        name: t.name as string,
        kind: t.kind as string,
        description: (t.description as string | null) ?? null,
        fields,
      }
    })

  return {
    queryType: queryType?.name ?? null,
    mutationType: mutationType?.name ?? null,
    subscriptionType: subscriptionType?.name ?? null,
    types,
  }
}

// ─── Composable ───────────────────────────────────────────────────

export function useGraphQL() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  function resolve(str: string, collectionVariables?: { key: string; value: string }[]): string {
    const workspaceStore = useWorkspaceStore()
    return workspaceStore.resolveVariablesInString(str, collectionVariables)
  }

  function buildAuthHeaders(auth: RequestAuthDraft, collectionVariables?: { key: string; value: string }[]): Record<string, string> {
    const headers: Record<string, string> = {}

    if (auth.type === 'bearer' && auth.bearer) {
      headers['Authorization'] = `Bearer ${resolve(auth.bearer.token, collectionVariables)}`
    } else if (auth.type === 'basic' && auth.basic) {
      const credentials = `${resolve(auth.basic.username, collectionVariables)}:${resolve(auth.basic.password, collectionVariables)}`
      const encoded = btoa(String.fromCodePoint(...new TextEncoder().encode(credentials)))
      headers['Authorization'] = `Basic ${encoded}`
    } else if (auth.type === 'apikey' && auth.apiKey?.in === 'header') {
      headers[resolve(auth.apiKey.key, collectionVariables)] = resolve(auth.apiKey.value, collectionVariables)
    }

    return headers
  }

  async function executeQuery(
    config: GraphQLConfig,
    auth: RequestAuthDraft,
    collectionVariables?: { key: string; value: string }[],
  ): Promise<GraphQLResponseData | null> {
    if (abortController) {
      abortController.abort()
    }

    const controller = new AbortController()
    abortController = controller

    isLoading.value = true
    error.value = null

    const settingsStore = useSettingsStore()
    const timeoutMs = (settingsStore.settings.timeout ?? 30) * 1000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const startTime = performance.now()
    const resolvedUrl = resolve(config.url, collectionVariables)

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add config headers
      for (const h of config.headers) {
        if (h.enabled && h.key) {
          headers[resolve(h.key, collectionVariables)] = resolve(h.value, collectionVariables)
        }
      }

      // Add auth headers
      const authHeaders = buildAuthHeaders(auth, collectionVariables)
      Object.assign(headers, authHeaders)

      // Add api-key to URL if configured as query param
      let finalUrl = resolvedUrl
      if (auth.type === 'apikey' && auth.apiKey?.in === 'query') {
        const separator = finalUrl.includes('?') ? '&' : '?'
        finalUrl += `${separator}${encodeURIComponent(resolve(auth.apiKey.key, collectionVariables))}=${encodeURIComponent(resolve(auth.apiKey.value, collectionVariables))}`
      }

      // Build GraphQL body
      const body: Record<string, unknown> = {
        query: resolve(config.query, collectionVariables),
      }

      if (config.variables) {
        try {
          const resolved = resolve(config.variables, collectionVariables)
          body.variables = JSON.parse(resolved)
        } catch {
          // Variables is not valid JSON — send as-is string (server will likely error)
          body.variables = config.variables
        }
      }

      if (config.operationName) {
        body.operationName = resolve(config.operationName, collectionVariables)
      }

      const response = await doFetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        dangerAcceptInvalidCerts: !(settingsStore.settings.validateSsl ?? true),
      })

      const endTime = performance.now()
      const responseBody = await response.text()

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Parse GraphQL response
      let data: unknown = undefined
      let errors: GraphQLResponseData['errors'] = undefined
      try {
        const parsed = JSON.parse(responseBody)
        data = parsed.data
        errors = parsed.errors
      } catch {
        // Response is not JSON — body remains as raw text
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        data,
        errors,
        size: new Blob([responseBody]).size,
        time: Math.round(endTime - startTime),
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        error.value = `Request timed out after ${settingsStore.settings.timeout}s`
        logAndNotify('useGraphQL', error.value, { url: resolvedUrl }, { type: 'warn' })
      } else if (err instanceof Error) {
        error.value = err.message
        logAndNotify('useGraphQL', err.message, { url: resolvedUrl }, { type: 'error' })
      } else {
        error.value = String(err)
        logAndNotify('useGraphQL', String(err), { url: resolvedUrl }, { type: 'error' })
      }
      return null
    } finally {
      clearTimeout(timeoutId)
      if (abortController === controller) {
        abortController = null
      }
      isLoading.value = false
    }
  }

  function cancelQuery(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
      isLoading.value = false
      error.value = 'Query cancelled'
    }
  }

  // ─── Schema Introspection ───────────────────────────────────────

  const isIntrospecting = ref(false)
  const schema = ref<IntrospectionSchema | null>(null)
  const introspectionError = ref<string | null>(null)

  async function introspect(
    url: string,
    auth: RequestAuthDraft,
    configHeaders: { key: string; value: string; enabled: boolean }[],
    collectionVariables?: { key: string; value: string }[],
  ): Promise<IntrospectionSchema | null> {
    isIntrospecting.value = true
    introspectionError.value = null

    const settingsStore = useSettingsStore()
    const resolvedUrl = resolve(url, collectionVariables)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      for (const h of configHeaders) {
        if (h.enabled && h.key) {
          headers[resolve(h.key, collectionVariables)] = resolve(h.value, collectionVariables)
        }
      }

      const authHeaders = buildAuthHeaders(auth, collectionVariables)
      Object.assign(headers, authHeaders)

      let finalUrl = resolvedUrl
      if (auth.type === 'apikey' && auth.apiKey?.in === 'query') {
        const separator = finalUrl.includes('?') ? '&' : '?'
        finalUrl += `${separator}${encodeURIComponent(resolve(auth.apiKey.key, collectionVariables))}=${encodeURIComponent(resolve(auth.apiKey.value, collectionVariables))}`
      }

      const response = await doFetch(finalUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: INTROSPECTION_QUERY }),
        dangerAcceptInvalidCerts: !(settingsStore.settings.validateSsl ?? true),
      })

      const text = await response.text()
      const parsed = JSON.parse(text)

      if (parsed.errors) {
        introspectionError.value = parsed.errors.map((e: { message: string }) => e.message).join(', ')
        return null
      }

      const rawSchema = parsed.data?.__schema
      if (!rawSchema) {
        introspectionError.value = 'No schema data in response'
        return null
      }

      schema.value = parseIntrospectionResult(rawSchema)
      return schema.value
    } catch (err) {
      introspectionError.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      isIntrospecting.value = false
    }
  }

  return {
    isLoading,
    error,
    executeQuery,
    cancelQuery,
    isIntrospecting,
    schema,
    introspectionError,
    introspect,
  }
}
