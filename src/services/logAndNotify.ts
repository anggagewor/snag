/**
 * Bridge function — logs via Logger AND optionally pushes a user-facing notification.
 *
 * Always writes a log entry. If `notify` options are provided, also pushes
 * to NotificationStore. Wraps store calls in try/catch to prevent infinite
 * error loops (e.g., notification failure triggering another notification).
 */

import { useLogger } from '@/services/provider'
import { useNotificationStore } from '@/stores/notifications'

export interface NotifyOptions {
  type?: 'info' | 'success' | 'warn' | 'error' | 'critical'
  actionLabel?: string
  callback?: () => void
  title?: string
}

export function logAndNotify(
  source: string,
  message: string,
  metadata?: Record<string, unknown>,
  notify?: NotifyOptions
): void {
  const logger = useLogger()

  const notifyType = notify?.type ?? 'info'

  switch (notifyType) {
    case 'info':
    case 'success':
      logger.info(source, message, metadata)
      break
    case 'warn':
      logger.warn(source, message, metadata)
      break
    case 'error':
    case 'critical':
      logger.error(source, message, metadata)
      break
  }

  if (!notify) return

  try {
    const store = useNotificationStore()

    switch (notifyType) {
      case 'info':
        store.info(message)
        break
      case 'success':
        store.success(message)
        break
      case 'warn':
        store.warn(message, notify.actionLabel, notify.callback)
        break
      case 'error':
        store.error(message, notify.actionLabel, notify.callback)
        break
      case 'critical':
        store.critical(notify.title || 'Error', message)
        break
    }
  } catch (err) {
    // Avoid infinite loops — if the store call fails, log it but don't re-notify
    logger.error(source, 'Failed to push notification', {
      originalMessage: message,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
