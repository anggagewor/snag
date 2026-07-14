<script setup lang="ts">
import { ref, computed } from 'vue'

import type { RequestConfig, ResponseData } from '@/types/request'
import BaseBadge from '@/components/base/BaseBadge.vue'

const props = defineProps<{
  response?: ResponseData | null
  request?: RequestConfig | null
  isLoading?: boolean
  error?: string | null
}>()

const activeTab = ref<'body' | 'headers' | 'console'>('body')
const bodyView = ref<'pretty' | 'raw'>('pretty')
const copied = ref(false)

const statusVariant = computed(() => {
  if (!props.response) return 'neutral'
  const status = props.response.status
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  if (status >= 400 && status < 500) return 'warning'
  return 'error'
})

const isJson = computed(() => {
  if (!props.response) return false
  const ct = props.response.headers['content-type'] || ''
  return ct.includes('json')
})

const formattedBody = computed(() => {
  if (!props.response) return ''
  if (bodyView.value === 'raw') return props.response.body

  if (isJson.value) {
    try {
      return JSON.stringify(JSON.parse(props.response.body), null, 2)
    } catch {
      return props.response.body
    }
  }
  return props.response.body
})

const bodyLines = computed(() => formattedBody.value.split('\n'))

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function copyBody() {
  if (!props.response) return
  await navigator.clipboard.writeText(props.response.body)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <svg class="w-8 h-8 mx-auto animate-spin text-accent mb-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p class="text-sm text-muted">Sending request...</p>
      </div>
    </div>

    <!-- Response empty state -->
    <div v-else-if="!response" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <!-- Error state -->
        <template v-if="error">
          <svg class="w-10 h-10 mx-auto text-error/60 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-sm text-error font-medium">Request Failed</p>
          <p class="text-xs text-error/80 mt-1 max-w-[300px]">{{ error }}</p>
        </template>
        <!-- Normal empty state -->
        <template v-else>
          <svg class="w-10 h-10 mx-auto text-muted/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p class="text-sm text-muted">Send a request to see the response</p>
          <p class="text-xs text-muted mt-0.5">Cmd+Enter to send</p>
        </template>
      </div>
    </div>

    <!-- Response content -->
    <template v-else>
      <!-- Status bar -->
      <div class="flex items-center gap-3 px-3 py-2 border-b border-border flex-shrink-0">
        <BaseBadge :variant="statusVariant">
          {{ response.status }} {{ response.statusText }}
        </BaseBadge>
        <div class="flex items-center gap-3 text-xs text-secondary">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {{ response.time }}ms
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            {{ formatSize(response.size) }}
          </span>
        </div>
      </div>

      <!-- Tabs + actions -->
      <div class="flex items-center border-b border-border px-3 flex-shrink-0">
        <button
          class="px-3 py-2 text-xs font-medium border-b-2 transition-colors"
          :class="activeTab === 'body' ? 'border-accent text-primary' : 'border-transparent text-secondary'"
          @click="activeTab = 'body'"
        >
          Body
        </button>
        <button
          class="px-3 py-2 text-xs font-medium border-b-2 transition-colors"
          :class="activeTab === 'headers' ? 'border-accent text-primary' : 'border-transparent text-secondary'"
          @click="activeTab = 'headers'"
        >
          Headers ({{ Object.keys(response.headers).length }})
        </button>
        <button
          class="px-3 py-2 text-xs font-medium border-b-2 transition-colors"
          :class="activeTab === 'console' ? 'border-accent text-primary' : 'border-transparent text-secondary'"
          @click="activeTab = 'console'"
        >
          Console
        </button>

        <!-- Actions -->
        <div v-if="activeTab === 'body'" class="ml-auto flex items-center gap-1">
          <!-- Pretty / Raw toggle -->
          <div class="flex rounded border border-border overflow-hidden">
            <button
              class="px-2 py-0.5 text-[10px] font-medium transition-colors"
              :class="bodyView === 'pretty' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-primary'"
              @click="bodyView = 'pretty'"
            >
              Pretty
            </button>
            <button
              class="px-2 py-0.5 text-[10px] font-medium border-l border-border transition-colors"
              :class="bodyView === 'raw' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-primary'"
              @click="bodyView = 'raw'"
            >
              Raw
            </button>
          </div>

          <!-- Copy button -->
          <button
            class="px-2 py-1 text-xs text-muted hover:text-primary transition-colors rounded hover:bg-surface-hover"
            @click="copyBody"
          >
            <span v-if="copied" class="text-success">Copied!</span>
            <span v-else class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </span>
          </button>
        </div>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-auto">
        <!-- Body -->
        <div v-if="activeTab === 'body'" class="h-full relative">
          <!-- Line numbers + body -->
          <div class="flex h-full">
            <!-- Line numbers -->
            <div class="flex-shrink-0 w-10 bg-surface-alt border-r border-border pt-3 pb-3 text-right pr-2 select-none overflow-hidden">
              <div
                v-for="n in bodyLines.length"
                :key="n"
                class="text-[10px] leading-[18px] text-muted font-mono"
              >{{ n }}</div>
            </div>
            <!-- Body content -->
            <pre class="flex-1 text-xs font-mono text-primary p-3 overflow-auto leading-[18px] whitespace-pre-wrap break-all">{{ formattedBody }}</pre>
          </div>
        </div>

        <!-- Headers -->
        <div v-else-if="activeTab === 'headers'" class="p-3">
          <table class="w-full text-xs">
            <tbody>
              <tr
                v-for="(value, key) in response.headers"
                :key="key"
                class="border-b border-border-muted hover:bg-surface-hover"
              >
                <td class="py-2 pr-4 font-medium text-primary whitespace-nowrap align-top">{{ key }}</td>
                <td class="py-2 text-secondary font-mono break-all">{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Console -->
        <div v-else-if="activeTab === 'console'" class="p-3 space-y-3 text-xs">
          <div v-if="response">
            <!-- Request section -->
            <div class="border border-border rounded overflow-hidden">
              <div class="px-3 py-2 bg-surface-alt border-b border-border flex items-center gap-2">
                <span class="text-[10px] font-medium text-muted uppercase tracking-wider">Request Headers</span>
              </div>
              <div class="p-3 space-y-0.5">
                <div
                  v-for="(value, key) in (response.requestHeaders || {})"
                  :key="key"
                  class="flex font-mono text-[11px]"
                >
                  <span class="text-secondary min-w-[140px] flex-shrink-0">{{ key }}:</span>
                  <span class="text-primary break-all">{{ value }}</span>
                </div>
                <div v-if="!response.requestHeaders || Object.keys(response.requestHeaders).length === 0" class="text-muted">
                  No headers captured
                </div>
              </div>
            </div>

            <!-- Response Headers section -->
            <div class="border border-border rounded overflow-hidden mt-3">
              <div class="px-3 py-2 bg-surface-alt border-b border-border flex items-center gap-2">
                <span class="text-[10px] font-medium text-muted uppercase tracking-wider">Response Headers</span>
                <div class="ml-auto flex items-center gap-2">
                  <BaseBadge :variant="statusVariant">{{ response.status }} {{ response.statusText }}</BaseBadge>
                </div>
              </div>
              <div class="p-3 space-y-0.5">
                <div
                  v-for="(value, key) in response.headers"
                  :key="key"
                  class="flex font-mono text-[11px]"
                >
                  <span class="text-secondary min-w-[140px] flex-shrink-0">{{ key }}:</span>
                  <span class="text-primary break-all">{{ value }}</span>
                </div>
              </div>
            </div>

            <!-- Response Body section -->
            <div class="border border-border rounded overflow-hidden mt-3">
              <div class="px-3 py-2 bg-surface-alt border-b border-border flex items-center gap-2">
                <span class="text-[10px] font-medium text-muted uppercase tracking-wider">Response Body</span>
                <span class="ml-auto text-[10px] text-muted">{{ formatSize(response.size) }} · {{ response.time }}ms</span>
              </div>
              <div class="p-3">
                <pre class="text-[11px] font-mono text-primary max-h-[300px] overflow-auto whitespace-pre-wrap break-all">{{ formattedBody }}</pre>
              </div>
            </div>
          </div>
          <div v-else class="text-muted text-center py-6">
            Send a request to see full details here.
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
