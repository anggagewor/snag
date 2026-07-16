/**
 * HistoryService implementation.
 *
 * Global request history stored at ~/.snag/history/<date>.json.
 * One file per day. Entries are immutable.
 */

import type { HistoryEntry } from '../domain'
import type { StorageAdapter } from '../storage'
import type { HistoryFile } from '../storage/models'
import type { HistoryService, HistoryFilter } from './HistoryService'
import { historyEntryFromFile, historyEntryToFile } from '../storage'

const HISTORY_DIR = 'history'

function dateToFilename(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.json`
}

function emptyHistoryFile(): HistoryFile {
  return { version: 1, entries: [] }
}

export function createHistoryService(storage: StorageAdapter): HistoryService {
  function historyDir(): string {
    return storage.globalPath(HISTORY_DIR)
  }

  async function loadDayFile(filename: string): Promise<HistoryFile> {
    const path = storage.globalPath(HISTORY_DIR, filename)
    const exists = await storage.exists(path)
    if (!exists) return emptyHistoryFile()
    try {
      return await storage.readJson<HistoryFile>(path)
    } catch {
      return emptyHistoryFile()
    }
  }

  async function saveDayFile(filename: string, file: HistoryFile): Promise<void> {
    const path = storage.globalPath(HISTORY_DIR, filename)
    await storage.writeJson(path, file)
  }

  async function getAllEntries(): Promise<HistoryEntry[]> {
    const dir = historyDir()
    await storage.ensureDir(dir)
    const files = await storage.listFiles(dir, '*.json')
    const allEntries: HistoryEntry[] = []

    for (const filename of files.sort().reverse()) {
      const file = await loadDayFile(filename)
      allEntries.push(...file.entries.map(historyEntryFromFile))
    }

    return allEntries
  }

  function applyFilter(entries: HistoryEntry[], filter?: HistoryFilter): HistoryEntry[] {
    if (!filter) return entries

    let result = entries

    if (filter.workspaceId) {
      result = result.filter(e => e.workspaceId === filter.workspaceId)
    }
    if (filter.method) {
      result = result.filter(e => e.method === filter.method)
    }
    if (filter.urlContains) {
      const search = filter.urlContains.toLowerCase()
      result = result.filter(e => e.url.toLowerCase().includes(search))
    }
    if (filter.since) {
      const since = new Date(filter.since).getTime()
      result = result.filter(e => new Date(e.timestamp).getTime() >= since)
    }
    if (filter.until) {
      const until = new Date(filter.until).getTime()
      result = result.filter(e => new Date(e.timestamp).getTime() <= until)
    }

    // Sort most recent first
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    if (filter.offset) {
      result = result.slice(filter.offset)
    }
    if (filter.limit) {
      result = result.slice(0, filter.limit)
    }

    return result
  }

  return {
    async record(entry: HistoryEntry): Promise<void> {
      const date = new Date(entry.timestamp)
      const filename = dateToFilename(date)
      const dir = historyDir()
      await storage.ensureDir(dir)

      const file = await loadDayFile(filename)
      const updatedFile: HistoryFile = {
        ...file,
        entries: [...file.entries, historyEntryToFile(entry)],
      }
      await saveDayFile(filename, updatedFile)
    },

    async query(filter?: HistoryFilter): Promise<HistoryEntry[]> {
      const all = await getAllEntries()
      return applyFilter(all, filter)
    },

    async count(filter?: HistoryFilter): Promise<number> {
      const all = await getAllEntries()
      return applyFilter(all, filter).length
    },

    async clearBefore(date: string): Promise<number> {
      const cutoff = new Date(date)
      const cutoffFilename = dateToFilename(cutoff)
      const dir = historyDir()
      await storage.ensureDir(dir)
      const files = await storage.listFiles(dir, '*.json')

      let removed = 0
      for (const filename of files) {
        if (filename < cutoffFilename) {
          const file = await loadDayFile(filename)
          removed += file.entries.length
          await storage.deleteFile(storage.globalPath(HISTORY_DIR, filename))
        }
      }

      return removed
    },

    async clearAll(): Promise<void> {
      const dir = historyDir()
      await storage.removeDir(dir)
      await storage.ensureDir(dir)
    },
  }
}
