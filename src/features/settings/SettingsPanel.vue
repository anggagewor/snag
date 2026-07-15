<script setup lang="ts">
import { X, Plus } from 'lucide-vue-next'

import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'
import type { ThemeMode } from '@/types/common'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'

const settingsStore = useSettingsStore()
const { themeMode, setTheme } = useTheme()

const themeOptions: SelectOption[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

const methodOptions: SelectOption[] = [
  { label: 'GET', value: 'GET', color: '#10b981' },
  { label: 'POST', value: 'POST', color: '#f59e0b' },
  { label: 'PUT', value: 'PUT', color: '#3b82f6' },
  { label: 'PATCH', value: 'PATCH', color: '#8b5cf6' },
  { label: 'DELETE', value: 'DELETE', color: '#ef4444' },
]

function updateTheme(value: string) {
  const mode = value as ThemeMode
  setTheme(mode)
  settingsStore.updateSettings({ theme: mode })
}

function updateTimeout(value: string) {
  const num = parseInt(value)
  if (!isNaN(num) && num > 0) {
    settingsStore.updateSettings({ timeout: num })
  }
}

function updateMaxHistory(value: string) {
  const num = parseInt(value)
  if (!isNaN(num) && num > 0) {
    settingsStore.updateSettings({ maxHistoryItems: num })
  }
}

function toggleDefaultHeader(index: number) {
  const headers = [...settingsStore.settings.defaultHeaders]
  headers[index] = { ...headers[index], enabled: !headers[index].enabled }
  settingsStore.updateSettings({ defaultHeaders: headers })
}

function updateDefaultHeader(index: number, field: 'key' | 'value', value: string) {
  const headers = [...settingsStore.settings.defaultHeaders]
  headers[index] = { ...headers[index], [field]: value }
  settingsStore.updateSettings({ defaultHeaders: headers })
}

function removeDefaultHeader(index: number) {
  const headers = settingsStore.settings.defaultHeaders.filter((_, i) => i !== index)
  settingsStore.updateSettings({ defaultHeaders: headers })
}

function addDefaultHeader() {
  const headers = [...settingsStore.settings.defaultHeaders, { key: '', value: '', enabled: true }]
  settingsStore.updateSettings({ defaultHeaders: headers })
}
</script>

<template>
  <div class="h-full overflow-y-auto">
  <div class="max-w-2xl mx-auto p-6 space-y-8 pb-16">
    <div>
      <h2 class="text-lg font-semibold text-primary">Settings</h2>
      <p class="text-sm text-secondary mt-0.5">Configure Snag to your liking</p>
    </div>

    <!-- Appearance -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">Appearance</h3>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Theme</p>
          <p class="text-xs text-muted">Choose between light, dark, or system preference</p>
        </div>
        <div class="w-[160px]">
          <BaseSelect
            :model-value="themeMode"
            :options="themeOptions"
            size="sm"
            @update:model-value="updateTheme"
          />
        </div>
      </div>
    </section>

    <!-- Request Defaults -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">Request Defaults</h3>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Default Method</p>
          <p class="text-xs text-muted">Method used when creating new requests</p>
        </div>
        <div class="w-[160px]">
          <BaseSelect
            :model-value="settingsStore.settings.defaultMethod"
            :options="methodOptions"
            size="sm"
            @update:model-value="(v) => settingsStore.updateSettings({ defaultMethod: v })"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Timeout (seconds)</p>
          <p class="text-xs text-muted">Maximum time to wait for a response</p>
        </div>
        <div class="w-[160px]">
          <input
            :value="settingsStore.settings.timeout"
            type="number"
            min="1"
            max="300"
            class="w-full rounded-md border border-border bg-surface text-primary text-sm px-3 py-1 focus:outline-none focus:border-accent"
            @input="updateTimeout(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Follow Redirects</p>
          <p class="text-xs text-muted">Automatically follow HTTP redirects</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settingsStore.settings.followRedirects"
            class="sr-only peer"
            @change="settingsStore.updateSettings({ followRedirects: !settingsStore.settings.followRedirects })"
          />
          <div class="w-9 h-5 bg-border rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>
    </section>

    <!-- Default Headers -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">Default Headers</h3>
      <p class="text-xs text-muted">These headers are automatically included in every request. Uncheck to disable.</p>

      <div class="space-y-2">
        <div
          v-for="(header, index) in settingsStore.settings.defaultHeaders"
          :key="index"
          class="flex items-center gap-3 px-3 py-2 border border-border rounded"
        >
          <input
            type="checkbox"
            :checked="header.enabled"
            class="w-4 h-4 rounded accent-accent cursor-pointer"
            @change="toggleDefaultHeader(index)"
          />
          <div class="flex-1 flex items-center gap-2">
            <input
              :value="header.key"
              class="w-[160px] text-sm font-mono text-primary bg-transparent border-b border-transparent focus:border-accent focus:outline-none"
              @input="updateDefaultHeader(index, 'key', ($event.target as HTMLInputElement).value)"
            />
            <span class="text-muted">:</span>
            <input
              :value="header.value"
              class="flex-1 text-sm font-mono text-secondary bg-transparent border-b border-transparent focus:border-accent focus:outline-none"
              @input="updateDefaultHeader(index, 'value', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <button
            class="text-muted hover:text-error transition-colors"
            @click="removeDefaultHeader(index)"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-primary transition-colors"
          @click="addDefaultHeader"
        >
          <Plus class="w-3.5 h-3.5" />
          Add Header
        </button>
      </div>
    </section>

    <!-- Data -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">Data</h3>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Max History Items</p>
          <p class="text-xs text-muted">Number of requests to keep in history</p>
        </div>
        <div class="w-[160px]">
          <input
            :value="settingsStore.settings.maxHistoryItems"
            type="number"
            min="10"
            max="1000"
            class="w-full rounded-md border border-border bg-surface text-primary text-sm px-3 py-1 focus:outline-none focus:border-accent"
            @input="updateMaxHistory(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </section>

    <!-- About -->
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">About</h3>
      <div class="text-xs text-secondary space-y-1">
        <p><span class="text-primary font-medium">Snag</span> v0.1.0</p>
        <p>A fast, lightweight API client built with Tauri + Vue</p>
      </div>
    </section>
  </div>
  </div>
</template>
