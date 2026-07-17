import { ref } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { logAndNotify } from '@/services/logAndNotify'
import type { ResponseData } from '@/domain'
import type { RequestDraft, KeyValuePairEditable } from '@/domain'

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
  let activeTimeoutId: ReturnType<typeof setTimeout> | null = null

  function resolve(str: string, collectionVariables?: { key: string; value: string }[]): string {
    const workspaceStore = useWorkspaceStore()
    return workspaceStore.resolveVariablesInString(str, collectionVariables)
  }

  function buildUrl(url: string, params: KeyValuePairEditable[], collectionVariables?: { key: string; value: string }[]): string {
    const resolvedUrl = resolve(url, collectionVariables)
    const enabledParams = params.filter((p) => p.enabled && p.key)
    if (enabledParams.length === 0) return resolvedUrl

    const separator = resolvedUrl.includes('?') ? '&' : '?'
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(resolve(p.key, collectionVariables))}=${encodeURIComponent(resolve(p.value, collectionVariables))}`)
      .join('&')

    return `${resolvedUrl}${separator}${queryString}`
  }

  function buildHeaders(request: RequestDraft, collectionVariables?: { key: string; value: string }[]): Record<string, string> {
    const headers: Record<string, string> = {}
    const settingsStore = useSettingsStore()

    // Add default headers (from settings)
    if (settingsStore.settings.defaultHeaders) {
      settingsStore.settings.defaultHeaders
        .forEach((h) => {
          headers[h.key] = h.value
        })
    }

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
      const credentials = `${resolve(request.auth.basic.username, collectionVariables)}:${resolve(request.auth.basic.password, collectionVariables)}`
      const encoded = btoa(String.fromCodePoint(...new TextEncoder().encode(credentials)))
      headers['Authorization'] = `Basic ${encoded}`
    } else if (request.auth.type === 'apikey' && request.auth.apiKey?.in === 'header') {
      headers[resolve(request.auth.apiKey.key, collectionVariables)] = resolve(request.auth.apiKey.value, collectionVariables)
    }

    return headers
  }

  async function buildBody(request: RequestDraft, collectionVariables?: { key: string; value: string }[]): Promise<BodyInit | undefined> {
    const { body } = request

    if (body.type === 'none') return undefined
    if (body.type === 'json' || body.type === 'text' || body.type === 'xml' || body.type === 'graphql') {
      return resolve(body.content || '', collectionVariables) || undefined
    }

    if (body.type === 'urlencoded') {
      const params = (body.formData || [])
        .filter((p) => p.enabled && p.key)
        .map((p) => `${encodeURIComponent(resolve(p.key, collectionVariables))}=${encodeURIComponent(resolve(p.value, collectionVariables))}`)
        .join('&')
      return params || undefined
    }

    const needsFileRead = (body.type === 'formdata' && body.formData?.some((f) => f.enabled && f.value))
      || (body.type === 'binary' && body.binaryPath)

    let readFile: ((path: string) => Promise<Uint8Array>) | null = null
    if (needsFileRead && isTauri) {
      const fs = await import('@tauri-apps/plugin-fs')
      readFile = fs.readFile
    }

    if (body.type === 'formdata') {
      const formData = new FormData()
      const fields = body.formData || []

      for (const field of fields) {
        if (!field.enabled || !field.key) continue
        formData.append(resolve(field.key, collectionVariables), resolve(field.value, collectionVariables))
      }

      return formData
    }

    if (body.type === 'binary' && body.binaryPath && readFile) {
      const fileBytes = await readFile(body.binaryPath)
      return new Blob([fileBytes as BlobPart])
    }

    return undefined
  }

  async function sendRequest(request: RequestDraft, collectionVariables?: { key: string; value: string }[]): Promise<ResponseData | null> {
    // Abort any in-flight request and clear its timeout
    if (abortController) {
      abortController.abort()
    }
    if (activeTimeoutId !== null) {
      clearTimeout(activeTimeoutId)
      activeTimeoutId = null
    }

    const controller = new AbortController()
    abortController = controller
    const { signal } = controller

    isLoading.value = true
    error.value = null

    const settingsStore = useSettingsStore()
    const timeoutMs = (settingsStore.settings.timeout ?? 30) * 1000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    activeTimeoutId = timeoutId

    const startTime = performance.now()

    let finalUrl = ''

    try {
      // Resolve path parameters (:param → value) before building the full URL
      let requestUrl = request.url
      if (request.pathParams?.length) {
        for (const param of request.pathParams) {
          if (param.enabled && param.key && param.value) {
            const resolvedValue = resolve(param.value, collectionVariables)
            requestUrl = requestUrl.replace(
              new RegExp(`:${param.key}\\b`, 'g'),
              encodeURIComponent(resolvedValue)
            )
          }
        }
      }

      const url = buildUrl(requestUrl, request.params, collectionVariables)

      // Add api-key to query if configured
      finalUrl = url
      if (request.auth.type === 'apikey' && request.auth.apiKey?.in === 'query') {
        const separator = finalUrl.includes('?') ? '&' : '?'
        finalUrl += `${separator}${encodeURIComponent(resolve(request.auth.apiKey.key, collectionVariables))}=${encodeURIComponent(resolve(request.auth.apiKey.value, collectionVariables))}`
      }

      const headers = buildHeaders(request, collectionVariables)
      const body = await buildBody(request, collectionVariables)

      // Set content-type for JSON
      if (request.body.type === 'json' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
      } else if (request.body.type === 'urlencoded' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      // Note: Don't set Content-Type for form-data — browser/fetch sets it with boundary

      const response = await doFetch(finalUrl, {
        method: request.method,
        headers,
        body: body as BodyInit | undefined,
        signal,
        dangerAcceptInvalidCerts: !(settingsStore.settings.validateSsl ?? true),
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
      const metadata = { url: finalUrl, method: request.method }

      if (err instanceof DOMException && err.name === 'AbortError') {
        const message = `Request timed out after ${settingsStore.settings.timeout}s`
        error.value = message

        const retryFn = () => sendRequest(request, collectionVariables)
        logAndNotify('useHttp', message, metadata, {
          type: 'warn',
          actionLabel: 'Retry',
          callback: retryFn,
        })
      } else if (err instanceof Error) {
        const msg = err.message || String(err)

        // Detect SSL/certificate errors and give actionable hint
        const isSslError = /certificate|ssl|tls|self.signed|invalid.*cert/i.test(msg)
        if (isSslError && (settingsStore.settings.validateSsl ?? true)) {
          error.value = `SSL certificate error: ${msg}\n\nHint: If using a local/self-signed cert, disable "Verify SSL" in Settings.`

          const openSettings = () => useTabsStore().openSettingsTab()
          logAndNotify('useHttp', `SSL certificate error: ${msg}`, metadata, {
            type: 'warn',
            actionLabel: 'Go to Settings',
            callback: openSettings,
          })
        } else {
          error.value = msg

          logAndNotify('useHttp', msg, metadata, { type: 'error' })
        }
      } else {
        const message = `Request failed: ${String(err)}`
        error.value = message

        logAndNotify('useHttp', message, metadata, { type: 'error' })
      }
      return null
    } finally {
      clearTimeout(timeoutId)
      activeTimeoutId = null
      if (abortController === controller) {
        abortController = null
      }
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
