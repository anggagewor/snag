/**
 * History domain model.
 *
 * Global (cross-workspace). Record dari eksekusi request.
 * Immutable setelah dibuat — tidak pernah di-update.
 */

import type { HistoryEntryId, WorkspaceId, RequestId } from './ids'
import type { HttpMethod } from './http'

export interface HistoryEntry {
  readonly id: HistoryEntryId
  readonly workspaceId: WorkspaceId | null
  readonly requestId: RequestId | null
  readonly timestamp: string
  readonly method: HttpMethod
  readonly url: string
  readonly status: number
  readonly duration: number
  readonly responseSize: number
}
