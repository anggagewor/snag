import { ref } from 'vue'

import { useEnvironmentsStore } from '@/stores/environments'
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

  function resolve(str: string): string {
    const envStore = useEnvironmentsStore()
    return envStore.resolveVariablesInString(str)
  }

  function buildUrl(url: string, params: KeyValuePair[]): string {
    const resolvedUrl = resolve(url)
    const enabledParams = params.filter((p) => p.enabled && p.key)
    if (enabledParams.length === 0) return resolvedUrl

    const separator = resolvedUrl.includes('?') ? '&' : '?'
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(resolve(p.key))}=${encodeURIComponent(resolve(p.value))}`)
      .join('&')

    return `${resolvedUrl}${separator}${queryString}`
  }

  function buildHeaders(request: RequestConfig): Record<string, string> {
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
        headers[resolve(h.key)] = resolve(h.value)
      })

    // Add auth headers
    if (request.auth.type === 'bearer' && request.auth.bearer) {
      headers['Authorization'] = `Bearer ${resolve(request.auth.bearer.token)}`
    } else if (request.auth.type === 'basic' && request.auth.basic) {
      const encoded = btoa(`${resolve(request.auth.basic.username)}:${resolve(request.auth.basic.password)}`)
      headers['Authorization'] = `Basic ${encoded}`
    } else if (request.auth.type === 'api-key' && request.auth.apiKey?.addTo === 'header') {
      headers[resolve(request.auth.apiKey.key)] = resolve(request.auth.apiKey.value)
    }

    return headers
  }

  async function buildBody(request: RequestConfig): Promise<BodyInit | undefined> {
    const { body } = request

    if (body.type === 'none') return undefined
    if (body.type === 'json' || body.type === 'raw') return resolve(body.raw || '') || undefined

    if (body.type === 'x-www-form-urlencoded') {
      const params = (body.urlencoded || [])
        .filter((p) => p.enabled && p.key)
        .map((p) => `${encodeURIComponent(resolve(p.key))}=${encodeURIComponent(resolve(p.value))}`)
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
          formData.append(resolve(field.key), blob, fileName)
        } else if (field.fieldType === 'text') {
          formData.append(resolve(field.key), resolve(field.value))
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

  async function sendRequest(request: RequestConfig): Promise<ResponseData | null> {
    isLoading.value = true
    error.value = null

    const startTime = performance.now()

    try {
      const url = buildUrl(request.url, request.params)

      // Add api-key to query if configured
      let finalUrl = url
      if (request.auth.type === 'api-key' && request.auth.apiKey?.addTo === 'query') {
        const separator = finalUrl.includes('?') ? '&' : '?'
        finalUrl += `${separator}${encodeURIComponent(resolve(request.auth.apiKey.key))}=${encodeURIComponent(resolve(request.auth.apiKey.value))}`
      }

      const headers = buildHeaders(request)
      const body = await buildBody(request)
      const settingsStore = useSettingsStore()

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
      error.value = err instanceof Error ? err.message : 'Request failed'
      console.error('[useHttp] Request error:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    sendRequest,
  }
}
