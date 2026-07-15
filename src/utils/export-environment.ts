import type { Environment } from '@/types/environment'

/**
 * Export a Snag Environment to Postman Environment JSON format.
 */
export function exportToPostmanEnvironment(env: Environment): PostmanEnvironmentExport {
  return {
    id: env.id,
    name: env.name,
    values: env.variables.map((v) => ({
      key: v.key,
      value: v.value,
      type: 'default',
      enabled: v.enabled,
    })),
    _postman_variable_scope: 'environment',
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: 'Snag/0.1.0',
  }
}

interface PostmanEnvironmentExport {
  id: string
  name: string
  values: { key: string; value: string; type: string; enabled: boolean }[]
  _postman_variable_scope: string
  _postman_exported_at: string
  _postman_exported_using: string
}
