import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from '@/stores/notifications'

describe('ErrorModalOverlay logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('activeModal computed', () => {
    it('returns null when modalQueue is empty', () => {
      const store = useNotificationStore()
      const activeModal = store.modalQueue[0] ?? null
      expect(activeModal).toBeNull()
    })

    it('returns the first modal when queue has one item', () => {
      const store = useNotificationStore()
      store.critical('Database Error', 'Connection lost')

      const activeModal = store.modalQueue[0] ?? null
      expect(activeModal).not.toBeNull()
      expect(activeModal!.title).toBe('Database Error')
      expect(activeModal!.message).toBe('Connection lost')
    })

    it('returns only the first modal when queue has multiple items', () => {
      const store = useNotificationStore()
      store.critical('Error 1', 'First message')
      store.critical('Error 2', 'Second message')
      store.critical('Error 3', 'Third message')

      const activeModal = store.modalQueue[0] ?? null
      expect(activeModal!.title).toBe('Error 1')
      expect(activeModal!.message).toBe('First message')
    })
  })

  describe('isOpen computed', () => {
    it('is false when modalQueue is empty', () => {
      const store = useNotificationStore()
      const isOpen = store.modalQueue.length > 0
      expect(isOpen).toBe(false)
    })

    it('is true when modalQueue has items', () => {
      const store = useNotificationStore()
      store.critical('Error', 'Something broke')

      const isOpen = store.modalQueue.length > 0
      expect(isOpen).toBe(true)
    })
  })

  describe('acknowledge behavior', () => {
    it('removes the first modal from queue on acknowledge', () => {
      const store = useNotificationStore()
      store.critical('Error 1', 'First')
      store.critical('Error 2', 'Second')

      const firstId = store.modalQueue[0].id
      store.acknowledgeModal(firstId)

      expect(store.modalQueue).toHaveLength(1)
      expect(store.modalQueue[0].title).toBe('Error 2')
    })

    it('promotes next modal after acknowledging first', () => {
      const store = useNotificationStore()
      store.critical('Error 1', 'First')
      store.critical('Error 2', 'Second')
      store.critical('Error 3', 'Third')

      store.acknowledgeModal(store.modalQueue[0].id)

      const activeModal = store.modalQueue[0] ?? null
      expect(activeModal!.title).toBe('Error 2')
    })

    it('results in empty queue after acknowledging the last modal', () => {
      const store = useNotificationStore()
      store.critical('Only Error', 'Something went wrong')

      store.acknowledgeModal(store.modalQueue[0].id)

      expect(store.modalQueue).toHaveLength(0)
      const isOpen = store.modalQueue.length > 0
      expect(isOpen).toBe(false)
    })
  })
})
