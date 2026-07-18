/**
 * JavaScript Axios code generator.
 */

import type { CodegenInput } from './types'
import { getAllHeaders, getBodyString, getFormDataFields, getEnabledParams } from './helpers'

export function generateJsAxios(input: CodegenInput): string {
  const headers = getAllHeaders(input)
  const body = getBodyString(input)
  const formFields = getFormDataFields(input)
  const params = getEnabledParams(input)
  const hasAuth = input.auth.type === 'basic' && input.auth.basic

  const lines: string[] = []
  lines.push("import axios from 'axios';")
  lines.push('')

  // FormData
  if (formFields.length > 0) {
    lines.push('const formData = new FormData();')
    for (const f of formFields) {
      lines.push(`formData.append('${f.key}', '${f.value}');`)
    }
    lines.push('')
  }

  // Config object
  lines.push('const config = {')
  lines.push(`  method: '${input.method.toLowerCase()}',`)
  lines.push(`  url: '${input.url}',`)

  if (params.length > 0) {
    lines.push('  params: {')
    for (const p of params) {
      lines.push(`    '${p.key}': '${p.value}',`)
    }
    lines.push('  },')
  }

  if (headers.length > 0) {
    lines.push('  headers: {')
    for (const h of headers) {
      lines.push(`    '${h.key}': '${h.value}',`)
    }
    lines.push('  },')
  }

  if (hasAuth) {
    const { username, password } = input.auth.basic!
    lines.push('  auth: {')
    lines.push(`    username: '${username}',`)
    lines.push(`    password: '${password}',`)
    lines.push('  },')
  }

  if (formFields.length > 0) {
    lines.push('  data: formData,')
  } else if (body) {
    if (input.body.type === 'json') {
      lines.push(`  data: ${body},`)
    } else {
      lines.push(`  data: '${body.replace(/'/g, "\\'")}',`)
    }
  }

  lines.push('};')
  lines.push('')

  lines.push('const response = await axios(config);')
  lines.push('console.log(response.data);')

  return lines.join('\n')
}
