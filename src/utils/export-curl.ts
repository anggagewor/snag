import type { Request, RequestDraft } from '@/domain'

/** Input type for curl export — accepts either immutable Request or mutable RequestDraft */
type CurlExportInput = Request | RequestDraft

/**
 * Generate a cURL command string from a Request or RequestDraft.
 * Variables are NOT resolved — the raw template is exported.
 */
export function exportToCurl(request: CurlExportInput): string {
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
  } else if (request.auth.type === 'apikey' && request.auth.apiKey) {
    if (request.auth.apiKey.in === 'header') {
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
  if (body.type === 'json' && body.content) {
    parts.push(`-H 'Content-Type: application/json'`)
    parts.push(`-d '${escapeShell(body.content)}'`)
  } else if ((body.type === 'text' || body.type === 'xml' || body.type === 'graphql') && body.content) {
    parts.push(`-d '${escapeShell(body.content)}'`)
  } else if (body.type === 'urlencoded' && body.formData) {
    parts.push(`-H 'Content-Type: application/x-www-form-urlencoded'`)
    const data = body.formData
      .filter((p) => p.enabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&')
    if (data) parts.push(`-d '${escapeShell(data)}'`)
  } else if (body.type === 'formdata' && body.formData) {
    for (const field of body.formData) {
      if (!field.enabled || !field.key) continue
      parts.push(`-F '${escapeShell(field.key)}=${escapeShell(field.value)}'`)
    }
  } else if (body.type === 'binary' && body.binaryPath) {
    parts.push(`--data-binary '@${escapeShell(body.binaryPath)}'`)
  }

  return parts.join(' \\\n  ')
}

function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}
