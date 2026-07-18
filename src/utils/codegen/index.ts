/**
 * Code Generation — entry point.
 *
 * Generates code snippets from a RequestDraft for various languages/libraries.
 */

import type { CodegenInput } from './types'
import { CODEGEN_TARGETS } from './types'
import { generateJsFetch } from './js-fetch'
import { generateJsAxios } from './js-axios'
import { generatePythonRequests } from './python-requests'
import { generateGoHttp } from './go-http'
import { generateRustReqwest } from './rust-reqwest'
import { generatePhpCurl } from './php-curl'
import { generateCurl } from './curl'

export { CODEGEN_TARGETS } from './types'
export type { CodegenTarget, CodegenInput } from './types'

const generators: Record<string, (input: CodegenInput) => string> = {
  'js-fetch': generateJsFetch,
  'js-axios': generateJsAxios,
  'python-requests': generatePythonRequests,
  'go-http': generateGoHttp,
  'rust-reqwest': generateRustReqwest,
  'php-curl': generatePhpCurl,
  'curl': generateCurl,
}

export function generateCode(targetId: string, input: CodegenInput): string {
  const generator = generators[targetId]
  if (!generator) {
    const target = CODEGEN_TARGETS.find(t => t.id === targetId)
    return `// Code generation not available for: ${target?.label ?? targetId}`
  }
  return generator(input)
}
