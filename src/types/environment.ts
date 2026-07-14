import type { UUID } from './common'

export interface EnvironmentVariable {
  key: string
  value: string
  enabled: boolean
}

export interface Environment {
  id: UUID
  name: string
  variables: EnvironmentVariable[]
  createdAt: string
  updatedAt: string
}
