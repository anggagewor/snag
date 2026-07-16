<script setup lang="ts">
import { inject, computed } from 'vue'

import { ChevronRight, Folder, MoreVertical } from 'lucide-vue-next'

import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import type { CollectionItem } from '@/types/collection'
import type { UUID } from '@/types/common'
import { createEmptyRequest } from '@/types/request'
import { exportToCurl } from '@/utils/export-curl'
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

const isDragOver = computed(() => ctx.drag.dragOverId.value === props.item.id)
const dragPos = computed(() => isDragOver.value ? ctx.drag.dragPosition.value : null)

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

function copyAsCurl(item: CollectionItem) {
  if (item.request) {
    const curl = exportToCurl(item.request)
    navigator.clipboard.writeText(curl)
  }
}

// Drag & Drop handlers
function onDragStart(e: DragEvent) {
  ctx.drag.draggingId.value = props.item.id
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', props.item.id)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (ctx.drag.draggingId.value === props.item.id) return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height

  ctx.drag.dragOverId.value = props.item.id

  if (props.item.type === 'folder') {
    if (y < height * 0.25) {
      ctx.drag.dragPosition.value = 'before'
    } else if (y > height * 0.75) {
      ctx.drag.dragPosition.value = 'after'
    } else {
      ctx.drag.dragPosition.value = 'inside'
    }
  } else {
    ctx.drag.dragPosition.value = y < height / 2 ? 'before' : 'after'
  }

  e.dataTransfer!.dropEffect = 'move'
}

function onDragLeave() {
  if (ctx.drag.dragOverId.value === props.item.id) {
    ctx.drag.dragOverId.value = null
    ctx.drag.dragPosition.value = null
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const dragId = ctx.drag.draggingId.value
  if (!dragId || dragId === props.item.id) {
    resetDrag()
    return
  }

  const position = ctx.drag.dragPosition.value
  const collection = collectionsStore.collections.find((c) => c.id === props.collectionId)
  if (!collection) {
    resetDrag()
    return
  }

  // Find the target item's parent and index
  if (position === 'inside' && props.item.type === 'folder') {
    // Drop inside folder
    collectionsStore.moveItem(props.collectionId, dragId, props.item.id, 0)
    ctx.expandedIds.value.add(props.item.id)
  } else {
    // Drop before/after — find the parent of the target item
    const { parentId, index } = findParentAndIndex(collection.items, props.item.id, null)
    const targetIndex = position === 'after' ? index + 1 : index
    collectionsStore.moveItem(props.collectionId, dragId, parentId, targetIndex)
  }

  resetDrag()
}

function onDragEnd() {
  resetDrag()
}

function resetDrag() {
  ctx.drag.draggingId.value = null
  ctx.drag.dragOverId.value = null
  ctx.drag.dragPosition.value = null
}

function findParentAndIndex(
  items: CollectionItem[],
  targetId: UUID,
  parentId: UUID | null
): { parentId: UUID | null; index: number } {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === targetId) {
      return { parentId, index: i }
    }
    if (items[i].items) {
      const found = findParentAndIndex(items[i].items!, targetId, items[i].id)
      if (found.index !== -1) return found
    }
  }
  return { parentId: null, index: -1 }
}

function focusNext(event: KeyboardEvent) {
  const current = event.currentTarget as HTMLElement
  const allItems = Array.from(
    current.closest('[role="tree"], .space-y-0\\.5')?.querySelectorAll('[role="treeitem"]') || []
  ) as HTMLElement[]
  const index = allItems.indexOf(current)
  if (index < allItems.length - 1) {
    allItems[index + 1].focus()
  }
}

function focusPrev(event: KeyboardEvent) {
  const current = event.currentTarget as HTMLElement
  const allItems = Array.from(
    current.closest('[role="tree"], .space-y-0\\.5')?.querySelectorAll('[role="treeitem"]') || []
  ) as HTMLElement[]
  const index = allItems.indexOf(current)
  if (index > 0) {
    allItems[index - 1].focus()
  }
}
</script>

<template>
  <!-- Folder -->
  <div v-if="item.type === 'folder'">
    <div
      class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item relative"
      :class="{
        'opacity-50': ctx.drag.draggingId.value === item.id,
        'ring-1 ring-accent': dragPos === 'inside',
      }"
      role="treeitem"
      :aria-expanded="isExpanded(item.id)"
      :aria-label="item.name"
      tabindex="0"
      draggable="true"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @dragend="onDragEnd"
      @click="toggleExpand(item.id)"
      @keydown.enter.prevent="toggleExpand(item.id)"
      @keydown.space.prevent="toggleExpand(item.id)"
      @keydown.right.prevent="!isExpanded(item.id) && toggleExpand(item.id)"
      @keydown.left.prevent="isExpanded(item.id) && toggleExpand(item.id)"
      @keydown.down.prevent="focusNext($event)"
      @keydown.up.prevent="focusPrev($event)"
    >
      <!-- Drop indicators -->
      <div v-if="dragPos === 'before'" class="absolute -top-px left-2 right-2 h-0.5 bg-accent rounded" />
      <div v-if="dragPos === 'after'" class="absolute -bottom-px left-2 right-2 h-0.5 bg-accent rounded" />

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
    class="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item relative"
    :class="{ 'opacity-50': ctx.drag.draggingId.value === item.id }"
    role="treeitem"
    :aria-label="`${item.request.method} ${item.name}`"
    tabindex="0"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @dragend="onDragEnd"
    @click="openRequest(item)"
    @keydown.enter.prevent="openRequest(item)"
    @keydown.space.prevent="openRequest(item)"
    @keydown.down.prevent="focusNext($event)"
    @keydown.up.prevent="focusPrev($event)"
  >
    <!-- Drop indicators -->
    <div v-if="dragPos === 'before'" class="absolute -top-px left-2 right-2 h-0.5 bg-accent rounded" />
    <div v-if="dragPos === 'after'" class="absolute -bottom-px left-2 right-2 h-0.5 bg-accent rounded" />

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
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="copyAsCurl(item); close()">Copy as cURL</button>
          <div class="border-t border-border my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="collectionsStore.removeItem(collectionId, item.id); close()">Delete</button>
        </template>
      </BaseDropdown>
    </div>
  </div>
</template>
