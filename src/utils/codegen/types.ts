/**
 * Code generation types.
 *
 * Defines the input shape and available targets for snippet generation.
 */

import type { RequestDraft } from '@/domain'

export interface CodegenTarget {
  readonly id: string
  readonly label: string
  readonly language: string
  readonly library: string
}

export type CodegenInput = RequestDraft

export const CODEGEN_TARGETS: CodegenTarget[] = [
  { id: 'js-fetch', label: 'JavaScript — Fetch', language: 'javascript', library: 'fetch' },
  { id: 'js-axios', label: 'JavaScript — Axios', language: 'javascript', library: 'axios' },
  { id: 'python-requests', label: 'Python — requests', language: 'python', library: 'requests' },
  { id: 'go-http', label: 'Go — net/http', language: 'go', library: 'net/http' },
  { id: 'rust-reqwest', label: 'Rust — reqwest', language: 'rust', library: 'reqwest' },
  { id: 'php-curl', label: 'PHP — cURL', language: 'php', library: 'curl' },
  { id: 'curl', label: 'cURL', language: 'bash', library: 'curl' },
]
