import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/provider', () => ({
  useLogger: vi.fn(),
}))

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: vi.fn(),
}))

import { logAndNotify } from './logAndNotify'
import { useLogger } from '@/services/provider'
import { useNotificationStore } from '@/stores/notifications'

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    _fallbackMode: false,
  }
}

function createMockStore() {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  }
}

describe('logAndNotify', () => {
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockStore: ReturnType<typeof createMockStore>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockStore = createMockStore()
    vi.mocked(useLogger).mockReturnValue(mockLogger)
    vi.mocked(useNotificationStore).mockReturnValue(mockStore as never)
  })

  describe('logging behavior', () => {
    it('logs at info level when no notify options provided', () => {
      logAndNotify('TestSource', 'hello')

      expect(mockLogger.info).toHaveBeenCalledWith('TestSource', 'hello', undefined)
    })

    it('logs at info level for notify type "info"', () => {
      logAndNotify('TestSource', 'msg', undefined, { type: 'info' })

      expect(mockLogger.info).toHaveBeenCalledWith('TestSource', 'msg', undefined)
    })

    it('logs at info level for notify type "success"', () => {
      logAndNotify('TestSource', 'msg', undefined, { type: 'success' })

      expect(mockLogger.info).toHaveBeenCalledWith('TestSource', 'msg', undefined)
    })

    it('logs at warn level for notify type "warn"', () => {
      logAndNotify('TestSource', 'msg', undefined, { type: 'warn' })

      expect(mockLogger.warn).toHaveBeenCalledWith('TestSource', 'msg', undefined)
    })

    it('logs at error level for notify type "error"', () => {
      logAndNotify('TestSource', 'msg', undefined, { type: 'error' })

      expect(mockLogger.error).toHaveBeenCalledWith('TestSource', 'msg', undefined)
    })

    it('logs at error level for notify type "critical"', () => {
      logAndNotify('TestSource', 'msg', undefined, { type: 'critical' })

      expect(mockLogger.error).toHaveBeenCalledWith('TestSource', 'msg', undefined)
    })

    it('passes metadata to the logger', () => {
      const meta = { url: 'https://api.test.com', method: 'GET' }
      logAndNotify('useHttp', 'timeout', meta, { type: 'warn' })

      expect(mockLogger.warn).toHaveBeenCalledWith('useHttp', 'timeout', meta)
    })
  })

  describe('notification behavior', () => {
    it('does not push notification when notify is not provided', () => {
      logAndNotify('TestSource', 'msg')

      expect(mockStore.info).not.toHaveBeenCalled()
      expect(mockStore.success).not.toHaveBeenCalled()
      expect(mockStore.warn).not.toHaveBeenCalled()
      expect(mockStore.error).not.toHaveBeenCalled()
      expect(mockStore.critical).not.toHaveBeenCalled()
    })

    it('pushes info notification', () => {
      logAndNotify('Src', 'hello', undefined, { type: 'info' })

      expect(mockStore.info).toHaveBeenCalledWith('hello')
    })

    it('pushes success notification', () => {
      logAndNotify('Src', 'done', undefined, { type: 'success' })

      expect(mockStore.success).toHaveBeenCalledWith('done')
    })

    it('pushes warn notification with action', () => {
      const cb = vi.fn()
      logAndNotify('Src', 'slow', undefined, { type: 'warn', actionLabel: 'Retry', callback: cb })

      expect(mockStore.warn).toHaveBeenCalledWith('slow', 'Retry', cb)
    })

    it('pushes error notification with action', () => {
      const cb = vi.fn()
      logAndNotify('Src', 'fail', undefined, { type: 'error', actionLabel: 'Retry', callback: cb })

      expect(mockStore.error).toHaveBeenCalledWith('fail', 'Retry', cb)
    })

    it('pushes critical notification with title', () => {
      logAndNotify('Src', 'fatal error', undefined, { type: 'critical', title: 'Critical Failure' })

      expect(mockStore.critical).toHaveBeenCalledWith('Critical Failure', 'fatal error')
    })

    it('uses "Error" as default title for critical when title not provided', () => {
      logAndNotify('Src', 'bad stuff', undefined, { type: 'critical' })

      expect(mockStore.critical).toHaveBeenCalledWith('Error', 'bad stuff')
    })
  })

  describe('error handling', () => {
    it('catches store errors and logs them without re-notifying', () => {
      mockStore.info.mockImplementation(() => {
        throw new Error('Store exploded')
      })

      logAndNotify('Src', 'msg', undefined, { type: 'info' })

      expect(mockLogger.error).toHaveBeenCalledWith('Src', 'Failed to push notification', {
        originalMessage: 'msg',
        error: 'Store exploded',
      })
    })

    it('handles non-Error throw values gracefully', () => {
      mockStore.success.mockImplementation(() => {
        throw 'string error'
      })

      logAndNotify('Src', 'msg', undefined, { type: 'success' })

      expect(mockLogger.error).toHaveBeenCalledWith('Src', 'Failed to push notification', {
        originalMessage: 'msg',
        error: 'string error',
      })
    })
  })
})
