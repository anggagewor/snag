import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useStorage } from '@/composables/useStorage'
import { debounce } from '@/utils/debounce'
import type { Collection, CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'

const STORAGE_FILE = 'collections.json'

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([])
  const isLoading = ref(false)

  const { read, write } = useStorage()

  async function persist() {
    await write(STORAGE_FILE, collections.value)
  }

  const save = debounce(persist, 300)

  async function load() {
    isLoading.value = true
    collections.value = await read<Collection[]>(STORAGE_FILE, [])
    isLoading.value = false
  }

  function createCollection(name: string): Collection {
    const collection: Collection = {
      id: crypto.randomUUID(),
      name,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    collections.value.push(collection)
    save()
    return collection
  }

  function deleteCollection(id: UUID) {
    collections.value = collections.value.filter((c) => c.id !== id)
    save()
  }

  function renameCollection(id: UUID, name: string) {
    const collection = collections.value.find((c) => c.id === id)
    if (collection) {
      collection.name = name
      collection.updatedAt = new Date().toISOString()
      save()
    }
  }

  function renameItem(collectionId: UUID, itemId: UUID, name: string) {
    const collection = collections.value.find((c) => c.id === collectionId)
    if (!collection) return

    const item = findItem(collection.items, itemId)
    if (item) {
      item.name = name
      collection.updatedAt = new Date().toISOString()
      save()
    }
  }

  function addItem(collectionId: UUID, item: CollectionItem, parentFolderId?: UUID) {
    const collection = collections.value.find((c) => c.id === collectionId)
    if (!collection) return

    if (parentFolderId) {
      const folder = findItem(collection.items, parentFolderId)
      if (folder && folder.type === 'folder') {
        folder.items = folder.items || []
        folder.items.push(item)
      }
    } else {
      collection.items.push(item)
    }

    collection.updatedAt = new Date().toISOString()
    save()
  }

  function removeItem(collectionId: UUID, itemId: UUID) {
    const collection = collections.value.find((c) => c.id === collectionId)
    if (!collection) return

    removeItemRecursive(collection.items, itemId)
    collection.updatedAt = new Date().toISOString()
    save()
  }

  function findItem(items: CollectionItem[], id: UUID): CollectionItem | null {
    for (const item of items) {
      if (item.id === id) return item
      if (item.items) {
        const found = findItem(item.items, id)
        if (found) return found
      }
    }
    return null
  }

  function removeItemRecursive(items: CollectionItem[], id: UUID): boolean {
    const index = items.findIndex((i) => i.id === id)
    if (index !== -1) {
      items.splice(index, 1)
      return true
    }
    for (const item of items) {
      if (item.items && removeItemRecursive(item.items, id)) {
        return true
      }
    }
    return false
  }

  /**
   * Insert an item as a sibling right after the given itemId.
   * Searches recursively through the tree.
   */
  function insertAfter(collectionId: UUID, afterItemId: UUID, newItem: CollectionItem) {
    const collection = collections.value.find((c) => c.id === collectionId)
    if (!collection) return

    function insertInList(items: CollectionItem[]): boolean {
      const index = items.findIndex((i) => i.id === afterItemId)
      if (index !== -1) {
        items.splice(index + 1, 0, newItem)
        return true
      }
      for (const item of items) {
        if (item.items && insertInList(item.items)) {
          return true
        }
      }
      return false
    }

    insertInList(collection.items)
    collection.updatedAt = new Date().toISOString()
    save()
  }

  /**
   * Move an item within or between parents in the same collection.
   * Removes from current position and inserts at target position.
   */
  function moveItem(
    collectionId: UUID,
    itemId: UUID,
    targetParentId: UUID | null,
    targetIndex: number
  ) {
    const collection = collections.value.find((c) => c.id === collectionId)
    if (!collection) return

    // Find and remove item from its current location
    let movedItem: CollectionItem | null = null

    function removeFrom(items: CollectionItem[]): boolean {
      const index = items.findIndex((i) => i.id === itemId)
      if (index !== -1) {
        movedItem = items.splice(index, 1)[0]
        return true
      }
      for (const item of items) {
        if (item.items && removeFrom(item.items)) return true
      }
      return false
    }

    removeFrom(collection.items)
    if (!movedItem) return

    // Insert into target location
    if (targetParentId) {
      const parent = findItem(collection.items, targetParentId)
      if (parent && parent.type === 'folder') {
        parent.items = parent.items || []
        const idx = Math.min(targetIndex, parent.items.length)
        parent.items.splice(idx, 0, movedItem)
      }
    } else {
      const idx = Math.min(targetIndex, collection.items.length)
      collection.items.splice(idx, 0, movedItem)
    }

    collection.updatedAt = new Date().toISOString()
    save()
  }

  return {
    collections,
    isLoading,
    load,
    save,
    createCollection,
    deleteCollection,
    renameCollection,
    renameItem,
    addItem,
    removeItem,
    findItem,
    insertAfter,
    moveItem,
  }
})
