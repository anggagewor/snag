/**
 * Go net/http code generator.
 */

import type { CodegenInput } from './types'
import { getAllHeaders, getBodyString, buildFullUrl } from './helpers'

export function generateGoHttp(input: CodegenInput): string {
  const headers = getAllHeaders(input)
  const body = getBodyString(input)
  const hasAuth = input.auth.type === 'basic' && input.auth.basic
  const url = buildFullUrl(input)

  const lines: string[] = []
  lines.push('package main')
  lines.push('')
  lines.push('import (')
  lines.push('\t"fmt"')
  lines.push('\t"io"')
  lines.push('\t"net/http"')
  if (body) {
    lines.push('\t"strings"')
  }
  lines.push(')')
  lines.push('')
  lines.push('func main() {')

  // Body
  if (body) {
    lines.push(`\tpayload := strings.NewReader(\`${body}\`)`)
    lines.push('')
    lines.push(`\treq, err := http.NewRequest("${input.method}", "${url}", payload)`)
  } else {
    lines.push(`\treq, err := http.NewRequest("${input.method}", "${url}", nil)`)
  }

  lines.push('\tif err != nil {')
  lines.push('\t\tpanic(err)')
  lines.push('\t}')
  lines.push('')

  // Headers
  for (const h of headers) {
    lines.push(`\treq.Header.Set("${h.key}", "${h.value}")`)
  }

  // Basic auth
  if (hasAuth) {
    const { username, password } = input.auth.basic!
    lines.push(`\treq.SetBasicAuth("${username}", "${password}")`)
  }

  if (headers.length > 0 || hasAuth) {
    lines.push('')
  }

  lines.push('\tclient := &http.Client{}')
  lines.push('\tresp, err := client.Do(req)')
  lines.push('\tif err != nil {')
  lines.push('\t\tpanic(err)')
  lines.push('\t}')
  lines.push('\tdefer resp.Body.Close()')
  lines.push('')
  lines.push('\tbody, _ := io.ReadAll(resp.Body)')
  lines.push('\tfmt.Println(string(body))')
  lines.push('}')

  return lines.join('\n')
}
