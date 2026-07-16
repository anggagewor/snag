import { ref } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import type { RequestConfig, ResponseData } from '@/types/request'
import type { KeyValuePair } from '@/types/common'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function doFetch(url: string, init: RequestInit & { dangerAcceptInvalidCerts?: boolean }): Promise<Response> {
  if (isTauri) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(url, init as Parameters<typeof tauriFetch>[1])
  }
  return globalThis.fetch(url, init)
}

export function useHttp() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  function resolve(str: string, collectionVariables?: { key: string; value: string }[]): string {
    const workspaceStore = useWorkspaceStore()
    return workspaceStore.resolveVariablesInString(str, collectionVariables)
  }

  function buildUrl(url: string, params: KeyValuePair[], collectionVariables?: { key: string; value: string }[]): string {
    const resolvedUrl = resolve(url, collectionVariables)
    const enabledParams = params.filter((p) => p.enabled && p.key)
    if (enabledParams.length === 0) return resolvedUrl

    const separator = resolvedUrl.includes('?') ? '&' : '?'
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(resolve(p.key, collectionVariables))}=${encodeURIComponent(resolve(p.value, collectionVariables))}`)
      .join('&')

    return `${resolvedUrl}${separator}${queryString}`
  }

  function buildHeaders(request: RequestConfig, collectionVariables?: { key: string; value: string }[]): Record<string, string> {
    const headers: Record<string, string> = {}
    const settingsStore = useSettingsStore()

    // Add default headers (from settings)
    settingsStore.settings.defaultHeaders
      .filter((h) => h.enabled)
      .forEach((h) => {
        headers[h.key] = h.value
      })

    // Add snag-token (like postman-token)
    headers['Snag-Token'] = crypto.randomUUID()

    // Add user-defined headers (override defaults if same key)
    request.headers
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        headers[resolve(h.key, collectionVariables)] = resolve(h.value, collectionVariables)
      })

    // Add auth headers
    if (request.auth.type === 'bearer' && request.auth.bearer) {
      headers['Authorization'] = `Bearer ${resolve(request.auth.bearer.token, collectionVariables)}`
    } else if (request.auth.type === 'basic' && request.auth.basic) {
      const encoded = btoa(`${resolve(request.auth.basic.username, collectionVariables)}:${resolve(request.auth.basic.password, collectionVariables)}`)
      headers['Authorization'] = `Basic ${encoded}`
    } else if (request.auth.type === 'api-key' && request.auth.apiKey?.addTo === 'header') {
      headers[resolve(request.auth.apiKey.key, collectionVariables)] = resolve(request.auth.apiKey.value, collectionVariables)
    }

    return headers
  }

  async function buildBody(request: RequestConfig, collectionVariables?: { key: string; value: string }[]): Promise<BodyInit | undefined> {
    const { body } = request

    if (body.type === 'none') return undefined
    if (body.type === 'json' || body.type === 'raw') return resolve(body.raw || '', collectionVariables) || undefined

    if (body.type === 'x-www-form-urlencoded') {
      const params = (body.urlencoded || [])
        .filter((p) => p.enabled && p.key)
        .map((p) => `${encodeURIComponent(resolve(p.key, collectionVariables))}=${encodeURIComponent(resolve(p.value, collectionVariables))}`)
        .join('&')
      return params || undefined
    }

    const needsFileRead = (body.type === 'form-data' && body.formData?.some((f) => f.enabled && f.fieldType === 'file' && f.value))
      || (body.type === 'binary' && body.binary)

    let readFile: ((path: string) => Promise<Uint8Array>) | null = null
    if (needsFileRead && isTauri) {
      const fs = await import('@tauri-apps/plugin-fs')
      readFile = fs.readFile
    }

    if (body.type === 'form-data') {
      const formData = new FormData()
      const fields = body.formData || []

      for (const field of fields) {
        if (!field.enabled || !field.key) continue

        if (field.fieldType === 'file' && field.value && readFile) {
          const fileBytes = await readFile(field.value)
          const fileName = field.fileName || field.value.split('/').pop() || 'file'
          const blob = new Blob([fileBytes])
          formData.append(resolve(field.key, collectionVariables), blob, fileName)
        } else if (field.fieldType === 'text') {
          formData.append(resolve(field.key, collectionVariables), resolve(field.value, collectionVariables))
        }
      }

      return formData
    }

    if (body.type === 'binary' && body.binary && readFile) {
      const fileBytes = await readFile(body.binary)
      return new Blob([fileBytes])
    }

    return undefined
  }

  async function sendRequest(request: RequestConfig, collectionVariables?: { key: string; value: string }[]): Promise<ResponseData | null> {
    // Abort any in-flight request
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    const { signal } = abortController

    isLoading.value = true
    error.value = null

    const settingsStore = useSettingsStore()
    const timeoutMs = settingsStore.settings.timeout * 1000
    const timeoutId = setTimeout(() => abortController?.abort(), timeoutMs)

    const startTime = performance.now()

    try {
      // Resolve path params (:paramName → value) before building URL
      let urlWithPathParams = request.url
      if (request.pathParams && request.pathParams.length > 0) {
        for (const param of request.pathParams) {
          if (param.value) {
            urlWithPathParams = urlWithPathParams.replace(
              new RegExp(`:${param.key}\\b`, 'g'),
              resolve(param.value, collectionVariables)
            )
          }
        }
      }

      const url = buildUrl(urlWithPathParams, request.params, collectionVariables)

      // Add api-key to query if configured
      let finalUrl = url
      if (request.auth.type === 'api-key' && request.auth.apiKey?.addTo === 'query') {
        const separator = finalUrl.includes('?') ? '&' : '?'
        finalUrl += `${separator}${encodeURIComponent(resolve(request.auth.apiKey.key, collectionVariables))}=${encodeURIComponent(resolve(request.auth.apiKey.value, collectionVariables))}`
      }

      const headers = buildHeaders(request, collectionVariables)
      const body = await buildBody(request, collectionVariables)

      // Set content-type for JSON
      if (request.body.type === 'json' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      } else if (request.body.type === 'x-www-form-urlencoded' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      // Note: Don't set Content-Type for form-data — browser/fetch sets it with boundary

      const response = await doFetch(finalUrl, {
        method: request.method,
        headers,
        body: body as BodyInit | undefined,
        signal,
        dangerAcceptInvalidCerts: !settingsStore.settings.verifySSL,
      })

      const endTime = performance.now()
      const responseBody = await response.text()

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        size: new Blob([responseBody]).size,
        time: Math.round(endTime - startTime),
        requestHeaders: { ...headers },
        requestUrl: finalUrl,
        requestMethod: request.method,
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        error.value = `Request timed out after ${settingsStore.settings.timeout}s`
      } else if (err instanceof Error) {
        const msg = err.message || String(err)

        // Detect SSL/certificate errors and give actionable hint
        const isSslError = /certificate|ssl|tls|self.signed|invalid.*cert/i.test(msg)
        if (isSslError && settingsStore.settings.verifySSL) {
          error.value = `SSL certificate error: ${msg}\n\nHint: If using a local/self-signed cert, disable "Verify SSL" in Settings.`
        } else {
          error.value = msg
        }
      } else {
        error.value = `Request failed: ${String(err)}`
      }
      console.error('[useHttp] Request error:', err)
      return null
    } finally {
      clearTimeout(timeoutId)
      abortController = null
      isLoading.value = false
    }
  }

  function cancelRequest() {
    if (abortController) {
      abortController.abort()
      abortController = null
      isLoading.value = false
      error.value = 'Request cancelled'
    }
  }

  return {
    isLoading,
    error,
    sendRequest,
    cancelRequest,
  }
}
