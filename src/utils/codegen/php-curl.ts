/**
 * PHP cURL code generator.
 */

import type { CodegenInput } from './types'
import { getAllHeaders, getBodyString, getFormDataFields, buildFullUrl } from './helpers'

export function generatePhpCurl(input: CodegenInput): string {
  const headers = getAllHeaders(input)
  const body = getBodyString(input)
  const formFields = getFormDataFields(input)
  const hasAuth = input.auth.type === 'basic' && input.auth.basic
  const url = buildFullUrl(input)

  const lines: string[] = []
  lines.push('<?php')
  lines.push('')
  lines.push('$curl = curl_init();')
  lines.push('')
  lines.push('curl_setopt_array($curl, [')
  lines.push(`    CURLOPT_URL => "${url}",`)
  lines.push('    CURLOPT_RETURNTRANSFER => true,')
  lines.push(`    CURLOPT_CUSTOMREQUEST => "${input.method}",`)

  // Headers
  if (headers.length > 0) {
    lines.push('    CURLOPT_HTTPHEADER => [')
    for (const h of headers) {
      lines.push(`        "${h.key}: ${h.value}",`)
    }
    lines.push('    ],')
  }

  // Basic auth
  if (hasAuth) {
    const { username, password } = input.auth.basic!
    lines.push(`    CURLOPT_USERPWD => "${username}:${password}",`)
  }

  // Body
  if (formFields.length > 0) {
    lines.push('    CURLOPT_POSTFIELDS => [')
    for (const f of formFields) {
      lines.push(`        "${f.key}" => "${f.value}",`)
    }
    lines.push('    ],')
  } else if (body) {
    const escaped = body.replace(/"/g, '\\"').replace(/\n/g, '\\n')
    lines.push(`    CURLOPT_POSTFIELDS => "${escaped}",`)
  }

  lines.push(']);')
  lines.push('')
  lines.push('$response = curl_exec($curl);')
  lines.push('$err = curl_error($curl);')
  lines.push('curl_close($curl);')
  lines.push('')
  lines.push('if ($err) {')
  lines.push('    echo "Error: " . $err;')
  lines.push('} else {')
  lines.push('    echo $response;')
  lines.push('}')

  return lines.join('\n')
}
