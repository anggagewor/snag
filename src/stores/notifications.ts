/**
 * Notification Store — manages user-facing notifications (toasts & modals).
 *
 * Owns: toast queue, modal queue, notification lifecycle.
 * Provides convenience actions for info, success, warn, error, and critical notifications.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

// ─── Types ─────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warn' | 'error'

export interface NotificationAction {
  label: string
  callback: () => void
}

export interface ToastNotification {
  id: string
  type: NotificationType
  message: string
  action?: NotificationAction
  persistent: boolean
  createdAt: number
}

export interface ModalNotification {
  id: string
  title: string
  message: string
  createdAt: number
}

export interface NotificationState {
  toastQueue: ToastNotification[]
  modalQueue: ModalNotification[]
  nextId: number
}

// ─── Store ─────────────────────────────────────────────────────

export const useNotificationStore = defineStore('notifications', () => {
  // ─── State ───────────────────────────────────────────────────

  const toastQueue = ref<ToastNotification[]>([])
  const modalQueue = ref<ModalNotification[]>([])
  const nextId = ref(1)

  // ─── Helpers ─────────────────────────────────────────────────

  function generateId(): string {
    return `notif-${nextId.value++}`
  }

  // ─── Actions ─────────────────────────────────────────────────

  function info(message: string): void {
    toastQueue.value.push({
      id: generateId(),
      type: 'info',
      message,
      persistent: false,
      createdAt: Date.now(),
    })
  }

  function success(message: string): void {
    toastQueue.value.push({
      id: generateId(),
      type: 'success',
      message,
      persistent: false,
      createdAt: Date.now(),
    })
  }

  function warn(message: string, actionLabel?: string, callback?: () => void): void {
    const hasAction = actionLabel !== undefined && callback !== undefined
    toastQueue.value.push({
      id: generateId(),
      type: 'warn',
      message,
      action: hasAction ? { label: actionLabel, callback } : undefined,
      persistent: hasAction,
      createdAt: Date.now(),
    })
  }

  function error(message: string, actionLabel?: string, callback?: () => void): void {
    const hasAction = actionLabel !== undefined && callback !== undefined
    toastQueue.value.push({
      id: generateId(),
      type: 'error',
      message,
      action: hasAction ? { label: actionLabel, callback } : undefined,
      persistent: hasAction,
      createdAt: Date.now(),
    })
  }

  function critical(title: string, message: string): void {
    modalQueue.value.push({
      id: generateId(),
      title,
      message,
      createdAt: Date.now(),
    })
  }

  function dismiss(id: string): void {
    toastQueue.value = toastQueue.value.filter(t => t.id !== id)
  }

  function executeAction(id: string): void {
    const toast = toastQueue.value.find(t => t.id === id)
    if (toast?.action) {
      toast.action.callback()
    }
    dismiss(id)
  }

  function acknowledgeModal(id: string): void {
    modalQueue.value = modalQueue.value.filter(m => m.id !== id)
  }

  // ─── Return ──────────────────────────────────────────────────

  return {
    // State
    toastQueue,
    modalQueue,
    nextId,

    // Actions
    info,
    success,
    warn,
    error,
    critical,
    dismiss,
    executeAction,
    acknowledgeModal,
  }
})
