<script setup lang="ts">
import { computed } from 'vue'

import { HttpMethod } from '@/types/common'
import { useEnvironmentsStore } from '@/stores/environments'
import { useTabsStore } from '@/stores/tabs'
import type { RequestConfig } from '@/types/request'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'
import BaseUrlInput from '@/components/base/BaseUrlInput.vue'
import EnvironmentSelector from '@/features/environments/EnvironmentSelector.vue'
import { parseCurl } from '@/utils/curl-parser'

const props = defineProps<{
  request: RequestConfig
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'update:method': [method: HttpMethod]
  'update:url': [url: string]
  send: []
}>()

const tabsStore = useTabsStore()

const environmentsStore = useEnvironmentsStore()

const methodOptions: SelectOption[] = [
  { label: 'GET', value: HttpMethod.GET, color: '#10b981' },
  { label: 'POST', value: HttpMethod.POST, color: '#f59e0b' },
  { label: 'PUT', value: HttpMethod.PUT, color: '#3b82f6' },
  { label: 'PATCH', value: HttpMethod.PATCH, color: '#8b5cf6' },
  { label: 'DELETE', value: HttpMethod.DELETE, color: '#ef4444' },
  { label: 'HEAD', value: HttpMethod.HEAD, color: '#6b7280' },
  { label: 'OPTIONS', value: HttpMethod.OPTIONS, color: '#ec4899' },
]

const currentMethod = computed(() => props.request.method)

// Resolved URL preview
const resolvedUrl = computed(() => {
  if (!props.request.url) return ''
  return environmentsStore.resolveVariablesInString(props.request.url)
})

const hasUnresolvedVars = computed(() => {
  if (!props.request.url) return false
  const resolved = environmentsStore.resolveVariablesInString(props.request.url)
  return /\{\{\w+\}\}/.test(resolved)
})

function onMethodChange(value: string) {
  emit('update:method', value as HttpMethod)
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') || ''
  if (/^\s*curl\s/i.test(text)) {
    e.preventDefault()
    const parsed = parseCurl(text)
    const activeTab = tabsStore.activeTab
    if (activeTab) {
      tabsStore.updateTabRequest(activeTab.id, {
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        body: parsed.body,
        auth: parsed.auth,
      })
    }
    emit('update:method', parsed.method)
    emit('update:url', parsed.url)
  }
}
</script>

<template>
  <div class="flex items-center gap-2 p-3">
    <!-- Method select -->
    <div class="w-[130px] flex-shrink-0">
      <BaseSelect
        :model-value="currentMethod"
        :options="methodOptions"
        size="md"
        @update:model-value="onMethodChange"
      />
    </div>

    <!-- URL input wrapper -->
    <div class="flex-1 relative" @paste="onPaste">
      <BaseUrlInput
        :model-value="request.url"
        placeholder="Enter request URL..."
        @update:model-value="emit('update:url', $event)"
        @send="emit('send')"
      />

      <!-- Resolved URL preview -->
      <div
        v-if="request.url && resolvedUrl !== request.url"
        class="absolute -bottom-4 left-0 text-[10px] font-mono truncate max-w-full"
        :class="hasUnresolvedVars ? 'text-warning' : 'text-success'"
      >
        → {{ resolvedUrl }}
      </div>
    </div>

    <!-- Environment selector -->
    <div class="w-[130px] flex-shrink-0">
      <EnvironmentSelector />
    </div>

    <!-- Send button -->
    <BaseButton :loading="isLoading" @click="emit('send')">
      Send
    </BaseButton>
  </div>
</template>
