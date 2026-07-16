/**
 * Request domain model.
 *
 * Self-contained unit of work. Tidak tahu posisinya di tree.
 * Tidak menyimpan response. Immutable — setiap perubahan
 * menghasilkan object baru.
 */

import type { RequestId } from './ids'
import type { HttpMethod, ProtocolType, KeyValuePair } from './http'

export type BodyType = 'none' | 'json' | 'xml' | 'text' | 'formdata' | 'urlencoded' | 'binary' | 'graphql'

export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey'

export interface RequestBody {
  readonly type: BodyType
  readonly content: string
  readonly formData?: readonly KeyValuePair[]
  readonly binaryPath?: string
}

export interface RequestAuth {
  readonly type: AuthType
  readonly basic?: { readonly username: string; readonly password: string }
  readonly bearer?: { readonly token: string }
  readonly apiKey?: { readonly key: string; readonly value: string; readonly in: 'header' | 'query' }
}

export interface RequestMeta {
  readonly createdAt: string
  readonly updatedAt: string
}

export interface Request {
  readonly id: RequestId
  readonly name: string
  readonly protocol: ProtocolType
  readonly method: HttpMethod
  readonly url: string
  readonly headers: readonly KeyValuePair[]
  readonly params: readonly KeyValuePair[]
  readonly pathParams?: readonly KeyValuePair[]
  readonly body: RequestBody
  readonly auth: RequestAuth
  readonly preRequest: string
  readonly tests: string
  readonly meta: RequestMeta
}
