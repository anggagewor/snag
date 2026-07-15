<script setup lang="ts">
import { ref, nextTick } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import { useCollectionsStore } from '@/stores/collections'
import type { UUID } from '@/types/common'
import type { CollectionItem } from '@/types/collection'
import type { Tab } from '@/stores/tabs'
import BaseTab from '@/components/base/BaseTab.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseModal from '@/components/base/BaseModal.vue'

const tabsStore = useTabsStore()
const collectionsStore = useCollectionsStore()

// Rename state
const renamingTabId = ref<UUID | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// Save to collection modal
const showSaveModal = ref(false)
const saveTargetCollectionId = ref<UUID | null>(null)
const saveTargetFolderId = ref<UUID | null>(null)

function startRename(tabId: UUID, currentTitle: string) {
  renamingTabId.value = tabId
  renameValue.value = currentTitle
  nextTick(() => renameInputRef.value?.focus())
}

function finishRename() {
  if (renamingTabId.value && renameValue.value.trim()) {
    tabsStore.updateTabTitle(renamingTabId.value, renameValue.value.trim())
  }
  renamingTabId.value = null
}

function cancelRename() {
  renamingTabId.value = null
}

/**
 * Save tab: if it has a sourceId, save back to collection directly.
 * Otherwise, open the "Save to Collection" modal.
 */
function handleSave(tab: Tab) {
  if (tab.sourceId) {
    tabsStore.saveTab(tab.id)
  } else {
    openSaveModal()
  }
}

function openSaveModal() {
  showSaveModal.value = true
  saveTargetCollectionId.value = collectionsStore.collections[0]?.id || null
  saveTargetFolderId.value = null
}

function saveToCollection() {
  const tab = tabsStore.activeTab
  if (!tab || tab.type !== 'request' || !tab.request || !saveTargetCollectionId.value) return

  const itemId = crypto.randomUUID()
  const item: CollectionItem = {
    id: itemId,
    type: 'request',
    name: tab.title,
    request: JSON.parse(JSON.stringify(tab.request)),
  }
  collectionsStore.addItem(saveTargetCollectionId.value, item, saveTargetFolderId.value || undefined)

  // Link this tab to the new collection item via store action
  tabsStore.linkTabToSource(tab.id, `${saveTargetCollectionId.value}:${itemId}`)
  showSaveModal.value = false
}
</script>

