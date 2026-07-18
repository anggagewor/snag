/**
 * Python requests library code generator.
 */

import type { CodegenInput } from './types'
import { getAllHeaders, getBodyString, getFormDataFields, getEnabledParams } from './helpers'

export function generatePythonRequests(input: CodegenInput): string {
  const headers = getAllHeaders(input)
  const body = getBodyString(input)
  const formFields = getFormDataFields(input)
  const params = getEnabledParams(input)
  const hasAuth = input.auth.type === 'basic' && input.auth.basic

  const lines: string[] = []
  lines.push('import requests')
  lines.push('')

  lines.push(`url = "${input.url}"`)
  lines.push('')

  if (params.length > 0) {
    lines.push('params = {')
    for (const p of params) {
      lines.push(`    "${p.key}": "${p.value}",`)
    }
    lines.push('}')
    lines.push('')
  }

  if (headers.length > 0) {
    lines.push('headers = {')
    for (const h of headers) {
      lines.push(`    "${h.key}": "${h.value}",`)
    }
    lines.push('}')
    lines.push('')
  }

  if (formFields.length > 0) {
    lines.push('files = {')
    for (const f of formFields) {
      lines.push(`    "${f.key}": (None, "${f.value}"),`)
    }
    lines.push('}')
    lines.push('')
  }

  // Build request call
  const args: string[] = ['url']
  if (params.length > 0) args.push('params=params')
  if (headers.length > 0) args.push('headers=headers')
  if (hasAuth) {
    const { username, password } = input.auth.basic!
    args.push(`auth=("${username}", "${password}")`)
  }
  if (formFields.length > 0) {
    args.push('files=files')
  } else if (body) {
    if (input.body.type === 'json') {
      args.push(`json=${body}`)
    } else {
      args.push(`data="${body.replace(/"/g, '\\"')}"`)
    }
  }

  const method = input.method.toLowerCase()
  lines.push(`response = requests.${method}(`)
  for (let i = 0; i < args.length; i++) {
    const comma = i < args.length - 1 ? ',' : ''
    lines.push(`    ${args[i]}${comma}`)
  }
  lines.push(')')
  lines.push('')
  lines.push('print(response.status_code)')
  lines.push('print(response.text)')

  return lines.join('\n')
}
