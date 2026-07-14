import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useStorage } from '@/composables/useStorage'
import type { Collection, CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'

const STORAGE_FILE = 'collections.json'

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([])
  const isLoading = ref(false)

  const { read, write } = useStorage()

  async function load() {
    isLoading.value = true
    collections.value = await read<Collection[]>(STORAGE_FILE, [])
    isLoading.value = false
  }

  async function save() {
    await write(STORAGE_FILE, collections.value)
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

  return {
    collections,
    isLoading,
    load,
    save,
    createCollection,
    deleteCollection,
    renameCollection,
    addItem,
    removeItem,
    findItem,
    insertAfter,
  }
})
