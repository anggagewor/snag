<script setup lang="ts">
import { inject, computed } from 'vue'

import { ChevronRight, Folder, MoreVertical } from 'lucide-vue-next'

import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import type { TreeNode } from '@/domain'
import type { CollectionId, FolderId, RequestId } from '@/domain'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import type { TreeContext } from './collectionTreeContext'

const props = defineProps<{
  item: TreeNode
  collectionId: string
  parentFolderId?: string | null
  indexInParent: number
}>()

const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

const ctx = inject<TreeContext>('treeContext')!

const itemId = computed(() =>
  props.item.type === 'folder' ? props.item.id : props.item.requestId
)

const isDragOver = computed(() => ctx.drag.dragOverId.value === itemId.value)
const dragPos = computed(() => isDragOver.value ? ctx.drag.dragPosition.value : null)

function isExpanded(id: string): boolean {
  return ctx.expandedIds.value.has(id)
}

function toggleExpand(id: string) {
  if (ctx.expandedIds.value.has(id)) {
    ctx.expandedIds.value.delete(id)
  } else {
    ctx.expandedIds.value.add(id)
  }
}

async function openRequest(requestId: string) {
  try {
    const request = await workspaceStore.getRequest(requestId as RequestId)
    const sourceId = `${props.collectionId}:${requestId}`
    tabsStore.openRequestTab(requestId as RequestId, sourceId, request.name)
  } catch (err) {
    console.error('[CollectionTreeItem] Failed to open request:', err)
  }
}

async function addRequestToFolder(folderId: string) {
  const request = await workspaceStore.createRequest(
    props.collectionId as CollectionId,
    folderId as FolderId,
  )
  ctx.requestNames.value.set(request.id, request.name)
  ctx.requestMethods.value.set(request.id, request.method)
  ctx.expandedIds.value.add(folderId)
}

async function addFolderToFolder(folderId: string) {
  await workspaceStore.addFolder(props.collectionId as CollectionId, folderId as FolderId, 'New Folder')
  ctx.expandedIds.value.add(folderId)
}

async function deleteItem() {
  if (props.item.type === 'folder') {
    await workspaceStore.removeFolder(props.collectionId as CollectionId, props.item.id as FolderId)
  } else {
    await workspaceStore.deleteRequest(props.item.requestId as RequestId)
  }
}

async function duplicateRequest() {
  if (props.item.type !== 'request') return
  const duplicate = await workspaceStore.duplicateRequest(props.item.requestId as RequestId)
  ctx.requestNames.value.set(duplicate.id, duplicate.name)
  ctx.requestMethods.value.set(duplicate.id, duplicate.method)
  // Reload collection since service now inserts the ref in the tree
  await workspaceStore.reloadCollection(props.collectionId as CollectionId)
}

// Drag & Drop handlers
function onDragStart(e: DragEvent) {
  ctx.drag.draggingId.value = itemId.value
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', itemId.value)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (ctx.drag.draggingId.value === itemId.value) return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const y = e.clientY - rect.top
  const height = rect.height

  ctx.drag.dragOverId.value = itemId.value

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
  if (ctx.drag.dragOverId.value === itemId.value) {
    ctx.drag.dragOverId.value = null
    ctx.drag.dragPosition.value = null
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  const dragId = ctx.drag.draggingId.value
  if (!dragId || dragId === itemId.value) {
    resetDrag()
    return
  }

  const position = ctx.drag.dragPosition.value

  if (position === 'inside' && props.item.type === 'folder') {
    await workspaceStore.moveItem(
      props.collectionId as CollectionId,
      dragId as RequestId | FolderId,
      props.item.id as FolderId,
      0,
    )
    ctx.expandedIds.value.add(props.item.id)
  } else {
    // Drop before/after this item — insert relative to this item's position in parent
    const targetIndex = position === 'after' ? props.indexInParent + 1 : props.indexInParent
    await workspaceStore.moveItem(
      props.collectionId as CollectionId,
      dragId as RequestId | FolderId,
      (props.parentFolderId as FolderId) ?? null,
      targetIndex,
    )
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

function getRequestName(requestId: string): string {
  return ctx.requestNames.value.get(requestId) ?? 'Loading...'
}

function getRequestMethod(requestId: string): string {
  return ctx.requestMethods.value.get(requestId) ?? 'GET'
}

function getRequestUrl(requestId: string): string {
  return ctx.requestUrls.value.get(requestId) ?? ''
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
            <div class="border-t border-border my-0.5" />
            <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="deleteItem(); close()">
              Delete
            </button>
          </template>
        </BaseDropdown>
      </div>
    </div>

    <!-- Folder children (recursive) -->
    <div v-if="isExpanded(item.id)" class="ml-3 border-l border-border-muted pl-2 space-y-0.5">
      <div v-if="item.children.length === 0" class="px-2 py-1 text-[10px] text-muted">
        Empty folder
      </div>
      <CollectionTreeItem
        v-for="(child, childIndex) in item.children"
        :key="child.type === 'folder' ? child.id : child.requestId"
        :item="child"
        :collection-id="collectionId"
        :parent-folder-id="item.id"
        :index-in-parent="childIndex"
      />
    </div>
  </div>

  <!-- Request -->
  <div
    v-else-if="item.type === 'request'"
    class="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer group/item relative"
    :class="{ 'opacity-50': ctx.drag.draggingId.value === item.requestId }"
    role="treeitem"
    :aria-label="`${getRequestMethod(item.requestId)} ${getRequestName(item.requestId)}`"
    tabindex="0"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @dragend="onDragEnd"
    @click="openRequest(item.requestId)"
    @keydown.enter.prevent="openRequest(item.requestId)"
    @keydown.space.prevent="openRequest(item.requestId)"
  >
    <!-- Drop indicators -->
    <div v-if="dragPos === 'before'" class="absolute -top-px left-2 right-2 h-0.5 bg-accent rounded" />
    <div v-if="dragPos === 'after'" class="absolute -bottom-px left-2 right-2 h-0.5 bg-accent rounded" />

    <BaseBadge :method="getRequestMethod(item.requestId) as any" />
    <input
      v-if="ctx.editingId.value === item.requestId"
      v-model="ctx.editingName.value"
      class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
      @keydown.enter="ctx.finishRenameItem(collectionId, item.requestId)"
      @keydown.escape="ctx.cancelRename()"
      @blur="ctx.finishRenameItem(collectionId, item.requestId)"
      @click.stop
    />
    <BaseTooltip v-else :text="getRequestUrl(item.requestId) || getRequestName(item.requestId)" position="bottom" :delay="500" block>
      <span class="text-primary flex-1 truncate">{{ getRequestName(item.requestId) }}</span>
    </BaseTooltip>

    <!-- Request menu -->
    <div class="opacity-0 group-hover/item:opacity-100 transition-opacity" @click.stop>
      <BaseDropdown align="right">
        <template #trigger>
          <button class="p-0.5 text-muted hover:text-primary rounded">
            <MoreVertical class="w-3 h-3" />
          </button>
        </template>
        <template #content="{ close }">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="ctx.startRename(item.requestId, getRequestName(item.requestId)); close()">Rename</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="duplicateRequest(); close()">Duplicate</button>
          <div class="border-t border-border my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/5 text-left" @click="deleteItem(); close()">Delete</button>
        </template>
      </BaseDropdown>
    </div>
  </div>
</template>
