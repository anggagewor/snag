/**
 * Shared helpers for code generators.
 */

import type { CodegenInput } from './types'

export function getEnabledHeaders(input: CodegenInput): { key: string; value: string }[] {
  return input.headers
    .filter(h => h.enabled && h.key)
    .map(h => ({ key: h.key, value: h.value }))
}

export function getEnabledParams(input: CodegenInput): { key: string; value: string }[] {
  return input.params
    .filter(p => p.enabled && p.key)
    .map(p => ({ key: p.key, value: p.value }))
}

export function buildFullUrl(input: CodegenInput): string {
  const params = getEnabledParams(input)
  if (params.length === 0) return input.url

  const separator = input.url.includes('?') ? '&' : '?'
  const query = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
  return `${input.url}${separator}${query}`
}

export function getAuthHeaders(input: CodegenInput): { key: string; value: string }[] {
  if (input.auth.type === 'bearer' && input.auth.bearer) {
    return [{ key: 'Authorization', value: `Bearer ${input.auth.bearer.token}` }]
  }
  if (input.auth.type === 'apikey' && input.auth.apiKey?.in === 'header') {
    return [{ key: input.auth.apiKey.key, value: input.auth.apiKey.value }]
  }
  return []
}

export function getAllHeaders(input: CodegenInput): { key: string; value: string }[] {
  const headers = getEnabledHeaders(input)
  const authHeaders = getAuthHeaders(input)

  // Add content-type if needed
  const hasContentType = headers.some(h => h.key.toLowerCase() === 'content-type')
  if (!hasContentType && input.body.type === 'json') {
    headers.push({ key: 'Content-Type', value: 'application/json' })
  }
  if (!hasContentType && input.body.type === 'urlencoded') {
    headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' })
  }

  return [...headers, ...authHeaders]
}

export function getBodyString(input: CodegenInput): string | null {
  if (input.body.type === 'none') return null
  if (input.body.type === 'json' || input.body.type === 'text' || input.body.type === 'xml' || input.body.type === 'graphql') {
    return input.body.content || null
  }
  if (input.body.type === 'urlencoded' && input.body.formData) {
    const data = input.body.formData
      .filter(f => f.enabled && f.key)
      .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&')
    return data || null
  }
  return null
}

export function getFormDataFields(input: CodegenInput): { key: string; value: string }[] {
  if (input.body.type !== 'formdata' || !input.body.formData) return []
  return input.body.formData
    .filter(f => f.enabled && f.key)
    .map(f => ({ key: f.key, value: f.value }))
}

export function escapeString(str: string, quote: string): string {
  return str.replace(new RegExp(`\\\\|${quote === "'" ? "'" : '"'}`, 'g'), '\\$&')
}

export function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text.split('\n').map(line => pad + line).join('\n')
}
