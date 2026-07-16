<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { X, Clock, Search } from 'lucide-vue-next'

import { useHistoryStore } from '@/stores/history'
import { useTabsStore } from '@/stores/tabs'
import type { HistoryEntry, HttpMethod } from '@/domain'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'

const historyStore = useHistoryStore()
const tabsStore = useTabsStore()

// ─── Filter State ────────────────────────────────────────────────

const filterMethod = ref<string>('')
const filterUrl = ref<string>('')

const methodOptions: SelectOption[] = [
  { label: 'All', value: '' },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'HEAD', value: 'HEAD' },
  { label: 'OPTIONS', value: 'OPTIONS' },
]

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch([filterMethod, filterUrl], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    historyStore.query({
      method: (filterMethod.value || undefined) as HttpMethod | undefined,
      urlContains: filterUrl.value || undefined,
    })
  }, 300)
})

// ─── Grouped Entries ─────────────────────────────────────────────

const groupedEntries = computed(() => {
  const groups: { label: string; entries: HistoryEntry[] }[] = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const todayEntries: HistoryEntry[] = []
  const yesterdayEntries: HistoryEntry[] = []
  const olderEntries: HistoryEntry[] = []

  for (const entry of historyStore.entries) {
    const date = new Date(entry.timestamp)
    if (date >= today) {
      todayEntries.push(entry)
    } else if (date >= yesterday) {
      yesterdayEntries.push(entry)
    } else {
      olderEntries.push(entry)
    }
  }

  if (todayEntries.length > 0) groups.push({ label: 'Today', entries: todayEntries })
  if (yesterdayEntries.length > 0) groups.push({ label: 'Yesterday', entries: yesterdayEntries })
  if (olderEntries.length > 0) groups.push({ label: 'Older', entries: olderEntries })

  return groups
})

// ─── Actions ─────────────────────────────────────────────────────

function openEntry(entry: HistoryEntry) {
  const sourceId = `history:${entry.id}`
  const title = getEntryTitle(entry)

  if (entry.requestId) {
    tabsStore.openRequestTab(entry.requestId, sourceId, title)
  } else {
    const tab = tabsStore.openRequestTab(undefined, sourceId, title)
    if (tab.requestDraft) {
      tab.requestDraft.method = entry.method
      tab.requestDraft.url = entry.url
    }
  }
}

function getEntryTitle(entry: HistoryEntry): string {
  try {
    const parsed = new URL(entry.url)
    return `${entry.method} ${parsed.pathname}`
  } catch {
    return `${entry.method} ${entry.url.slice(0, 40)}`
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatSize(bytes: number): string {
  if (bytes === 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getStatusVariant(status: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 0) return 'neutral'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 500) return 'warning'
  return 'error'
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
      <span class="text-xs font-medium text-muted uppercase tracking-wide">History</span>
      <BaseButton
        v-if="historyStore.entries.length > 0"
        variant="ghost"
        size="sm"
        @click="historyStore.clearHistory()"
      >
        Clear
      </BaseButton>
    </div>

    <!-- Filter Bar -->
    <div class="px-3 py-2 border-b border-border flex-shrink-0 space-y-1.5">
      <div class="flex gap-1.5">
        <BaseSelect
          v-model="filterMethod"
          :options="methodOptions"
          size="sm"
          placeholder="All"
          class="w-24 flex-shrink-0"
        />
        <div class="relative flex-1">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
          <input
            v-model="filterUrl"
            type="text"
            placeholder="Filter URL..."
            class="w-full rounded-md border border-border bg-surface text-primary placeholder:text-muted text-xs pl-6 pr-2 py-1 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
          />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="historyStore.entries.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <Clock class="w-10 h-10 mx-auto text-muted/30 mb-2" :stroke-width="1.5" />
        <p class="text-sm text-muted">No history yet</p>
        <p class="text-xs text-muted mt-0.5">Requests will appear here after you send them</p>
      </div>
    </div>

    <!-- History list -->
    <div v-else class="flex-1 overflow-y-auto">
      <div v-for="group in groupedEntries" :key="group.label" class="mb-2">
        <div class="px-3 py-1.5 text-[10px] font-medium text-muted uppercase tracking-wider sticky top-0 bg-surface">
          {{ group.label }}
        </div>
        <div class="space-y-0.5 px-1.5">
          <div
            v-for="entry in group.entries"
            :key="entry.id"
            class="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-surface-hover cursor-pointer group"
            @click="openEntry(entry)"
          >
            <BaseBadge :method="entry.method" />
            <span class="flex-1 truncate text-primary font-mono text-[11px]">
              {{ entry.url || 'No URL' }}
            </span>
            <span v-if="entry.duration > 0" class="text-[10px] text-muted flex-shrink-0">
              {{ formatDuration(entry.duration) }}
            </span>
            <span v-if="entry.responseSize > 0" class="text-[10px] text-muted flex-shrink-0">
              {{ formatSize(entry.responseSize) }}
            </span>
            <BaseBadge
              v-if="entry.status > 0"
              :variant="getStatusVariant(entry.status)"
            >
              {{ entry.status }}
            </BaseBadge>
            <span class="text-[10px] text-muted flex-shrink-0">{{ formatTime(entry.timestamp) }}</span>
            <!-- Delete button -->
            <button
              class="text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              @click.stop="historyStore.removeEntry(entry.id)"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
