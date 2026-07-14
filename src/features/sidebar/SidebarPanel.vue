<script setup lang="ts">
import { ref } from 'vue'

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
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeSection === 'history' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
          title="History"
          @click="activeSection = 'history'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors relative"
          :class="activeSection === 'envs' ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-primary'"
          title="Environments"
          @click="activeSection = 'envs'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
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
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </template>
          <template #content="{ close }">
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewRequest(); close()"
            >
              <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              New Request Tab
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewRequestInCollection(); close()"
            >
              <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              New Request in Collection
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewFolderInCollection(); close()"
            >
              <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              New Folder
            </button>
            <div class="border-t border-border my-0.5" />
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="handleNewCollection(); close()"
            >
              <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              New Collection
            </button>
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-surface-hover text-left"
              @click="showImportModal = true; close()"
            >
              <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
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
          <svg class="w-10 h-10 mx-auto text-muted/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
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
