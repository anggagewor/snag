<script setup lang="ts">
import { ref, nextTick } from 'vue'

import { Settings, Check, Save, Plus, Folder, FlaskConical, PanelLeft, Cookie } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Tab } from '@/stores/tabs'
import type { CollectionId, FolderId } from '@/domain'
import BaseTab from '@/components/base/BaseTab.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import BaseTooltip from '@/components/base/BaseTooltip.vue'
import EnvironmentSelector from '@/features/environments/EnvironmentSelector.vue'

const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()

const emit = defineEmits<{
  toggleSidebar: []
}>()

// Rename state
const renamingTabId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

// Save to collection modal
const showSaveModal = ref(false)
const saveTargetCollectionId = ref<string | null>(null)
const saveTargetFolderId = ref<string | null>(null)

function startRename(tabId: string, currentTitle: string) {
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
 * Save tab: if it has a sourceId, save via store.
 * Otherwise, open the "Save to Collection" modal.
 */
async function handleSave(tab: Tab) {
  if (tab.sourceId) {
    await tabsStore.saveTab(tab.id)
  } else {
    openSaveModal()
  }
}

function openSaveModal() {
  showSaveModal.value = true
  saveTargetCollectionId.value = workspaceStore.collections[0]?.id || null
  saveTargetFolderId.value = null
}

async function saveToCollection() {
  const tab = tabsStore.activeTab
  if (!tab || tab.type !== 'request' || !tab.requestDraft || !saveTargetCollectionId.value) return

  const request = await workspaceStore.createRequest(
    saveTargetCollectionId.value as CollectionId,
    saveTargetFolderId.value as FolderId | null,
    { name: tab.title, method: tab.requestDraft.method as any },
  )

  // Link tab to the new request so subsequent saves go through saveTab
  const sourceId = `${saveTargetCollectionId.value}:${request.id}`
  tabsStore.linkTabToSource(tab.id, sourceId)

  // Now assign requestId and save the full draft
  const tabRef = tabsStore.tabs.find(t => t.id === tab.id)
  if (tabRef) {
    tabRef.requestId = request.id
    await tabsStore.saveTab(tab.id)
  }

  showSaveModal.value = false
}

async function handleSaveAndClose() {
  const tabId = tabsStore.pendingCloseTabId
  if (!tabId) return
  const tab = tabsStore.tabs.find((t) => t.id === tabId)
  if (tab && tab.type === 'request' && tab.isDirty) {
    if (tab.sourceId) {
      // Tab is linked to a collection — save directly
      await tabsStore.saveTab(tab.id)
      tabsStore.forceCloseTab(tabId)
    } else {
      // New unsaved tab — show save-to-collection modal
      tabsStore.cancelCloseTab()
      tabsStore.setActiveTab(tabId)
      openSaveModal()
    }
  } else {
    tabsStore.forceCloseTab(tabId)
  }
}
</script>

<template>
  <div class="flex items-center h-[41px] border-b border-border bg-surface-alt">
    <!-- Sidebar toggle -->
    <BaseTooltip text="Toggle Sidebar" shortcut="⌘B" position="bottom">
      <button
        class="p-2 mx-0.5 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors flex-shrink-0"
        @click="emit('toggleSidebar')"
      >
        <PanelLeft class="w-4 h-4" />
      </button>
    </BaseTooltip>

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
        <template v-if="tab.type === 'request' && tab.requestDraft">
          <span
            v-if="tab.protocol && tab.protocol !== 'rest'"
            class="text-[9px] font-bold uppercase px-1 py-0.5 rounded mr-0.5"
            :class="{
              'bg-amber-500/10 text-amber-500': tab.protocol === 'websocket',
              'bg-pink-500/10 text-pink-500': tab.protocol === 'graphql',
              'bg-blue-500/10 text-blue-500': tab.protocol === 'grpc',
            }"
          >
            {{ tab.protocol === 'websocket' ? 'WS' : tab.protocol === 'graphql' ? 'GQL' : 'gRPC' }}
          </span>
          <BaseBadge v-else :method="tab.requestDraft.method" />
        </template>
        <!-- Request tab without loaded draft (show default badge) -->
        <template v-else-if="tab.type === 'request'">
          <BaseBadge method="GET" />
        </template>
        <!-- Settings icon -->
        <template v-else-if="tab.type === 'settings'">
          <Settings class="w-3.5 h-3.5 text-muted" />
        </template>
        <!-- Environments icon -->
        <template v-else-if="tab.type === 'environments'">
          <FlaskConical class="w-3.5 h-3.5 text-muted" />
        </template>
        <!-- Cookies icon -->
        <template v-else-if="tab.type === 'cookies'">
          <Cookie class="w-3.5 h-3.5 text-muted" />
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

    <!-- New tab button -->
    <BaseTooltip text="New Request" shortcut="⌘T" position="bottom">
      <button
        class="p-1.5 mx-0.5 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors flex-shrink-0"
        @click="tabsStore.openRequestTab()"
      >
        <Plus class="w-4 h-4" />
      </button>
    </BaseTooltip>

    <!-- Right actions -->
    <div class="flex items-center gap-0.5 px-2 flex-shrink-0 border-l border-border">
      <!-- Save active tab -->
      <BaseTooltip v-if="tabsStore.activeTab?.type === 'request'" text="Save" shortcut="⌘S" position="bottom">
        <button
          class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
          :class="{ 'text-warning': tabsStore.activeTab?.isDirty }"
          @click="tabsStore.activeTab && handleSave(tabsStore.activeTab)"
        >
          <Save class="w-4 h-4" />
        </button>
      </BaseTooltip>
      <!-- Settings -->
      <BaseTooltip text="Settings" position="bottom">
        <button
          class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
          @click="tabsStore.openSettingsTab()"
        >
          <Settings class="w-4 h-4" />
        </button>
      </BaseTooltip>
      <!-- Cookies -->
      <BaseTooltip text="Cookie Jar" position="bottom">
        <button
          class="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
          @click="tabsStore.openCookiesTab()"
        >
          <Cookie class="w-4 h-4" />
        </button>
      </BaseTooltip>
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
      <div v-if="workspaceStore.collections.length === 0" class="text-sm text-muted text-center py-4">
        <p>No collections yet.</p>
        <button
          class="mt-2 px-3 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover"
          @click="workspaceStore.createCollection('My Collection').then(() => { saveTargetCollectionId = workspaceStore.collections[0]?.id })"
        >
          Create Collection
        </button>
      </div>
      <template v-else>
        <!-- Collection selection -->
        <label class="block text-xs text-secondary">Collection</label>
        <div class="space-y-1 max-h-[160px] overflow-y-auto">
          <button
            v-for="col in workspaceStore.collections"
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
          <template v-for="col in workspaceStore.collections" :key="'folder-' + col.id">
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
                  :key="folder.type === 'folder' ? folder.id : ''"
                  class="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-colors"
                  :class="saveTargetFolderId === (folder.type === 'folder' ? folder.id : '') ? 'bg-accent/10 text-accent border border-accent/30' : 'hover:bg-surface-hover text-primary border border-transparent'"
                  @click="saveTargetFolderId = folder.type === 'folder' ? folder.id : null"
                >
                  <Folder class="w-3.5 h-3.5 text-muted flex-shrink-0" />
                  <span>{{ folder.type === 'folder' ? folder.name : '' }}</span>
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
