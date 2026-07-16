/**
 * HistoryService — global request history.
 *
 * Cross-workspace. Stored at ~/.snag/history/.
 * Entries are immutable once recorded.
 *
 * Depends on: domain/, storage/
 * Does NOT depend on: stores/, UI, Vue, Pinia
 */

import type { HistoryEntry, WorkspaceId, HttpMethod } from '../domain'

// ─── Filter ──────────────────────────────────────────────────────

export interface HistoryFilter {
  readonly workspaceId?: WorkspaceId
  readonly method?: HttpMethod
  readonly urlContains?: string
  readonly since?: string
  readonly until?: string
  readonly limit?: number
  readonly offset?: number
}

// ─── Interface ───────────────────────────────────────────────────

export interface HistoryService {
  /** Record a new history entry. Appends to today's file. */
  record(entry: HistoryEntry): Promise<void>

  /** Query history with filters. Returns most recent first. */
  query(filter?: HistoryFilter): Promise<HistoryEntry[]>

  /** Get total count matching filter. */
  count(filter?: HistoryFilter): Promise<number>

  /** Clear history entries older than date. */
  clearBefore(date: string): Promise<number>

  /** Clear all history. */
  clearAll(): Promise<void>
}
