import type { Collection, CollectionItem } from '@/types/collection'
import type { RequestConfig } from '@/types/request'
import type { KeyValuePair } from '@/types/common'

/**
 * Export a Snag Collection to Postman Collection v2.1 JSON format.
 */
export function exportToPostman(collection: Collection): PostmanExport {
  return {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      description: collection.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: serializeItems(collection.items),
    variable: (collection.variables || []).map((v) => ({
      key: v.key,
      value: v.value,
      type: 'string',
    })),
  }
}

function serializeItems(items: CollectionItem[]): PostmanExportItem[] {
  return items.map((item) => {
    if (item.type === 'folder') {
      return {
        name: item.name,
        item: serializeItems(item.items || []),
      }
    }

    return {
      name: item.name,
      request: item.request ? serializeRequest(item.request) : undefined,
    }
  })
}

function serializeRequest(req: RequestConfig): PostmanExportRequest {
  const url = serializeUrl(req.url, req.params)
  const header = serializeHeaders(req.headers)
  const body = serializeBody(req)
  const auth = serializeAuth(req)

  return {
    method: req.method,
    header,
    url,
    body,
    auth,
  }
}

function serializeUrl(rawUrl: string, params: KeyValuePair[]): PostmanExportUrl {
  const enabledParams = params.filter((p) => p.enabled && p.key)

  return {
    raw: rawUrl + (enabledParams.length > 0
      ? (rawUrl.includes('?') ? '&' : '?') + enabledParams.map((p) => `${p.key}=${p.value}`).join('&')
      : ''),
    host: [rawUrl.split('//')[1]?.split('/')[0] || rawUrl],
    path: rawUrl.split('//')[1]?.split('/').slice(1).map((s) => s.split('?')[0]) || [],
    query: enabledParams.map((p) => ({
      key: p.key,
      value: p.value,
      disabled: false,
    })),
  }
}

function serializeHeaders(headers: KeyValuePair[]): PostmanExportHeader[] {
  return headers.map((h) => ({
    key: h.key,
    value: h.value,
    disabled: !h.enabled,
  }))
}

function serializeBody(req: RequestConfig): PostmanExportBody | undefined {
  const { body } = req

  if (body.type === 'none') return undefined

  if (body.type === 'json' || body.type === 'raw') {
    return {
      mode: 'raw',
      raw: body.raw || '',
      options: body.type === 'json'
        ? { raw: { language: 'json' } }
        : undefined,
    }
  }

  if (body.type === 'x-www-form-urlencoded') {
    return {
      mode: 'urlencoded',
      urlencoded: (body.urlencoded || []).map((p) => ({
        key: p.key,
        value: p.value,
        disabled: !p.enabled,
      })),
    }
  }

  if (body.type === 'form-data') {
    return {
      mode: 'formdata',
      formdata: (body.formData || []).map((f) => ({
        key: f.key,
        value: f.fieldType === 'text' ? f.value : undefined,
        src: f.fieldType === 'file' ? f.value : undefined,
        type: f.fieldType,
        disabled: !f.enabled,
      })),
    }
  }

  return undefined
}

function serializeAuth(req: RequestConfig): PostmanExportAuth | undefined {
  const { auth } = req

  if (auth.type === 'none') return { type: 'noauth' }

  if (auth.type === 'bearer' && auth.bearer) {
    return {
      type: 'bearer',
      bearer: [{ key: 'token', value: auth.bearer.token, type: 'string' }],
    }
  }

  if (auth.type === 'basic' && auth.basic) {
    return {
      type: 'basic',
      basic: [
        { key: 'username', value: auth.basic.username, type: 'string' },
        { key: 'password', value: auth.basic.password, type: 'string' },
      ],
    }
  }

  if (auth.type === 'api-key' && auth.apiKey) {
    return {
      type: 'apikey',
      apikey: [
        { key: 'key', value: auth.apiKey.key, type: 'string' },
        { key: 'value', value: auth.apiKey.value, type: 'string' },
        { key: 'in', value: auth.apiKey.addTo, type: 'string' },
      ],
    }
  }

  return undefined
}

// --- Postman Export types ---

interface PostmanExport {
  info: {
    _postman_id: string
    name: string
    description: string
    schema: string
  }
  item: PostmanExportItem[]
  variable?: { key: string; value: string; type: string }[]
}

interface PostmanExportItem {
  name: string
  item?: PostmanExportItem[]
  request?: PostmanExportRequest
}

interface PostmanExportRequest {
  method: string
  header: PostmanExportHeader[]
  url: PostmanExportUrl
  body?: PostmanExportBody
  auth?: PostmanExportAuth
}

interface PostmanExportUrl {
  raw: string
  host: string[]
  path: string[]
  query?: { key: string; value: string; disabled: boolean }[]
}

interface PostmanExportHeader {
  key: string
  value: string
  disabled: boolean
}

interface PostmanExportBody {
  mode: string
  raw?: string
  urlencoded?: { key: string; value: string; disabled: boolean }[]
  formdata?: { key: string; value?: string; src?: string; type: string; disabled: boolean }[]
  options?: { raw?: { language?: string } }
}

interface PostmanExportAuth {
  type: string
  bearer?: { key: string; value: string; type: string }[]
  basic?: { key: string; value: string; type: string }[]
  apikey?: { key: string; value: string; type: string }[]
}
