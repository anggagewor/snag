import type { Environment, EnvironmentVariable } from '@/types/environment'

/**
 * Import a Postman Environment JSON export into Snag Environment format.
 * Detects the format by checking `_postman_variable_scope === "environment"` or `values` array.
 */
export function importPostmanEnvironment(json: unknown): Environment {
  const data = json as PostmanEnvironment

  const variables: EnvironmentVariable[] = (data.values || []).map((v) => ({
    key: v.key || '',
    value: v.value || '',
    enabled: v.enabled !== false,
  }))

  return {
    id: crypto.randomUUID(),
    name: data.name || 'Imported Environment',
    variables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Check if a parsed JSON object looks like a Postman environment export.
 */
export function isPostmanEnvironment(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false
  const obj = json as Record<string, unknown>
  return obj._postman_variable_scope === 'environment' || (Array.isArray(obj.values) && 'name' in obj && !('item' in obj))
}

// --- Internal types ---

interface PostmanEnvironment {
  id?: string
  name?: string
  values?: PostmanEnvValue[]
  _postman_variable_scope?: string
}

interface PostmanEnvValue {
  key?: string
  value?: string
  type?: string
  enabled?: boolean
}
