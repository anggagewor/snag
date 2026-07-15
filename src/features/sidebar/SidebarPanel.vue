<script setup lang="ts">
import { ref } from 'vue'

import { Folder, Clock, FlaskConical, Plus, Zap, FileText, FolderPlus, Upload } from 'lucide-vue-next'

import { useCollectionsStore } from '@/stores/collections'
import { useTabsStore } from '@/stores/tabs'
import { useEnvironmentsStore } from '@/stores/environments'
import type { CollectionItem } from '@/types/collection'
import { createEmptyRequest } from '@/types/request'
import BaseDropdown from '@/components/base/BaseDropdown.vue'
import CollectionTree from './CollectionTree.vue'
import ImportModal from './ImportModal.vue'
import HistoryPanel from '@/features/history/HistoryPanel.vue'

const collectionsStore = useCollectionsStore()
const tabsStore = useTabsStore()
const environmentsStore = useEnvironmentsStore()

const activeSection = ref<'collections' | 'history' | 'envs'>('collections')
const showImportModal = ref(false)

function handleNewRequest() {
  tabsStore.openRequestTab()
}

function handleNewCollection() {
  collectionsStore.createCollection('New Collection')
}

function handleNewRequestInCollection() {
  // Create request in first collection, or create collection if none
  if (collectionsStore.collections.length === 0) {
    collectionsStore.createCollection('New Collection')
  }
  const col = collectionsStore.collections[0]
  const item: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'request',
    name: 'New Request',
    request: createEmptyRequest(),
  }
  collectionsStore.addItem(col.id, item)
}

function handleNewFolderInCollection() {
  if (collectionsStore.collections.length === 0) {
    collectionsStore.createCollection('New Collection')
  }
  const col = collectionsStore.collections[0]
  const item: CollectionItem = {
    id: crypto.randomUUID(),
    type: 'folder',
    name: 'New Folder',
    items: [],
  }
  collectionsStore.addItem(col.id, item)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Sidebar header -->
    <div class="flex items-center justify-between px-3 h-[41px] border-b border-border">
      <!-- Section tabs -->
      <div class="flex items-center gap-0.5">
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeSection === 'collections' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
          title="Collections"
          @click="activeSection = 'collections'"
        >
          <Folder class="w-4 h-4" />
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeSection === 'history' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
          title="History"
          @click="activeSection = 'history'"
        >
          <Clock class="w-4 h-4" />
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors relative"
          :class="activeSection === 'envs' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
          title="Environments"
          @click="activeSection = 'envs'"
        >
          <FlaskConical class="w-4 h-4" />
          <span
            v-if="environmentsStore.activeEnvironmentId"
            class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success"
          />
        </button>
      </div>

      <!-- Actions -->
      <div v-if="activeSection === 'collections'" class="flex items-center gap-0.5">
        <!-- Add dropdown -->
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
              <FileText class="w-3.5 h-3.5 text-muted" />
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
        <div v-if="collectionsStore.collections.length === 0" class="text-center py-8">
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
          <!-- List all environments -->
          <div class="space-y-0.5">
            <div
              v-for="env in environmentsStore.environments"
              :key="env.id"
              class="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-surface-hover"
              :class="environmentsStore.activeEnvironmentId === env.id ? 'text-accent' : 'text-primary'"
              @click="environmentsStore.setActive(environmentsStore.activeEnvironmentId === env.id ? null : env.id)"
            >
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="environmentsStore.activeEnvironmentId === env.id ? 'bg-success' : 'bg-border'"
              />
              <span class="truncate">{{ env.name }}</span>
            </div>
          </div>

          <div v-if="environmentsStore.environments.length === 0" class="px-2 py-2 text-xs text-muted">
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
