/**
 * JavaScript Fetch API code generator.
 */

import type { CodegenInput } from './types'
import { getAllHeaders, getBodyString, getFormDataFields, buildFullUrl, getEnabledParams } from './helpers'

export function generateJsFetch(input: CodegenInput): string {
  const headers = getAllHeaders(input)
  const body = getBodyString(input)
  const formFields = getFormDataFields(input)
  const params = getEnabledParams(input)
  const hasAuth = input.auth.type === 'basic' && input.auth.basic

  const lines: string[] = []

  // URL with params
  if (params.length > 0) {
    lines.push(`const url = new URL('${input.url}');`)
    for (const p of params) {
      lines.push(`url.searchParams.append('${p.key}', '${p.value}');`)
    }
    lines.push('')
  }

  // FormData
  if (formFields.length > 0) {
    lines.push('const formData = new FormData();')
    for (const f of formFields) {
      lines.push(`formData.append('${f.key}', '${f.value}');`)
    }
    lines.push('')
  }

  // Options object
  lines.push('const options = {')
  lines.push(`  method: '${input.method}',`)

  if (headers.length > 0) {
    lines.push('  headers: {')
    for (const h of headers) {
      lines.push(`    '${h.key}': '${h.value}',`)
    }
    if (hasAuth) {
      const { username, password } = input.auth.basic!
      lines.push(`    'Authorization': 'Basic ' + btoa('${username}:${password}'),`)
    }
    lines.push('  },')
  } else if (hasAuth) {
    const { username, password } = input.auth.basic!
    lines.push('  headers: {')
    lines.push(`    'Authorization': 'Basic ' + btoa('${username}:${password}'),`)
    lines.push('  },')
  }

  if (formFields.length > 0) {
    lines.push('  body: formData,')
  } else if (body) {
    if (input.body.type === 'json') {
      lines.push(`  body: JSON.stringify(${body}),`)
    } else {
      lines.push(`  body: '${body.replace(/'/g, "\\'")}',`)
    }
  }

  lines.push('};')
  lines.push('')

  // Fetch call
  const urlRef = params.length > 0 ? 'url' : `'${buildFullUrl(input)}'`
  lines.push(`const response = await fetch(${urlRef}, options);`)
  lines.push('const data = await response.text();')
  lines.push('console.log(data);')

  return lines.join('\n')
}
