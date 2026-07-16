/**
 * Legacy History Migration.
 *
 * One-time migration: converts legacy history.json (full request/response)
 * to domain HistoryEntry format (summary only) stored via HistoryService.
 *
 * Legacy format stored full request/response blobs.
 * New format stores only: method, url, status, duration, responseSize.
 *
 * Run at startup if legacy history.json exists in ~/.snag/.
 * After successful migration, marks legacy file as migrated.
 */

import type { HistoryEntry, HttpMethod, HistoryEntryId } from '../domain'
import type { StorageAdapter } from '../storage'
import type { HistoryService } from './HistoryService'

// ─── Legacy Format ───────────────────────────────────────────────

interface LegacyHistoryEntry {
  id: string
  request: {
    method: string
    url: string
    [key: string]: unknown
  }
  response: {
    status: number
    time: number
    size: number
    [key: string]: unknown
  } | null
  timestamp: string
}

// ─── Migration ───────────────────────────────────────────────────

const LEGACY_FILENAME = 'history.json'
const MIGRATED_FILENAME = 'history.json.migrated'

/**
 * Migrate legacy history.json to the new per-day HistoryService format.
 *
 * - Reads legacy history.json from ~/.snag/
 * - Converts each entry to domain HistoryEntry (summary only)
 * - Records via HistoryService (writes to per-day files)
 * - Marks legacy file as migrated (write marker + delete original)
 */
export async function migrateLegacyHistory(
  storage: StorageAdapter,
  historyService: HistoryService,
): Promise<void> {
  const legacyPath = storage.globalPath(LEGACY_FILENAME)

  if (!await storage.exists(legacyPath)) return

  try {
    const legacyEntries = await storage.readJson<LegacyHistoryEntry[]>(legacyPath)

    if (!Array.isArray(legacyEntries)) return

    for (const legacy of legacyEntries) {
      const entry: HistoryEntry = {
        id: legacy.id as HistoryEntryId,
        workspaceId: null,
        requestId: null,
        timestamp: legacy.timestamp,
        method: (legacy.request?.method || 'GET') as HttpMethod,
        url: legacy.request?.url || '',
        status: legacy.response?.status ?? 0,
        duration: legacy.response?.time ?? 0,
        responseSize: legacy.response?.size ?? 0,
      }
      await historyService.record(entry)
    }

    // Mark as migrated: write marker file then remove original
    await storage.writeJson(storage.globalPath(MIGRATED_FILENAME), {
      migratedAt: new Date().toISOString(),
      entriesCount: legacyEntries.length,
    })
    await storage.deleteFile(legacyPath)

    console.info(`[historyMigration] Migrated ${legacyEntries.length} legacy history entries`)
  } catch (error) {
    console.error('[historyMigration] Failed to migrate legacy history:', error)
  }
}
