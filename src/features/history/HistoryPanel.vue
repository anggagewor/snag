<script setup lang="ts">
import { computed } from 'vue'

import { useHistoryStore } from '@/stores/history'
import { useTabsStore } from '@/stores/tabs'
import type { HistoryEntry } from '@/stores/history'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const historyStore = useHistoryStore()
const tabsStore = useTabsStore()

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

function openEntry(entry: HistoryEntry) {
  const sourceId = `history:${entry.id}`
  const requestCopy = JSON.parse(JSON.stringify(entry.request))
  const tab = tabsStore.openRequestTab(requestCopy, getEntryTitle(entry), sourceId)
  if (entry.response) {
    tabsStore.updateTabResponse(tab.id, JSON.parse(JSON.stringify(entry.response)))
  }
}

function getEntryTitle(entry: HistoryEntry): string {
  const url = entry.request.url
  try {
    const parsed = new URL(url)
    return `${entry.request.method} ${parsed.pathname}`
  } catch {
    return `${entry.request.method} ${url.slice(0, 40)}`
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getStatusVariant(status: number | undefined): 'success' | 'warning' | 'error' | 'neutral' {
  if (!status) return 'neutral'
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

    <!-- Empty state -->
    <div v-if="historyStore.entries.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-10 h-10 mx-auto text-muted/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
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
            <BaseBadge :method="entry.request.method" />
            <span class="flex-1 truncate text-primary font-mono text-[11px]">
              {{ entry.request.url || 'No URL' }}
            </span>
            <BaseBadge
              v-if="entry.response"
              :variant="getStatusVariant(entry.response.status)"
            >
              {{ entry.response.status }}
            </BaseBadge>
            <span class="text-[10px] text-muted flex-shrink-0">{{ formatTime(entry.timestamp) }}</span>
            <!-- Delete button -->
            <button
              class="text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              @click.stop="historyStore.removeEntry(entry.id)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
