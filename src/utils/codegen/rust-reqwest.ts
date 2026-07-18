/**
 * Rust reqwest code generator.
 */

import type { CodegenInput } from './types'
import { getAllHeaders, getBodyString, getFormDataFields, buildFullUrl, getEnabledParams } from './helpers'

export function generateRustReqwest(input: CodegenInput): string {
  const headers = getAllHeaders(input)
  const body = getBodyString(input)
  const formFields = getFormDataFields(input)
  const params = getEnabledParams(input)
  const hasAuth = input.auth.type === 'basic' && input.auth.basic
  const url = buildFullUrl(input)

  const lines: string[] = []
  lines.push('use reqwest;')
  lines.push('')
  lines.push('#[tokio::main]')
  lines.push('async fn main() -> Result<(), reqwest::Error> {')
  lines.push('\tlet client = reqwest::Client::new();')
  lines.push('')

  // Build request
  const method = input.method.toLowerCase()
  lines.push(`\tlet response = client.${method}("${url}")`)

  // Headers
  for (const h of headers) {
    lines.push(`\t\t.header("${h.key}", "${h.value}")`)
  }

  // Basic auth
  if (hasAuth) {
    const { username, password } = input.auth.basic!
    lines.push(`\t\t.basic_auth("${username}", Some("${password}"))`)
  }

  // Query params
  if (params.length > 0) {
    const pairs = params.map(p => `("${p.key}", "${p.value}")`).join(', ')
    lines.push(`\t\t.query(&[${pairs}])`)
  }

  // Body
  if (formFields.length > 0) {
    const pairs = formFields.map(f => `("${f.key}", "${f.value}")`).join(', ')
    lines.push(`\t\t.form(&[${pairs}])`)
  } else if (body) {
    if (input.body.type === 'json') {
      lines.push(`\t\t.body(r#"${body}"#)`)
      // Replace body with json header reminder
    } else {
      lines.push(`\t\t.body("${body.replace(/"/g, '\\"')}")`)
    }
  }

  lines.push('\t\t.send()')
  lines.push('\t\t.await?;')
  lines.push('')
  lines.push('\tlet body = response.text().await?;')
  lines.push('\tprintln!("{}", body);')
  lines.push('')
  lines.push('\tOk(())')
  lines.push('}')

  return lines.join('\n')
}
