import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from './notifications'

describe('NotificationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('info()', () => {
    it('pushes an info toast with persistent: false', () => {
      const store = useNotificationStore()
      store.info('Hello')

      expect(store.toastQueue).toHaveLength(1)
      expect(store.toastQueue[0].type).toBe('info')
      expect(store.toastQueue[0].message).toBe('Hello')
      expect(store.toastQueue[0].persistent).toBe(false)
      expect(store.toastQueue[0].action).toBeUndefined()
    })
  })

  describe('success()', () => {
    it('pushes a success toast with persistent: false', () => {
      const store = useNotificationStore()
      store.success('Saved')

      expect(store.toastQueue).toHaveLength(1)
      expect(store.toastQueue[0].type).toBe('success')
      expect(store.toastQueue[0].message).toBe('Saved')
      expect(store.toastQueue[0].persistent).toBe(false)
      expect(store.toastQueue[0].action).toBeUndefined()
    })
  })

  describe('warn()', () => {
    it('pushes a warn toast with persistent: false when no action provided', () => {
      const store = useNotificationStore()
      store.warn('Watch out')

      expect(store.toastQueue).toHaveLength(1)
      expect(store.toastQueue[0].type).toBe('warn')
      expect(store.toastQueue[0].persistent).toBe(false)
      expect(store.toastQueue[0].action).toBeUndefined()
    })

    it('pushes a warn toast with persistent: true when action provided', () => {
      const store = useNotificationStore()
      const cb = vi.fn()
      store.warn('Timeout', 'Retry', cb)

      expect(store.toastQueue).toHaveLength(1)
      expect(store.toastQueue[0].type).toBe('warn')
      expect(store.toastQueue[0].persistent).toBe(true)
      expect(store.toastQueue[0].action).toEqual({ label: 'Retry', callback: cb })
    })

    it('is not persistent when only actionLabel provided without callback', () => {
      const store = useNotificationStore()
      store.warn('Timeout', 'Retry')

      expect(store.toastQueue[0].persistent).toBe(false)
      expect(store.toastQueue[0].action).toBeUndefined()
    })
  })

  describe('error()', () => {
    it('pushes an error toast with persistent: false when no action provided', () => {
      const store = useNotificationStore()
      store.error('Failed')

      expect(store.toastQueue).toHaveLength(1)
      expect(store.toastQueue[0].type).toBe('error')
      expect(store.toastQueue[0].persistent).toBe(false)
      expect(store.toastQueue[0].action).toBeUndefined()
    })

    it('pushes an error toast with persistent: true when action provided', () => {
      const store = useNotificationStore()
      const cb = vi.fn()
      store.error('SSL Error', 'Go to Settings', cb)

      expect(store.toastQueue).toHaveLength(1)
      expect(store.toastQueue[0].type).toBe('error')
      expect(store.toastQueue[0].persistent).toBe(true)
      expect(store.toastQueue[0].action).toEqual({ label: 'Go to Settings', callback: cb })
    })
  })

  describe('critical()', () => {
    it('pushes a modal notification to modalQueue', () => {
      const store = useNotificationStore()
      store.critical('Fatal Error', 'Something went very wrong')

      expect(store.modalQueue).toHaveLength(1)
      expect(store.modalQueue[0].title).toBe('Fatal Error')
      expect(store.modalQueue[0].message).toBe('Something went very wrong')
      expect(store.toastQueue).toHaveLength(0)
    })
  })

  describe('dismiss()', () => {
    it('removes a toast from the queue by id', () => {
      const store = useNotificationStore()
      store.info('A')
      store.info('B')
      store.info('C')

      const idToRemove = store.toastQueue[1].id
      store.dismiss(idToRemove)

      expect(store.toastQueue).toHaveLength(2)
      expect(store.toastQueue.find(t => t.id === idToRemove)).toBeUndefined()
    })

    it('does nothing for non-existent id', () => {
      const store = useNotificationStore()
      store.info('A')
      store.dismiss('notif-999')

      expect(store.toastQueue).toHaveLength(1)
    })
  })

  describe('executeAction()', () => {
    it('calls the callback and removes the toast', () => {
      const store = useNotificationStore()
      const cb = vi.fn()
      store.warn('Timeout', 'Retry', cb)

      const id = store.toastQueue[0].id
      store.executeAction(id)

      expect(cb).toHaveBeenCalledOnce()
      expect(store.toastQueue).toHaveLength(0)
    })

    it('dismisses even if no action is present', () => {
      const store = useNotificationStore()
      store.info('No action')

      const id = store.toastQueue[0].id
      store.executeAction(id)

      expect(store.toastQueue).toHaveLength(0)
    })
  })

  describe('acknowledgeModal()', () => {
    it('removes a modal from the queue by id', () => {
      const store = useNotificationStore()
      store.critical('Error 1', 'msg 1')
      store.critical('Error 2', 'msg 2')

      const idToRemove = store.modalQueue[0].id
      store.acknowledgeModal(idToRemove)

      expect(store.modalQueue).toHaveLength(1)
      expect(store.modalQueue[0].title).toBe('Error 2')
    })
  })

  describe('ID generation', () => {
    it('assigns unique IDs with notif-{n} format', () => {
      const store = useNotificationStore()
      store.info('A')
      store.success('B')
      store.critical('C', 'msg')

      expect(store.toastQueue[0].id).toBe('notif-1')
      expect(store.toastQueue[1].id).toBe('notif-2')
      expect(store.modalQueue[0].id).toBe('notif-3')
    })

    it('IDs are monotonically increasing', () => {
      const store = useNotificationStore()
      for (let i = 0; i < 10; i++) {
        store.info(`msg-${i}`)
      }

      const ids = store.toastQueue.map(t => parseInt(t.id.replace('notif-', '')))
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1])
      }
    })
  })

  describe('queue ordering', () => {
    it('maintains insertion order in toastQueue', () => {
      const store = useNotificationStore()
      store.info('First')
      store.success('Second')
      store.warn('Third')

      expect(store.toastQueue[0].message).toBe('First')
      expect(store.toastQueue[1].message).toBe('Second')
      expect(store.toastQueue[2].message).toBe('Third')
    })
  })
})
