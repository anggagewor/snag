/**
 * RequestDraft — mutable working copy of a domain Request.
 *
 * Digunakan untuk UI two-way binding. Ephemeral ID di KeyValuePairEditable
 * hanya untuk Vue :key rendering, TIDAK pernah di-persist.
 */

import type { RequestId } from './ids'
import type { HttpMethod, ProtocolType, KeyValuePair } from './http'
import type { Request, RequestBody, RequestAuth, RequestMeta, BodyType, AuthType } from './Request'

export interface KeyValuePairEditable {
  readonly id: string
  key: string
  value: string
  enabled: boolean
  description?: string
}

export interface RequestBodyDraft {
  type: BodyType
  content: string
  formData?: KeyValuePairEditable[]
  binaryPath?: string
}

export interface RequestAuthDraft {
  type: AuthType
  basic?: { username: string; password: string }
  bearer?: { token: string }
  apiKey?: { key: string; value: string; in: 'header' | 'query' }
}

export interface RequestDraft {
  name: string
  protocol: ProtocolType
  method: HttpMethod
  url: string
  headers: KeyValuePairEditable[]
  params: KeyValuePairEditable[]
  body: RequestBodyDraft
  auth: RequestAuthDraft
  preRequest: string
  tests: string
}

function kvToEditable(kv: KeyValuePair): KeyValuePairEditable {
  return {
    id: crypto.randomUUID(),
    key: kv.key,
    value: kv.value,
    enabled: kv.enabled,
    description: kv.description,
  }
}

function editableToKv(editable: KeyValuePairEditable): KeyValuePair {
  const kv: KeyValuePair = {
    key: editable.key,
    value: editable.value,
    enabled: editable.enabled,
  }
  if (editable.description !== undefined) {
    return { ...kv, description: editable.description }
  }
  return kv
}

function isEmptyRow(kv: KeyValuePairEditable): boolean {
  return kv.key === '' && kv.value === ''
}

/**
 * Convert immutable domain Request to mutable RequestDraft.
 * Assigns crypto.randomUUID() to each KV pair for Vue :key binding.
 */
export function requestToDraft(request: Request): RequestDraft {
  return {
    name: request.name,
    protocol: request.protocol,
    method: request.method,
    url: request.url,
    headers: request.headers.map(kvToEditable),
    params: request.params.map(kvToEditable),
    body: {
      type: request.body.type,
      content: request.body.content,
      formData: request.body.formData?.map(kvToEditable),
      binaryPath: request.body.binaryPath,
    },
    auth: {
      type: request.auth.type,
      basic: request.auth.basic
        ? { username: request.auth.basic.username, password: request.auth.basic.password }
        : undefined,
      bearer: request.auth.bearer
        ? { token: request.auth.bearer.token }
        : undefined,
      apiKey: request.auth.apiKey
        ? { key: request.auth.apiKey.key, value: request.auth.apiKey.value, in: request.auth.apiKey.in }
        : undefined,
    },
    preRequest: request.preRequest,
    tests: request.tests,
  }
}

/**
 * Convert mutable RequestDraft back to immutable domain Request.
 * Strips ephemeral IDs, filters empty rows, updates meta.updatedAt.
 */
export function draftToRequest(draft: RequestDraft, originalId: RequestId, meta: RequestMeta): Request {
  const nonEmptyHeaders = draft.headers.filter(kv => !isEmptyRow(kv))
  const nonEmptyParams = draft.params.filter(kv => !isEmptyRow(kv))

  const body: RequestBody = {
    type: draft.body.type,
    content: draft.body.content,
    ...(draft.body.formData !== undefined && {
      formData: draft.body.formData.filter(kv => !isEmptyRow(kv)).map(editableToKv),
    }),
    ...(draft.body.binaryPath !== undefined && { binaryPath: draft.body.binaryPath }),
  }

  const auth: RequestAuth = {
    type: draft.auth.type,
    ...(draft.auth.basic && { basic: { ...draft.auth.basic } }),
    ...(draft.auth.bearer && { bearer: { ...draft.auth.bearer } }),
    ...(draft.auth.apiKey && { apiKey: { ...draft.auth.apiKey } }),
  }

  return {
    id: originalId,
    name: draft.name,
    protocol: draft.protocol,
    method: draft.method,
    url: draft.url,
    headers: nonEmptyHeaders.map(editableToKv),
    params: nonEmptyParams.map(editableToKv),
    body,
    auth,
    preRequest: draft.preRequest,
    tests: draft.tests,
    meta: {
      createdAt: meta.createdAt,
      updatedAt: new Date().toISOString(),
    },
  }
}

/**
 * Strips empty KV rows (where both key and value are empty strings)
 * from a RequestDraft for comparison purposes.
 */
export function stripEmptyRows(draft: RequestDraft): object {
  return {
    name: draft.name,
    protocol: draft.protocol,
    method: draft.method,
    url: draft.url,
    headers: draft.headers.filter(kv => !isEmptyRow(kv)).map(({ id: _, ...rest }) => rest),
    params: draft.params.filter(kv => !isEmptyRow(kv)).map(({ id: _, ...rest }) => rest),
    body: {
      type: draft.body.type,
      content: draft.body.content,
      ...(draft.body.formData !== undefined && {
        formData: draft.body.formData.filter(kv => !isEmptyRow(kv)).map(({ id: _, ...rest }) => rest),
      }),
      ...(draft.body.binaryPath !== undefined && { binaryPath: draft.body.binaryPath }),
    },
    auth: draft.auth,
    preRequest: draft.preRequest,
    tests: draft.tests,
  }
}

/**
 * Detects whether a draft has changed compared to its snapshot.
 * Compares via JSON.stringify after stripping empty KV rows.
 */
export function isDirty(draft: RequestDraft, snapshot: RequestDraft): boolean {
  return JSON.stringify(stripEmptyRows(draft)) !== JSON.stringify(stripEmptyRows(snapshot))
}
