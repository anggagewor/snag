/**
 * Workspace domain model.
 *
 * Unit organisasi tertinggi. Self-contained dan portable.
 * Meng-own collections, requests, environments, settings.
 */

import type { WorkspaceId, CollectionId, EnvironmentId } from './ids'

export interface Workspace {
  readonly id: WorkspaceId
  readonly name: string
  readonly createdAt: string
  readonly lastOpenedAt: string
  readonly defaultEnvironment: EnvironmentId | null
  readonly collections: readonly CollectionId[]
}

export interface WorkspaceEntry {
  readonly id: WorkspaceId
  readonly name: string
  readonly path: string
  readonly lastOpenedAt: string
}
