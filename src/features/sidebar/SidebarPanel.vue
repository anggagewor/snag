<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { Folder, Clock, FlaskConical, Plus, Zap, FolderPlus, Upload } from 'lucide-vue-next'

import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import type { CollectionId } from '@/domain'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import CollectionTree from './CollectionTree.vue'
import ImportModal from './ImportModal.vue'
import HistoryPanel from '@/features/history/HistoryPanel.vue'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

const activeSection = ref<'collections' | 'history' | 'envs'>('collections')
const showImportModal = ref(false)

onMounted(async () => {
  await workspaceStore.loadRecentWorkspaces()
})

async function handleWorkspaceSwitch(path: string) {
  try {
    await workspaceStore.switchWorkspace(path)
  } catch (err) {
    console.error('[Sidebar] Workspace switch failed:', err)
  }
}

async function handleWorkspaceCreate(name: string, path: string) {
  try {
    await workspaceStore.createWorkspace(name, path)
    const { useSettingsStore } = await import('@/stores/settings')
    const settingsStore = useSettingsStore()
    await settingsStore.reloadWorkspaceSettings()
  } catch (err) {
    console.error('[Sidebar] Workspace creation failed:', err)
  }
}

function handleNewRequest() {
  tabsStore.openRequestTab()
}

async function handleNewCollection() {
  await workspaceStore.createCollection('New Collection')
}

async function handleNewRequestInCollection() {
  if (workspaceStore.collections.length === 0) {
    await workspaceStore.createCollection('New Collection')
  }
  const col = workspaceStore.collections[0]
  await workspaceStore.createRequest(col.id as CollectionId, null)
}

async function handleNewFolderInCollection() {
  if (workspaceStore.collections.length === 0) {
    await workspaceStore.createCollection('New Collection')
  }
  const col = workspaceStore.collections[0]
  await workspaceStore.addFolder(col.id as CollectionId, null, 'New Folder')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Workspace switcher row -->
    <div class="flex items-center px-3 h-[33px] border-b border-border">
      <WorkspaceSwitcher
        @switch="handleWorkspaceSwitch"
        @create="handleWorkspaceCreate"
      />
    </div>

    <!-- Sidebar header -->
    <div class="flex items-center justify-between px-3 h-[41px] border-b border-border">
      <!-- Section tabs -->
      <div class="flex items-center gap-0.5">
        <BaseTooltip text="Collections" position="bottom">
          <button
            class="px-2 py-1 text-xs rounded transition-colors"
            :class="activeSection === 'collections' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
            @click="activeSection = 'collections'"
          >
            <Folder class="w-4 h-4" />
          </button>
        </BaseTooltip>
        <BaseTooltip text="History" position="bottom">
          <button
            class="px-2 py-1 text-xs rounded transition-colors"
            :class="activeSection === 'history' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
            @click="activeSection = 'history'"
          >
            <Clock class="w-4 h-4" />
          </button>
        </BaseTooltip>
        <BaseTooltip text="Environments" shortcut="⌘E" position="bottom">
          <button
            class="px-2 py-1 text-xs rounded transition-colors relative"
            :class="activeSection === 'envs' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
            @click="activeSection = 'envs'"
          >
            <FlaskConical class="w-4 h-4" />
            <span
              v-if="workspaceStore.activeEnvironmentId"
              class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success"
            />
          </button>
        </BaseTooltip>
      </div>

      <!-- Actions -->
      <div v-if="activeSection === 'collections'" class="flex items-center gap-0.5">
        <BaseDropdown align="right">
          <template #trigger>
            <button class="p-1.5 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors">
              <Plus class="w-4 h-4" />
            </button>
          </template>
          <template #content="{ close }">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewRequest(); close()"
            >
              <Zap class="w-3.5 h-3.5 text-muted" />
              New Request Tab
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewRequestInCollection(); close()"
            >
              <Zap class="w-3.5 h-3.5 text-muted" />
              New Request in Collection
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewFolderInCollection(); close()"
            >
              <FolderPlus class="w-3.5 h-3.5 text-muted" />
              New Folder
            </button>
            <div class="border-t border-border my-0.5" />
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewCollection(); close()"
            >
              <Folder class="w-3.5 h-3.5 text-muted" />
              New Collection
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="showImportModal = true; close()"
            >
              <Upload class="w-3.5 h-3.5 text-muted" />
              Import Collection
            </button>
          </template>
        </BaseDropdown>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Collections -->
      <div v-if="activeSection === 'collections'" class="p-2">
        <div v-if="workspaceStore.collections.length === 0" class="text-center py-8">
          <Folder class="w-10 h-10 mx-auto text-muted/30 mb-2" :stroke-width="1.5" />
          <p class="text-xs text-muted">No collections yet</p>
          <p class="text-[10px] text-muted mt-0.5">Create one to organize your requests</p>
        </div>
        <CollectionTree v-else />
      </div>

      <!-- History -->
      <HistoryPanel v-else-if="activeSection === 'history'" />

      <!-- Environments quick view -->
      <div v-else-if="activeSection === 'envs'" class="p-2">
        <div class="space-y-2">
          <div class="space-y-0.5">
            <div
              v-for="env in workspaceStore.environments"
              :key="env.id"
              class="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-surface-hover"
              :class="workspaceStore.activeEnvironmentId === env.id ? 'text-accent' : 'text-primary'"
              @click="workspaceStore.setActiveEnvironment(workspaceStore.activeEnvironmentId === env.id ? null : env.id)"
            >
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="workspaceStore.activeEnvironmentId === env.id ? 'bg-success' : 'bg-border'"
              />
              <span class="truncate">{{ env.name }}</span>
            </div>
          </div>

          <div v-if="workspaceStore.environments.length === 0" class="px-2 py-2 text-xs text-muted">
            No environments yet
          </div>

          <button
            class="w-full px-2 py-2 text-xs text-center text-accent hover:bg-accent/5 rounded border border-dashed border-border transition-colors"
            @click="tabsStore.openEnvironmentsTab()"
          >
            Manage Environments
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Import Modal -->
  <ImportModal :open="showImportModal" @close="showImportModal = false" />
</template>
