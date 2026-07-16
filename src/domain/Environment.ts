/**
 * Environment domain model.
 *
 * Sekumpulan variabel yang bisa di-switch per workspace.
 * Disubstitusi saat runtime via {{key}} syntax.
 */

import type { EnvironmentId } from './ids'

export interface EnvironmentVariable {
  readonly key: string
  readonly value: string
  readonly enabled: boolean
}

export interface Environment {
  readonly id: EnvironmentId
  readonly name: string
  readonly variables: readonly EnvironmentVariable[]
}
