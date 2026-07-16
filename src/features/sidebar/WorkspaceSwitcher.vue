<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { ChevronDown, Plus, FolderOpen } from 'lucide-vue-next'
import { useWorkspaceStore } from '@/stores/workspace'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import BaseModal from '@/components/base/BaseModal.vue'

const workspaceStore = useWorkspaceStore()

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const emit = defineEmits<{
  switch: [path: string]
  create: [name: string, path: string]
  open: []
}>()

const showCreateModal = ref(false)
const newWorkspaceName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<InstanceType<typeof BaseDropdown> | null>(null)

function handleSwitch(path: string) {
  dropdownRef.value?.close()
  emit('switch', path)
}

async function handleOpenFolder() {
  dropdownRef.value?.close()
  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({ directory: true, title: 'Open Workspace Folder' })
    if (result) {
      emit('switch', result as string)
    }
  }
}

function openCreateModal() {
  dropdownRef.value?.close()
  showCreateModal.value = true
  newWorkspaceName.value = ''
  nextTick(() => nameInputRef.value?.focus())
}

function closeCreateModal() {
  showCreateModal.value = false
  newWorkspaceName.value = ''
}

async function handleCreate() {
  if (!newWorkspaceName.value.trim()) return

  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const folderPath = await open({ directory: true, title: 'Choose workspace location' })
    if (folderPath) {
      emit('create', newWorkspaceName.value.trim(), folderPath as string)
      closeCreateModal()
    }
  }
}

function truncatePath(path: string, maxLen = 30): string {
  if (path.length <= maxLen) return path
  return '...' + path.slice(-(maxLen - 3))
}
</script>

<template>
  <BaseDropdown ref="dropdownRef" align="left">
    <template #trigger>
      <button
        class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-surface-hover rounded transition-colors max-w-[160px]"
      >
        <span class="truncate">{{ workspaceStore.workspaceName || 'No Workspace' }}</span>
        <ChevronDown class="w-3 h-3 text-muted flex-shrink-0" />
      </button>
    </template>
    <template #content>
      <div class="max-h-[300px] overflow-y-auto">
        <!-- Recent workspaces -->
        <div v-if="workspaceStore.recentWorkspaces.length > 0" class="py-1">
          <div class="px-3 py-1 text-[10px] uppercase text-muted tracking-wide">Recent</div>
          <button
            v-for="entry in workspaceStore.recentWorkspaces"
            :key="entry.id"
            class="w-full flex flex-col items-start px-3 py-1.5 text-xs hover:bg-surface-hover text-left"
            :class="entry.id === workspaceStore.workspaceId ? 'text-accent' : 'text-primary'"
            @click="handleSwitch(entry.path)"
          >
            <span class="font-medium truncate w-full">{{ entry.name }}</span>
            <span class="text-[10px] text-muted truncate w-full">{{ truncatePath(entry.path) }}</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="border-t border-border my-0.5" />

        <!-- Create new workspace -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
          @click="openCreateModal"
        >
          <Plus class="w-3.5 h-3.5 text-muted" />
          Create New Workspace
        </button>

        <!-- Open folder -->
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
          @click="handleOpenFolder"
        >
          <FolderOpen class="w-3.5 h-3.5 text-muted" />
          Open Folder
        </button>
      </div>
    </template>
  </BaseDropdown>

  <!-- Create Workspace Modal -->
  <BaseModal :open="showCreateModal" title="Create New Workspace" @close="closeCreateModal">
    <div class="space-y-3">
      <div class="space-y-1.5">
        <label class="block text-xs text-secondary">Workspace Name</label>
        <input
          ref="nameInputRef"
          v-model="newWorkspaceName"
          type="text"
          placeholder="My API Project"
          class="w-full px-3 py-2 text-sm bg-surface border border-border rounded-md text-primary placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
          @keydown.enter="handleCreate"
        />
      </div>
      <p class="text-xs text-muted">You'll choose a folder location in the next step.</p>
    </div>
    <template #footer>
      <button
        class="px-3 py-1.5 text-sm rounded-md text-secondary hover:text-primary"
        @click="closeCreateModal"
      >
        Cancel
      </button>
      <button
        class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        :disabled="!newWorkspaceName.trim()"
        @click="handleCreate"
      >
        Choose Folder
      </button>
    </template>
  </BaseModal>
</template>
