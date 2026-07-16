import type { RequestConfig } from '@/types/request'

/**
 * Generate a cURL command string from a RequestConfig.
 * Variables are NOT resolved — the raw template is exported.
 */
export function exportToCurl(request: RequestConfig): string {
  const parts: string[] = ['curl']

  // Method (skip for GET as it's the default)
  if (request.method !== 'GET') {
    parts.push(`-X ${request.method}`)
  }

  // URL (quote it)
  parts.push(`'${escapeShell(request.url)}'`)

  // Headers
  for (const h of request.headers) {
    if (!h.enabled || !h.key) continue
    parts.push(`-H '${escapeShell(h.key)}: ${escapeShell(h.value)}'`)
  }

  // Auth headers
  if (request.auth.type === 'bearer' && request.auth.bearer) {
    parts.push(`-H 'Authorization: Bearer ${escapeShell(request.auth.bearer.token)}'`)
  } else if (request.auth.type === 'basic' && request.auth.basic) {
    parts.push(`-u '${escapeShell(request.auth.basic.username)}:${escapeShell(request.auth.basic.password)}'`)
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.addTo === 'header') {
      parts.push(`-H '${escapeShell(request.auth.apiKey.key)}: ${escapeShell(request.auth.apiKey.value)}'`)
    }
  }

  // Query params (append to URL)
  const enabledParams = request.params.filter((p) => p.enabled && p.key)
  if (enabledParams.length > 0) {
    const queryString = enabledParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&')
    // Replace the URL part with params appended
    const separator = request.url.includes('?') ? '&' : '?'
    parts[parts.indexOf(`'${escapeShell(request.url)}'`)] = `'${escapeShell(request.url)}${separator}${queryString}'`
  }

  // Body
  const { body } = request
  if (body.type === 'json' && body.raw) {
    parts.push(`-H 'Content-Type: application/json'`)
    parts.push(`-d '${escapeShell(body.raw)}'`)
  } else if (body.type === 'raw' && body.raw) {
    parts.push(`-d '${escapeShell(body.raw)}'`)
  } else if (body.type === 'x-www-form-urlencoded' && body.urlencoded) {
    parts.push(`-H 'Content-Type: application/x-www-form-urlencoded'`)
    const data = body.urlencoded
      .filter((p) => p.enabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&')
    if (data) parts.push(`-d '${escapeShell(data)}'`)
  } else if (body.type === 'form-data' && body.formData) {
    for (const field of body.formData) {
      if (!field.enabled || !field.key) continue
      if (field.fieldType === 'file') {
        parts.push(`-F '${escapeShell(field.key)}=@${escapeShell(field.value)}'`)
      } else {
        parts.push(`-F '${escapeShell(field.key)}=${escapeShell(field.value)}'`)
      }
    }
  } else if (body.type === 'binary' && body.binary) {
    parts.push(`--data-binary '@${escapeShell(body.binary)}'`)
  }

  return parts.join(' \\\n  ')
}

function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}