<template>
  <div class="flex items-center h-[41px] border-b border-border bg-surface-alt">
    <div class="flex-1 flex overflow-x-auto">
      <BaseTab
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        :active="tab.id === tabsStore.activeTabId"
        :closable="true"
        @click="tabsStore.setActiveTab(tab.id)"
        @dblclick="tab.type === 'request' && startRename(tab.id, tab.title)"
        @close="tabsStore.closeTab(tab.id)"
      >
        <!-- Request tab -->
        <template v-if="tab.type === 'request' && tab.request">
          <BaseBadge :method="tab.request.method" />
        </template>
        <!-- Settings icon -->
        <template v-else-if="tab.type === 'settings'">
          <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </template>
        <!-- Environments icon -->
        <template v-else-if="tab.type === 'environments'">
          <svg class="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </template>

        <!-- Tab title / rename input -->
        <template v-if="renamingTabId === tab.id">
          <input
            ref="renameInputRef"
            v-model="renameValue"
            class="ml-1 w-[100px] bg-surface border border-accent rounded px-1 py-0.5 text-xs text-primary focus:outline-none"
            @keydown.enter="finishRename"
            @keydown.escape="cancelRename"
            @blur="finishRename"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="ml-1 max-w-[120px] truncate">{{ tab.title }}</span>
        </template>

        <!-- Dirty indicator -->
        <span v-if="tab.isDirty" class="w-2 h-2 rounded-full bg-warning flex-shrink-0" title="Unsaved changes" />

        <!-- Per-tab save button (only for dirty request tabs) -->
        <span
          v-if="tab.type === 'request' && tab.isDirty"
          class="ml-0.5 p-0.5 text-muted hover:text-success rounded transition-colors"
          title="Save"
          @click.stop="handleSave(tab)"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </BaseTab>
    </div>

    <!-- Right actions -->
    <div class="flex items-center gap-0.5 px-1 flex-shrink-0">
      <!-- Save active tab -->
      <button
        v-if="tabsStore.activeTab?.type === 'request'"
        class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
        :class="{ 'text-warning': tabsStore.activeTab?.isDirty }"
        :title="tabsStore.activeTab?.sourceId ? 'Save (Cmd+S)' : 'Save to Collection (Cmd+S)'"
        @click="tabsStore.activeTab && handleSave(tabsStore.activeTab)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      </button>
      <!-- New tab -->
      <button
        class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
        title="New Request (Cmd+T)"
        @click="tabsStore.openRequestTab()"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <!-- Settings -->
      <button
        class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
        title="Settings"
        @click="tabsStore.openSettingsTab()"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Save to Collection Modal -->
  <BaseModal :open="showSaveModal" title="Save to Collection" @close="showSaveModal = false">
    <div class="space-y-3">
      <div v-if="collectionsStore.collections.length === 0" class="text-sm text-muted text-center py-4">
        <p>No collections yet.</p>
        <button
          class="mt-2 px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover"
          @click="collectionsStore.createCollection('My Collection'); saveTargetCollectionId = collectionsStore.collections[0]?.id"
        >
          Create Collection
        </button>
      </div>
      <template v-else>
        <!-- Collection selection -->
        <label class="block text-xs text-secondary">Collection</label>
        <div class="space-y-1 max-h-[160px] overflow-y-auto">
          <button
            v-for="col in collectionsStore.collections"
            :key="col.id"
            class="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors"
            :class="saveTargetCollectionId === col.id ? 'bg-accent/10 text-accent border border-accent/30' : 'hover:bg-surface-hover text-primary border border-transparent'"
            @click="saveTargetCollectionId = col.id; saveTargetFolderId = null"
          >
            <svg class="w-4 h-4 text-warning flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>{{ col.name }}</span>
            <span class="ml-auto text-xs text-muted">{{ col.items.length }} items</span>
          </button>
        </div>

        <!-- Folder selection (if collection has folders) -->
        <template v-if="saveTargetCollectionId">
          <template v-for="col in collectionsStore.collections" :key="'folder-' + col.id">
            <template v-if="col.id === saveTargetCollectionId && col.items.filter(i => i.type === 'folder').length > 0">
              <label class="block text-xs text-secondary mt-3">Folder (optional)</label>
              <div class="space-y-1 max-h-[120px] overflow-y-auto">
                <button
                  class="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-colors"
                  :class="!saveTargetFolderId ? 'bg-accent/10 text-accent border border-accent/30' : 'hover:bg-surface-hover text-primary border border-transparent'"
                  @click="saveTargetFolderId = null"
                >
                  <span class="text-muted">—</span>
                  <span>Root (no folder)</span>
                </button>
                <button
                  v-for="folder in col.items.filter(i => i.type === 'folder')"
                  :key="folder.id"
                  class="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-colors"
                  :class="saveTargetFolderId === folder.id ? 'bg-accent/10 text-accent border border-accent/30' : 'hover:bg-surface-hover text-primary border border-transparent'"
                  @click="saveTargetFolderId = folder.id"
                >
                  <svg class="w-3.5 h-3.5 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>{{ folder.name }}</span>
                </button>
              </div>
            </template>
          </template>
        </template>
      </template>
    </div>
    <template #footer>
      <button class="px-3 py-1.5 text-sm rounded-md text-secondary hover:text-primary" @click="showSaveModal = false">
        Cancel
      </button>
      <button
        class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        :disabled="!saveTargetCollectionId"
        @click="saveToCollection"
      >
        Save
      </button>
    </template>
  </BaseModal>
</template>
