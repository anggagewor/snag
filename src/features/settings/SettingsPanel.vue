<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import { readDir, stat } from '@tauri-apps/plugin-fs'
import { openPath } from '@tauri-apps/plugin-opener'

import { useSettingsStore } from '@/stores/settings'
import { useTheme } from '@/composables/useTheme'
import { useStorageAdapter } from '@/services/provider'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'
import BaseButton from '@/components/base/BaseButton.vue'

const settingsStore = useSettingsStore()
const { themeMode, setTheme } = useTheme()

const storage = useStorageAdapter()
const logsDir = storage.globalPath('logs')
const logDirSize = ref(0)

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formattedSize = computed(() => formatSize(logDirSize.value))

async function computeLogSize() {
  try {
    const entries = await readDir(logsDir)
    let total = 0
    for (const entry of entries) {
      if (entry.isFile) {
        const s = await stat(`${logsDir}/${entry.name}`)
        total += s.size ?? 0
      }
    }
    logDirSize.value = total
  } catch {
    logDirSize.value = 0
  }
}

async function openLogsDir() {
  try {
    await openPath(logsDir)
  } catch {
    // silently fail if directory doesn't exist yet
  }
}

onMounted(() => {
  computeLogSize()
})

const themeOptions: SelectOption[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]

function updateTheme(value: string) {
  const mode = value as 'light' | 'dark' | 'system'
  setTheme(mode)
  settingsStore.updateGlobal({ theme: mode })
}

function updateFontSize(value: string) {
  const num = parseInt(value)
  if (!isNaN(num) && num >= 8 && num <= 32) {
    settingsStore.updateGlobal({ fontSize: num })
  }
}

function updateFontFamily(value: string) {
  if (value.trim()) {
    settingsStore.updateGlobal({ fontFamily: value.trim() })
  }
}

function updateTimeout(value: string) {
  const num = parseInt(value)
  if (!isNaN(num) && num > 0) {
    settingsStore.updateWorkspace({ timeout: num })
  }
}

function updateDefaultHeader(index: number, field: 'key' | 'value', value: string) {
  const current = settingsStore.resolved.defaultHeaders ?? []
  const headers = [...current]
  headers[index] = { ...headers[index], [field]: value }
  settingsStore.updateWorkspace({ defaultHeaders: headers })
}

function removeDefaultHeader(index: number) {
  const current = settingsStore.resolved.defaultHeaders ?? []
  const headers = current.filter((_, i) => i !== index)
  settingsStore.updateWorkspace({ defaultHeaders: headers })
}

function addDefaultHeader() {
  const current = settingsStore.resolved.defaultHeaders ?? []
  const headers = [...current, { key: '', value: '' }]
  settingsStore.updateWorkspace({ defaultHeaders: headers })
}
</script>

<template>
  <div class="h-full overflow-y-auto">
  <div class="max-w-2xl mx-auto p-6 space-y-8 pb-16">
    <div>
      <h2 class="text-lg font-semibold text-primary">Settings</h2>
      <p class="text-sm text-secondary mt-0.5">Configure Snag to your liking</p>
    </div>

    <!-- Appearance (Global) -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">
        Appearance
        <span class="ml-2 text-xs text-muted font-normal">(global)</span>
      </h3>

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

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Font Size</p>
          <p class="text-xs text-muted">Editor font size in pixels</p>
        </div>
        <div class="w-[160px]">
          <input
            :value="settingsStore.resolved.fontSize"
            type="number"
            min="8"
            max="32"
            class="w-full rounded-md border border-border bg-surface text-primary text-sm px-3 py-1 focus:outline-none focus:border-accent"
            @input="updateFontSize(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Font Family</p>
          <p class="text-xs text-muted">Monospace font for editor and code</p>
        </div>
        <div class="w-[240px]">
          <input
            :value="settingsStore.resolved.fontFamily"
            type="text"
            class="w-full rounded-md border border-border bg-surface text-primary text-sm px-3 py-1 focus:outline-none focus:border-accent"
            @change="updateFontFamily(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </section>

    <!-- Request Defaults (Workspace) -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">
        Request Defaults
        <span class="ml-2 text-xs text-muted font-normal">(workspace)</span>
      </h3>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Timeout (seconds)</p>
          <p class="text-xs text-muted">Maximum time to wait for a response</p>
        </div>
        <div class="w-[160px]">
          <input
            :value="settingsStore.resolved.timeout"
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
            :checked="settingsStore.resolved.followRedirects"
            class="sr-only peer"
            @change="settingsStore.updateWorkspace({ followRedirects: !settingsStore.resolved.followRedirects })"
          />
          <div class="w-9 h-5 bg-border rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Validate SSL Certificates</p>
          <p class="text-xs text-muted">Disable for self-signed certs in local dev</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            :checked="settingsStore.resolved.validateSsl"
            class="sr-only peer"
            @change="settingsStore.updateWorkspace({ validateSsl: !settingsStore.resolved.validateSsl })"
          />
          <div class="w-9 h-5 bg-border rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>
    </section>

    <!-- Default Headers (Workspace) -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">
        Default Headers
        <span class="ml-2 text-xs text-muted font-normal">(workspace)</span>
      </h3>
      <p class="text-xs text-muted">These headers are automatically included in every request.</p>

      <div class="space-y-2">
        <div
          v-for="(header, index) in settingsStore.resolved.defaultHeaders ?? []"
          :key="index"
          class="flex items-center gap-3 px-3 py-2 border border-border rounded"
        >
          <div class="flex-1 flex items-center gap-2">
            <input
              :value="header.key"
              placeholder="Header name"
              class="w-[160px] text-sm font-mono text-primary bg-transparent border-b border-transparent focus:border-accent focus:outline-none"
              @input="updateDefaultHeader(index, 'key', ($event.target as HTMLInputElement).value)"
            />
            <span class="text-muted">:</span>
            <input
              :value="header.value"
              placeholder="Header value"
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

    <!-- Diagnostics -->
    <section class="space-y-4">
      <h3 class="text-sm font-medium text-primary border-b border-border pb-2">
        Diagnostics
      </h3>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary">Application Logs</p>
          <p class="text-xs text-muted">View log files for debugging ({{ formattedSize }})</p>
        </div>
        <BaseButton variant="secondary" size="sm" @click="openLogsDir">
          View Logs
        </BaseButton>
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
