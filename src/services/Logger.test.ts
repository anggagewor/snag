import { describe, it, expect } from 'vitest'
import { formatLogEntry, shouldRotate, getExpiredFiles } from './Logger'
import type { LogEntry } from './Logger'

describe('Logger', () => {
  describe('formatLogEntry', () => {
    it('produces valid JSON with all required fields', () => {
      const entry: LogEntry = {
        timestamp: '2024-01-15T10:23:45.123Z',
        level: 'error',
        source: 'useHttp',
        message: 'Request timeout',
      }

      const result = formatLogEntry(entry)
      const parsed = JSON.parse(result)

      expect(parsed.timestamp).toBe('2024-01-15T10:23:45.123Z')
      expect(parsed.level).toBe('error')
      expect(parsed.source).toBe('useHttp')
      expect(parsed.message).toBe('Request timeout')
      expect(parsed.metadata).toBeUndefined()
    })

    it('includes metadata when provided', () => {
      const entry: LogEntry = {
        timestamp: '2024-01-15T10:23:45.123Z',
        level: 'warn',
        source: 'WorkspaceService',
        message: 'Save failed',
        metadata: { path: '/foo/bar', retries: 3 },
      }

      const result = formatLogEntry(entry)
      const parsed = JSON.parse(result)

      expect(parsed.metadata).toEqual({ path: '/foo/bar', retries: 3 })
    })

    it('produces a single line (no newlines in output)', () => {
      const entry: LogEntry = {
        timestamp: '2024-01-15T10:23:45.123Z',
        level: 'info',
        source: 'test',
        message: 'hello world',
      }

      const result = formatLogEntry(entry)
      expect(result).not.toContain('\n')
    })
  })

  describe('shouldRotate', () => {
    it('returns false for file under 5MB', () => {
      expect(shouldRotate(4 * 1024 * 1024)).toBe(false)
    })

    it('returns false for file exactly 5MB', () => {
      expect(shouldRotate(5 * 1024 * 1024)).toBe(false)
    })

    it('returns true for file over 5MB', () => {
      expect(shouldRotate(5 * 1024 * 1024 + 1)).toBe(true)
    })

    it('returns false for empty file', () => {
      expect(shouldRotate(0)).toBe(false)
    })
  })

  describe('getExpiredFiles', () => {
    it('returns files older than 7 days', () => {
      const now = new Date('2024-01-15T12:00:00.000Z')
      const files = [
        'snag-2024-01-05.log', // 10 days old — expired
        'snag-2024-01-10.log', // 5 days old — keep
        'snag-2024-01-15.log', // today — keep
      ]

      const expired = getExpiredFiles(files, now)
      expect(expired).toEqual(['snag-2024-01-05.log'])
    })

    it('returns split files older than 7 days', () => {
      const now = new Date('2024-01-15T12:00:00.000Z')
      const files = [
        'snag-2024-01-05-001.log', // expired
        'snag-2024-01-05-002.log', // expired
        'snag-2024-01-14.log',     // keep
      ]

      const expired = getExpiredFiles(files, now)
      expect(expired).toEqual(['snag-2024-01-05-001.log', 'snag-2024-01-05-002.log'])
    })

    it('ignores non-matching filenames', () => {
      const now = new Date('2024-01-15T12:00:00.000Z')
      const files = [
        'readme.txt',
        'snag-2024-01-01.log', // expired
        'other.log',
      ]

      const expired = getExpiredFiles(files, now)
      expect(expired).toEqual(['snag-2024-01-01.log'])
    })

    it('returns empty array when no files are expired', () => {
      const now = new Date('2024-01-15T12:00:00.000Z')
      const files = [
        'snag-2024-01-10.log',
        'snag-2024-01-14.log',
        'snag-2024-01-15.log',
      ]

      const expired = getExpiredFiles(files, now)
      expect(expired).toEqual([])
    })

    it('file exactly at cutoff boundary is not expired', () => {
      // cutoff = now - 7 days. A file from that exact date (at midnight UTC)
      // vs cutoff at midnight should not be expired (file date >= cutoff)
      const now = new Date('2024-01-15T00:00:00.000Z')
      const files = ['snag-2024-01-08.log'] // exactly 7 days at midnight boundary

      const expired = getExpiredFiles(files, now)
      expect(expired).toEqual([])
    })

    it('file 8 days old is expired', () => {
      const now = new Date('2024-01-15T12:00:00.000Z')
      const files = ['snag-2024-01-07.log'] // 8 days

      const expired = getExpiredFiles(files, now)
      expect(expired).toEqual(['snag-2024-01-07.log'])
    })
  })
})
