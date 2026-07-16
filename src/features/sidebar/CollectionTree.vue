<script setup lang="ts">
import { provide, ref } from 'vue'

import { ChevronRight, Folder, MoreVertical, Zap, FolderPlus, Pencil, Copy, Download, Trash2 } from 'lucide-vue-next'

import { useCollectionsStore } from '@/stores/collections'
import type { Collection, CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'
import { createEmptyRequest } from '@/types/request'
import { exportToPostman } from '@/utils/export-postman'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import CollectionTreeItem from './CollectionTreeItem.vue'

import type { TreeContext } from './collectionTreeContext'

const collectionsStore = useCollectionsStore()

const expandedIds = ref<Set<UUID>>(new Set())
const editingId = ref<UUID | null>(null)
const editingName = ref('')

function toggleExpand(id: UUID) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

function isExpanded(id: UUID): boolean {
  return expandedIds.value.has(id)
}

function startRename(id: UUID, currentName: string) {
  editingId.value = id
  editingName.value = currentName
}

function finishRenameCollection(collectionId: UUID) {
  if (editingId.value && editingName.value.trim()) {
    collectionsStore.renameCollection(collectionId, editingName.value.trim())
  }
  editingId.value = null
  editingName.value = ''
}

function finishRenameItem(collectionId: UUID, itemId: UUID) {
  if (editingId.value && editingName.value.trim()) {
    collectionsStore.renameItem(collectionId, itemId, editingName.value.trim())
  }
  editingId.value = null
  editingName.value = ''
}

function cancelRename() {
  editingId.value = null
  editingName.value = ''
}

function deleteCollection(id: UUID) {
  collectionsStore.deleteCollection(id)
}

function duplicateCollection(collection: Collection) {
  const newCol = collectionsStore.createCollection(`${collection.name} (copy)`)
  const clonedItems: CollectionItem[] = JSON.parse(JSON.stringify(collection.items))
  function regenIds(items: CollectionItem[]) {
    for (const item of items) {
      item.id = crypto.randomUUID()
      if (item.request) item.request.id = crypto.randomUUID()
      if (item.items) regenIds(item.items)
    }
  }
  regenIds(clonedItems)
  for (const item of clonedItems) {
    collectionsStore.addItem(newCol.id, item)
  }
}

function addRequestToCollection(collectionId: UUID) {
  const item: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'request',
    name: 'New Request',
    request: createEmptyRequest(),
  }
  collectionsStore.addItem(collectionId, item)
  expandedIds.value.add(collectionId)
}

function addFolderToCollection(collectionId: UUID) {
  const folder: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'folder',
    name: 'New Folder',
    items: [],
  }
  collectionsStore.addItem(collectionId, folder)
  expandedIds.value.add(collectionId)
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function exportCollection(collection: Collection) {
  const postmanJson = exportToPostman(collection)
  const content = JSON.stringify(postmanJson, null, 2)
  const fileName = `${collection.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.postman_collection.json`

  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const filePath = await save({
      title: 'Export Collection',
      defaultPath: fileName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (filePath) {
      await writeTextFile(filePath, content)
    }
  } else {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
}

// Provide tree context for recursive children
const treeContext: TreeContext = {
  expandedIds,
  editingId,
  editingName,
  startRename,
  finishRenameItem,
  cancelRename,
}

provide('treeContext', treeContext)
</script>

<template>
  <div class="space-y-0.5" role="tree" aria-label="Collections">
    <div v-for="collection in collectionsStore.collections" :key="collection.id">
      <!-- Collection header -->
      <div
        class="flex items-center gap-1 px-2 py-1.5 rounded text-sm hover:bg-surface-hover cursor-pointer group"
        role="treeitem"
        :aria-expanded="isExpanded(collection.id)"
        :aria-label="collection.name"
        tabindex="0"
        @click="toggleExpand(collection.id)"
        @keydown.enter.prevent="toggleExpand(collection.id)"
        @keydown.space.prevent="toggleExpand(collection.id)"
        @keydown.right.prevent="!isExpanded(collection.id) && toggleExpand(collection.id)"
        @keydown.left.prevent="isExpanded(collection.id) && toggleExpand(collection.id)"
      >
        <ChevronRight
          class="w-3.5 h-3.5 text-muted transition-transform flex-shrink-0"
          :class="{ 'rotate-90': isExpanded(collection.id) }"
        />

        <Folder class="w-4 h-4 text-warning flex-shrink-0" />

        <input
          v-if="editingId === collection.id"
          v-model="editingName"
          class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
          @keydown.enter="finishRenameCollection(collection.id)"
          @keydown.escape="cancelRename"
          @blur="finishRenameCollection(collection.id)"
          @click.stop
        />
        <span v-else class="flex-1 truncate text-primary text-xs font-medium">{{ collection.name }}</span>

        <!-- Collection menu -->
        <div class="opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
          <BaseDropdown align="right">
            <template #trigger>
              <button class="p-0.5 text-muted hover:text-primary rounded">
                <MoreVertical class="w-3.5 h-3.5" />
              </button>
            </template>
            <template #content="{ close }">
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addRequestToCollection(collection.id); close()">
                <Zap class="w-3.5 h-3.5 text-muted" />
                Add Request
              </button>
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addFolderToCollection(collection.id); close()">
                <FolderPlus class="w-3.5 h-3.5 text-muted" />
                Add Folder
              </button>
              <div class="border-t border-border my-0.5" />
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="startRename(collection.id, collection.name); close()">
                <Pencil class="w-3.5 h-3.5 text-muted" />
                Rename
              </button>
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateCollection(collection); close()">
                <Copy class="w-3.5 h-3.5 text-muted" />
                Duplicate
              </button>
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="exportCollection(collection); close()">
                <Download class="w-3.5 h-3.5 text-muted" />
                Export (Postman)
              </button>
              <div class="border-t border-border my-0.5" />
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="deleteCollection(collection.id); close()">
                <Trash2 class="w-3.5 h-3.5" />
                Delete
              </button>
            </template>
          </BaseDropdown>
        </div>
      </div>

      <!-- Collection items (recursive) -->
      <div v-if="isExpanded(collection.id)" class="ml-3 border-l border-border-muted pl-2 space-y-0.5">
        <div v-if="collection.items.length === 0" class="px-2 py-1 text-xs text-muted">
          Empty collection
        </div>

        <CollectionTreeItem
          v-for="item in collection.items"
          :key="item.id"
          :item="item"
          :collection-id="collection.id"
        />
      </div>
    </div>
  </div>
</template>
