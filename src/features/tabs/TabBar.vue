<script setup lang="ts">
import { ref, nextTick } from 'vue'

import { Settings, Check, Save, Plus, Folder, FlaskConical, PanelLeft } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import { useCollectionsStore } from '@/stores/collections'
import { ProtocolType } from '@/types/common'
import type { UUID } from '@/types/common'
import type { CollectionItem } from '@/types/collection'
import type { Tab } from '@/stores/tabs'
import BaseTab from '@/components/base/BaseTab.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import EnvironmentSelector from '@/features/environments/EnvironmentSelector.vue'

const tabsStore = useTabsStore()
const collectionsStore = useCollectionsStore()

const emit = defineEmits<{
  toggleSidebar: []
}>()

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

function handleSaveAndClose() {
  const tabId = tabsStore.pendingCloseTabId
  if (!tabId) return
  const tab = tabsStore.tabs.find((t) => t.id === tabId)
  if (tab && tab.type === 'request' && tab.isDirty) {
    if (tab.sourceId) {
      tabsStore.saveTab(tabId)
    }
  }
  tabsStore.forceCloseTab(tabId)
}
</script>

<template>
  <div class="flex items-center h-[41px] border-b border-border bg-surface-alt">
    <!-- Sidebar toggle -->
    <button
      class="p-2 mx-0.5 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors flex-shrink-0"
      title="Toggle Sidebar (Cmd+B)"
      @click="emit('toggleSidebar')"
    >
      <PanelLeft class="w-4 h-4" />
    </button>

    <!-- Scrollable tab area -->
    <div class="flex-1 flex items-center overflow-x-auto">
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
          <span
            v-if="tab.protocol && tab.protocol !== ProtocolType.REST"
            class="text-[9px] font-bold uppercase px-1 py-0.5 rounded mr-0.5"
            :class="{
              'bg-amber-500/10 text-amber-500': tab.protocol === ProtocolType.WEBSOCKET,
              'bg-pink-500/10 text-pink-500': tab.protocol === ProtocolType.GRAPHQL,
              'bg-blue-500/10 text-blue-500': tab.protocol === ProtocolType.GRPC,
            }"
          >
            {{ tab.protocol === ProtocolType.WEBSOCKET ? 'WS' : tab.protocol === ProtocolType.GRAPHQL ? 'GQL' : 'gRPC' }}
          </span>
          <BaseBadge v-else :method="tab.request.method" />
        </template>
        <!-- Settings icon -->
        <template v-else-if="tab.type === 'settings'">
          <Settings class="w-3.5 h-3.5 text-muted" />
        </template>
        <!-- Environments icon -->
        <template v-else-if="tab.type === 'environments'">
          <FlaskConical class="w-3.5 h-3.5 text-muted" />
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
          <Check class="w-3 h-3" />
        </span>
      </BaseTab>
    </div>

    <!-- New tab button (always visible, outside scroll area) -->
    <button
      class="p-1.5 mx-0.5 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors flex-shrink-0"
      title="New Request (Cmd+T)"
      @click="tabsStore.openRequestTab()"
    >
      <Plus class="w-4 h-4" />
    </button>

    <!-- Right actions -->
    <div class="flex items-center gap-0.5 px-2 flex-shrink-0 border-l border-border">
      <!-- Save active tab -->
      <button
        v-if="tabsStore.activeTab?.type === 'request'"
        class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
        :class="{ 'text-warning': tabsStore.activeTab?.isDirty }"
        :title="tabsStore.activeTab?.sourceId ? 'Save (Cmd+S)' : 'Save to Collection (Cmd+S)'"
        @click="tabsStore.activeTab && handleSave(tabsStore.activeTab)"
      >
        <Save class="w-4 h-4" />
      </button>
      <!-- Settings -->
      <button
        class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
        title="Settings"
        @click="tabsStore.openSettingsTab()"
      >
        <Settings class="w-4 h-4" />
      </button>
      <!-- Environment selector -->
      <div class="ml-1">
        <EnvironmentSelector />
      </div>
    </div>
  </div>

  <!-- Unsaved Changes Warning Modal -->
  <BaseModal :open="!!tabsStore.pendingCloseTabId" title="Unsaved Changes" @close="tabsStore.cancelCloseTab()">
    <p class="text-sm text-secondary">
      This tab has unsaved changes. Do you want to save before closing?
    </p>
    <template #footer>
      <button class="px-3 py-1.5 text-sm rounded-md text-secondary hover:text-primary" @click="tabsStore.cancelCloseTab()">
        Cancel
      </button>
      <button class="px-3 py-1.5 text-sm rounded-md text-error hover:bg-error/5" @click="tabsStore.forceCloseTab(tabsStore.pendingCloseTabId!)">
        Discard
      </button>
      <button class="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover" @click="handleSaveAndClose()">
        Save & Close
      </button>
    </template>
  </BaseModal>

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
            <Folder class="w-4 h-4 text-warning flex-shrink-0" />
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
                  <Folder class="w-3.5 h-3.5 text-muted flex-shrink-0" />
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
