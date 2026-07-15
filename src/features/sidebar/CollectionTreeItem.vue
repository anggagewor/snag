<script setup lang="ts">
import { inject } from 'vue'

import { ChevronRight, Folder, MoreVertical } from 'lucide-vue-next'

import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import type { CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'
import { createEmptyRequest } from '@/types/request'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'

import type { TreeContext } from './collectionTreeContext'

const props = defineProps<{
  item: CollectionItem
  collectionId: UUID
}>()

const collectionsStore = useCollectionsStore()
const tabsStore = useTabsStore()

const ctx = inject<TreeContext>('treeContext')!

function isExpanded(id: UUID): boolean {
  return ctx.expandedIds.value.has(id)
}

function toggleExpand(id: UUID) {
  if (ctx.expandedIds.value.has(id)) {
    ctx.expandedIds.value.delete(id)
  } else {
    ctx.expandedIds.value.add(id)
  }
}

function openRequest(item: CollectionItem) {
  if (item.type === 'request' && item.request) {
    const sourceId = `${props.collectionId}:${item.id}`
    tabsStore.openRequestTab(JSON.parse(JSON.stringify(item.request)), item.name, sourceId)
  }
}

function addRequestToFolder(folderId: UUID) {
  const newItem: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'request',
    name: 'New Request',
    request: createEmptyRequest(),
  }
  collectionsStore.addItem(props.collectionId, newItem, folderId)
  ctx.expandedIds.value.add(folderId)
}

function addFolderToFolder(folderId: UUID) {
  const folder: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'folder',
    name: 'New Folder',
    items: [],
  }
  collectionsStore.addItem(props.collectionId, folder, folderId)
  ctx.expandedIds.value.add(folderId)
}

function duplicateItem(item: CollectionItem) {
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
  collectionsStore.insertAfter(props.collectionId, item.id, clone)
}
</script>

<template>
  <!-- Folder -->
  <div v-if="item.type === 'folder'">
    <div
      class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item"
      @click="toggleExpand(item.id)"
    >
      <ChevronRight
        class="w-3 h-3 text-muted transition-transform flex-shrink-0"
        :class="{ 'rotate-90': isExpanded(item.id) }"
      />
      <Folder class="w-3.5 h-3.5 text-muted flex-shrink-0" />

      <input
        v-if="ctx.editingId.value === item.id"
        v-model="ctx.editingName.value"
        class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
        @keydown.enter="ctx.finishRenameItem(collectionId, item.id)"
        @keydown.escape="ctx.cancelRename()"
        @blur="ctx.finishRenameItem(collectionId, item.id)"
        @click.stop
      />
      <span v-else class="flex-1 truncate text-primary">{{ item.name }}</span>

      <!-- Folder menu -->
      <div class="opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
        <BaseDropdown align="right">
          <template #trigger>
            <button class="p-0.5 text-muted hover:text-primary rounded">
              <MoreVertical class="w-3 h-3" />
            </button>
          </template>
          <template #content="{ close }">
            <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addRequestToFolder(item.id); close()">
              Add Request
            </button>
            <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="addFolderToFolder(item.id); close()">
              Add Folder
            </button>
            <div class="border-t border-border my-0.5" />
            <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="ctx.startRename(item.id, item.name); close()">
              Rename
            </button>
            <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateItem(item); close()">
              Duplicate
            </button>
            <div class="border-t border-border my-0.5" />
            <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="collectionsStore.removeItem(collectionId, item.id); close()">
              Delete
            </button>
          </template>
        </BaseDropdown>
      </div>
    </div>

    <!-- Folder children (recursive) -->
    <div v-if="isExpanded(item.id)" class="ml-3 border-l border-border-muted pl-2 space-y-0.5">
      <div v-if="!item.items || item.items.length === 0" class="px-2 py-1 text-[10px] text-muted">
        Empty folder
      </div>
      <CollectionTreeItem
        v-for="child in item.items"
        :key="child.id"
        :item="child"
        :collection-id="collectionId"
      />
    </div>
  </div>

  <!-- Request -->
  <div
    v-else-if="item.type === 'request' && item.request"
    class="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item"
    @click="openRequest(item)"
  >
    <BaseBadge :method="item.request.method" />
    <input
      v-if="ctx.editingId.value === item.id"
      v-model="ctx.editingName.value"
      class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
      @keydown.enter="ctx.finishRenameItem(collectionId, item.id)"
      @keydown.escape="ctx.cancelRename()"
      @blur="ctx.finishRenameItem(collectionId, item.id)"
      @click.stop
    />
    <span v-else class="text-primary flex-1 truncate">{{ item.name }}</span>

    <!-- Request menu -->
    <div class="opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
      <BaseDropdown align="right">
        <template #trigger>
          <button class="p-0.5 text-muted hover:text-primary rounded">
            <MoreVertical class="w-3 h-3" />
          </button>
        </template>
        <template #content="{ close }">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="ctx.startRename(item.id, item.name); close()">Rename</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateItem(item); close()">Duplicate</button>
          <div class="border-t border-border my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="collectionsStore.removeItem(collectionId, item.id); close()">Delete</button>
        </template>
      </BaseDropdown>
    </div>
  </div>
</template>
