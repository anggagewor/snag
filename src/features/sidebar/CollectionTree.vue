<script setup lang="ts">
import { provide, ref, onMounted } from 'vue'

import { ChevronRight, Folder, MoreVertical, Zap, FolderPlus, Pencil, Trash2, Variable } from 'lucide-vue-next'

import { useWorkspaceStore } from '@/stores/workspace'
import { useWorkspaceService } from '@/services/provider'
import type { Collection, TreeNode } from '@/domain'
import type { CollectionId, FolderId, RequestId } from '@/domain'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import CollectionTreeItem from './CollectionTreeItem.vue'
import type { TreeContext } from './collectionTreeContext'

const workspaceStore = useWorkspaceStore()

const expandedIds = ref<Set<string>>(new Set())
const editingId = ref<string | null>(null)
const editingName = ref('')

// Cache for request display data (loaded lazily)
const requestNames = ref<Map<string, string>>(new Map())
const requestMethods = ref<Map<string, string>>(new Map())
const requestUrls = ref<Map<string, string>>(new Map())

// Drag & drop state
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragPosition = ref<'before' | 'after' | 'inside' | null>(null)

// Load request names for tree display
async function loadRequestMeta(nodes: readonly TreeNode[]) {
  for (const node of nodes) {
    if (node.type === 'request') {
      if (!requestNames.value.has(node.requestId)) {
        try {
          const req = await workspaceStore.getRequest(node.requestId as RequestId)
          requestNames.value.set(node.requestId, req.name)
          requestMethods.value.set(node.requestId, req.method)
          requestUrls.value.set(node.requestId, req.url)
        } catch {
          requestNames.value.set(node.requestId, 'Unknown Request')
          requestMethods.value.set(node.requestId, 'GET')
          requestUrls.value.set(node.requestId, '')
        }
      }
    } else if (node.type === 'folder') {
      await loadRequestMeta(node.children)
    }
  }
}

onMounted(async () => {
  for (const col of workspaceStore.collections) {
    await loadRequestMeta(col.items)
  }
})

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id)
}

function startRename(id: string, currentName: string) {
  editingId.value = id
  editingName.value = currentName
}

async function finishRenameCollection(collectionId: string) {
  if (editingId.value && editingName.value.trim()) {
    await workspaceStore.renameCollection(collectionId as CollectionId, editingName.value.trim())
  }
  editingId.value = null
  editingName.value = ''
}

async function finishRenameItem(collectionId: string, itemId: string) {
  if (!editingId.value || !editingName.value.trim()) {
    editingId.value = null
    editingName.value = ''
    return
  }

  // Check if it's a folder rename or request rename
  const collection = workspaceStore.collections.find(c => c.id === collectionId)
  if (!collection) return

  const isFolder = findFolderInTree(collection.items, itemId)
  if (isFolder) {
    await workspaceStore.renameFolder(collectionId as CollectionId, itemId as FolderId, editingName.value.trim())
  } else {
    // It's a request — update the request file name
    try {
      const request = await workspaceStore.getRequest(itemId as RequestId)
      const updated = { ...request, name: editingName.value.trim() }
      await workspaceStore.saveRequest(updated)
      requestNames.value.set(itemId, editingName.value.trim())
    } catch {
      // Request might not exist
    }
  }

  editingId.value = null
  editingName.value = ''
}

function findFolderInTree(nodes: readonly TreeNode[], id: string): boolean {
  for (const node of nodes) {
    if (node.type === 'folder') {
      if (node.id === id) return true
      if (findFolderInTree(node.children, id)) return true
    }
  }
  return false
}

function cancelRename() {
  editingId.value = null
  editingName.value = ''
}

async function deleteCollection(id: string) {
  await workspaceStore.deleteCollection(id as CollectionId)
}

async function addRequestToCollection(collectionId: string) {
  const request = await workspaceStore.createRequest(collectionId as CollectionId, null)
  requestNames.value.set(request.id, request.name)
  requestMethods.value.set(request.id, request.method)
  expandedIds.value.add(collectionId)
}

async function addFolderToCollection(collectionId: string) {
  await workspaceStore.addFolder(collectionId as CollectionId, null, 'New Folder')
  expandedIds.value.add(collectionId)
}

// Provide tree context for recursive children
const treeContext: TreeContext = {
  expandedIds,
  editingId,
  editingName,
  requestNames,
  requestMethods,
  requestUrls,
  startRename,
  finishRenameItem,
  cancelRename,
  drag: {
    draggingId,
    dragOverId,
    dragPosition,
  },
}

provide('treeContext', treeContext)

// Collection variables editing
const showVariablesModal = ref(false)
const editingCollectionId = ref<string | null>(null)
const editingVariables = ref<{ key: string; value: string; enabled: boolean }[]>([])

function openVariablesEditor(collection: Collection) {
  editingCollectionId.value = collection.id
  editingVariables.value = collection.variables.map(v => ({ ...v }))
  showVariablesModal.value = true
}

function addVariable() {
  editingVariables.value.push({ key: '', value: '', enabled: true })
}

function removeVariable(index: number) {
  editingVariables.value.splice(index, 1)
}

async function saveVariables() {
  if (!editingCollectionId.value) return
  const collection = workspaceStore.collections.find(c => c.id === editingCollectionId.value)
  if (collection) {
    const updated: Collection = {
      ...collection,
      variables: editingVariables.value.filter(v => v.key.trim()),
    }
    const service = useWorkspaceService()
    await service.saveCollection(updated)
    await workspaceStore.reloadCollection(updated.id)
  }
  showVariablesModal.value = false
}
</script>

<template>
  <div class="space-y-0.5" role="tree" aria-label="Collections">
    <div v-for="collection in workspaceStore.collections" :key="collection.id">
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
              <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-primary hover:bg-surface-hover text-left" @click="openVariablesEditor(collection); close()">
                <Variable class="w-3.5 h-3.5 text-muted" />
                Variables
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
          v-for="(item, itemIndex) in collection.items"
          :key="item.type === 'folder' ? item.id : item.requestId"
          :item="item"
          :collection-id="collection.id"
          :parent-folder-id="null"
          :index-in-parent="itemIndex"
        />
      </div>
    </div>
  </div>

  <!-- Collection Variables Modal -->
  <BaseModal :open="showVariablesModal" title="Collection Variables" @close="showVariablesModal = false">
    <div class="space-y-2">
      <p class="text-[10px] text-muted">
        Variables scoped to this collection. Use <code v-pre class="bg-surface-alt px-1 rounded">{{variableName}}</code> in requests.
      </p>
      <div class="space-y-1.5 max-h-[240px] overflow-y-auto">
        <div v-for="(variable, i) in editingVariables" :key="i" class="flex items-center gap-2">
          <input
            v-model="variable.key"
            class="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent"
            placeholder="Variable name"
          />
          <input
            v-model="variable.value"
            class="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent"
            placeholder="Value"
          />
          <button class="p-1 text-muted hover:text-error rounded" @click="removeVariable(i)">
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
      </div>
      <button
        class="w-full px-2 py-1.5 text-xs text-center text-accent hover:bg-accent/5 rounded border border-dashed border-border transition-colors"
        @click="addVariable()"
      >
        + Add Variable
      </button>
    </div>
    <template #footer>
      <button class="px-3 py-1.5 text-sm rounded-md text-secondary hover:text-primary" @click="showVariablesModal = false">
        Cancel
      </button>
      <button class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover" @click="saveVariables()">
        Save
      </button>
    </template>
  </BaseModal>
</template>
