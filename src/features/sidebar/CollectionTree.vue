<script setup lang="ts">
import { ref } from 'vue'

import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import type { Collection, CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'
import { createEmptyRequest } from '@/types/request'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'

const collectionsStore = useCollectionsStore()
const tabsStore = useTabsStore()

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

function openRequest(item: CollectionItem, collectionId: UUID) {
  if (item.type === 'request' && item.request) {
    const sourceId = `${collectionId}:${item.id}`
    tabsStore.openRequestTab(JSON.parse(JSON.stringify(item.request)), item.name, sourceId)
  }
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
    const collection = collectionsStore.collections.find((c) => c.id === collectionId)
    if (collection) {
      const item = collectionsStore.findItem(collection.items, itemId)
      if (item) {
        item.name = editingName.value.trim()
        collection.updatedAt = new Date().toISOString()
        collectionsStore.save()
      }
    }
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

function duplicateItem(collectionId: UUID, item: CollectionItem) {
  const clone: CollectionItem = JSON.parse(JSON.stringify(item))
  clone.id = crypto.randomUUID()
  clone.name = `${item.name} (copy)`
  if (clone.request) clone.request.id = crypto.randomUUID()
  if (clone.items) {
    function regenIds(items: CollectionItem[]) {
      for (const i of items) {
        i.id = crypto.randomUUID()
        if (i.request) i.request.id = crypto.randomUUID()
        if (i.items) regenIds(i.items)
      }
    }
    regenIds(clone.items)
  }
  collectionsStore.insertAfter(collectionId, item.id, clone)
}

function addRequestToCollection(collectionId: UUID, parentFolderId?: UUID) {
  const item: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'request',
    name: 'New Request',
    request: createEmptyRequest(),
  }
  collectionsStore.addItem(collectionId, item, parentFolderId)
  expandedIds.value.add(parentFolderId || collectionId)
}

function addFolderToCollection(collectionId: UUID, parentFolderId?: UUID) {
  const folder: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'folder',
    name: 'New Folder',
    items: [],
  }
  collectionsStore.addItem(collectionId, folder, parentFolderId)
  expandedIds.value.add(parentFolderId || collectionId)
}
</script>

<template>
  <div class="space-y-0.5">
    <div v-for="collection in collectionsStore.collections" :key="collection.id">
      <!-- Collection header -->
      <div
        class="flex items-center gap-1 px-2 py-1.5 rounded text-sm hover:bg-surface-hover cursor-pointer group"
        @click="toggleExpand(collection.id)"
      >
        <svg
          class="w-3.5 h-3.5 text-muted transition-transform flex-shrink-0"
          :class="{ 'rotate-90': isExpanded(collection.id) }"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <svg class="w-4 h-4 text-warning flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>

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
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </template>
            <template #content="{ close }">
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addRequestToCollection(collection.id); close()">
                <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Add Request
              </button>
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addFolderToCollection(collection.id); close()">
                <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                Add Folder
              </button>
              <div class="border-t border-border my-0.5" />
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="startRename(collection.id, collection.name); close()">
                <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Rename
              </button>
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateCollection(collection); close()">
                <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Duplicate
              </button>
              <div class="border-t border-border my-0.5" />
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="deleteCollection(collection.id); close()">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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

        <!-- Recursive item rendering -->
        <template v-for="item in collection.items" :key="item.id">
          <!-- Folder -->
          <div v-if="item.type === 'folder'">
            <div
              class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item"
              @click="toggleExpand(item.id)"
            >
              <svg
                class="w-3 h-3 text-muted transition-transform flex-shrink-0"
                :class="{ 'rotate-90': isExpanded(item.id) }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              <svg class="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>

              <input
                v-if="editingId === item.id"
                v-model="editingName"
                class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
                @keydown.enter="finishRenameItem(collection.id, item.id)"
                @keydown.escape="cancelRename"
                @blur="finishRenameItem(collection.id, item.id)"
                @click.stop
              />
              <span v-else class="flex-1 truncate text-primary">{{ item.name }}</span>

              <!-- Folder menu -->
              <div class="opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
                <BaseDropdown align="right">
                  <template #trigger>
                    <button class="p-0.5 text-muted hover:text-primary rounded">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </template>
                  <template #content="{ close }">
                    <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addRequestToCollection(collection.id, item.id); close()">
                      Add Request
                    </button>
                    <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addFolderToCollection(collection.id, item.id); close()">
                      Add Folder
                    </button>
                    <div class="border-t border-border my-0.5" />
                    <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="startRename(item.id, item.name); close()">
                      Rename
                    </button>
                    <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateItem(collection.id, item); close()">
                      Duplicate
                    </button>
                    <div class="border-t border-border my-0.5" />
                    <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="collectionsStore.removeItem(collection.id, item.id); close()">
                      Delete
                    </button>
                  </template>
                </BaseDropdown>
              </div>
            </div>

            <!-- Folder children -->
            <div v-if="isExpanded(item.id)" class="ml-3 border-l border-border-muted pl-2 space-y-0.5">
              <div v-if="!item.items || item.items.length === 0" class="px-2 py-1 text-[10px] text-muted">
                Empty folder
              </div>
              <div
                v-for="child in item.items"
                :key="child.id"
                class="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/child"
                @click="openRequest(child, collection.id)"
              >
                <template v-if="child.type === 'request' && child.request">
                  <BaseBadge :method="child.request.method" />
                  <input
                    v-if="editingId === child.id"
                    v-model="editingName"
                    class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
                    @keydown.enter="finishRenameItem(collection.id, child.id)"
                    @keydown.escape="cancelRename"
                    @blur="finishRenameItem(collection.id, child.id)"
                    @click.stop
                  />
                  <span v-else class="text-primary flex-1 truncate">{{ child.name }}</span>
                </template>
                <!-- Child menu -->
                <div class="opacity-0 group-hover/child:opacity-100 transition-opacity" @click.stop>
                  <BaseDropdown align="right">
                    <template #trigger>
                      <button class="p-0.5 text-muted hover:text-primary rounded">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </template>
                    <template #content="{ close }">
                      <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="startRename(child.id, child.name); close()">Rename</button>
                      <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateItem(collection.id, child); close()">Duplicate</button>
                      <div class="border-t border-border my-0.5" />
                      <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="collectionsStore.removeItem(collection.id, child.id); close()">Delete</button>
                    </template>
                  </BaseDropdown>
                </div>
              </div>
            </div>
          </div>

          <!-- Request (top level) -->
          <div
            v-else-if="item.type === 'request' && item.request"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item"
            @click="openRequest(item, collection.id)"
          >
            <BaseBadge :method="item.request.method" />
            <input
              v-if="editingId === item.id"
              v-model="editingName"
              class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
              @keydown.enter="finishRenameItem(collection.id, item.id)"
              @keydown.escape="cancelRename"
              @blur="finishRenameItem(collection.id, item.id)"
              @click.stop
            />
            <span v-else class="text-primary flex-1 truncate">{{ item.name }}</span>

            <!-- Request menu -->
            <div class="opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
              <BaseDropdown align="right">
                <template #trigger>
                  <button class="p-0.5 text-muted hover:text-primary rounded">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </template>
                <template #content="{ close }">
                  <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="startRename(item.id, item.name); close()">Rename</button>
                  <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateItem(collection.id, item); close()">Duplicate</button>
                  <div class="border-t border-border my-0.5" />
                  <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="collectionsStore.removeItem(collection.id, item.id); close()">Delete</button>
                </template>
              </BaseDropdown>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
