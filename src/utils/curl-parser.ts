import type { HttpMethod } from '@/domain'
import type { RequestDraft, KeyValuePairEditable, RequestAuthDraft } from '@/domain'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function createEditableKv(key: string, value: string, enabled = true): KeyValuePairEditable {
  return {
    id: crypto.randomUUID(),
    key,
    value,
    enabled,
  }
}

/**
 * Parse a cURL command string into a RequestDraft object.
 * Handles: method (-X), URL, headers (-H), data/body (-d, --data, --data-raw),
 * auth (--user / -u for basic auth).
 */
export function parseCurl(input: string): RequestDraft {
  // Normalize multiline curl (backslash continuations)
  const normalized = input.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ').trim()

  const tokens = tokenize(normalized)

  let method: HttpMethod | null = null
  let url = ''
  const headers: KeyValuePairEditable[] = []
  let body = ''
  let auth: RequestAuthDraft = { type: 'none' }

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token === 'curl') {
      i++
      continue
    }

    if (token === '-X' || token === '--request') {
      i++
      if (i < tokens.length) {
        const m = tokens[i].toUpperCase() as HttpMethod
        if (HTTP_METHODS.includes(m)) {
          method = m
        }
      }
      i++
      continue
    }

    if (token === '-H' || token === '--header') {
      i++
      if (i < tokens.length) {
        const headerStr = tokens[i]
        const colonIdx = headerStr.indexOf(':')
        if (colonIdx > 0) {
          headers.push(createEditableKv(
            headerStr.slice(0, colonIdx).trim(),
            headerStr.slice(colonIdx + 1).trim(),
          ))
        }
      }
      i++
      continue
    }

    if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      i++
      if (i < tokens.length) {
        body = tokens[i]
      }
      i++
      continue
    }

    if (token === '-u' || token === '--user') {
      i++
      if (i < tokens.length) {
        const userPass = tokens[i]
        const colonIdx = userPass.indexOf(':')
        if (colonIdx > 0) {
          auth = {
            type: 'basic',
            basic: {
              username: userPass.slice(0, colonIdx),
              password: userPass.slice(colonIdx + 1),
            },
          }
        }
      }
      i++
      continue
    }

    // Skip other flags that take arguments
    if (token.startsWith('-') && !token.startsWith('http')) {
      i++
      // Some flags take no argument, some do. Skip next if it doesn't start with -
      if (i < tokens.length && !tokens[i].startsWith('-')) {
        i++
      }
      continue
    }

    // Likely a URL
    if (!url && (token.startsWith('http') || token.startsWith('{{') || token.includes('/'))) {
      url = token
      i++
      continue
    }

    i++
  }

  // Infer method from body presence
  if (!method) {
    method = body ? 'POST' : 'GET'
  }

  // Detect if body is JSON
  const isJson = body.trim().startsWith('{') || body.trim().startsWith('[')

  return {
    name: 'Imported from cURL',
    protocol: 'rest',
    method,
    url,
    headers,
    params: [],
    pathParams: [],
    body: body
      ? { type: isJson ? 'json' : 'text', content: body }
      : { type: 'none', content: '' },
    auth,
    preRequest: '',
    tests: '',
  }
}

/**
 * Simple shell-like tokenizer that handles single and double quotes.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(input[i])) i++
    if (i >= len) break

    let token = ''
    const ch = input[i]

    if (ch === '"' || ch === "'") {
      // Quoted string
      const quote = ch
      i++ // skip opening quote
      while (i < len && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < len) {
          i++
          token += input[i]
        } else {
          token += input[i]
        }
        i++
      }
      i++ // skip closing quote
    } else {
      // Unquoted token
      while (i < len && !/\s/.test(input[i])) {
        token += input[i]
        i++
      }
    }

    if (token) {
      tokens.push(token)
    }
  }

  return tokens
}
