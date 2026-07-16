<script setup lang="ts">
import { computed } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import type { HttpMethod, ProtocolType, RequestDraft } from '@/domain'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'
import BaseUrlInput from '@/components/base/BaseUrlInput.vue'
import { parseCurl } from '@/utils/curl-parser'

const props = defineProps<{
  request: RequestDraft
  isLoading?: boolean
  protocol?: ProtocolType
}>()

const emit = defineEmits<{
  'update:method': [method: HttpMethod]
  'update:url': [url: string]
  'update:protocol': [protocol: ProtocolType]
  send: []
}>()

const tabsStore = useTabsStore()

const workspaceStore = useWorkspaceStore()

const protocolOptions: SelectOption[] = [
  { label: 'REST', value: 'rest', color: '#10b981' },
  { label: 'WS', value: 'websocket', color: '#f59e0b' },
  { label: 'GQL', value: 'graphql', color: '#e535ab' },
  { label: 'gRPC', value: 'grpc', color: '#3b82f6' },
]

const currentProtocol = computed(() => props.protocol || 'rest')

const methodOptions: SelectOption[] = [
  { label: 'GET', value: 'GET', color: '#10b981' },
  { label: 'POST', value: 'POST', color: '#f59e0b' },
  { label: 'PUT', value: 'PUT', color: '#3b82f6' },
  { label: 'PATCH', value: 'PATCH', color: '#8b5cf6' },
  { label: 'DELETE', value: 'DELETE', color: '#ef4444' },
  { label: 'HEAD', value: 'HEAD', color: '#6b7280' },
  { label: 'OPTIONS', value: 'OPTIONS', color: '#ec4899' },
]

const currentMethod = computed(() => props.request.method)

// Resolved URL preview (includes env vars and path params)
const resolvedUrl = computed(() => {
  if (!props.request.url) return ''
  let url = workspaceStore.resolveVariablesInString(props.request.url)
  // Also resolve path params for the preview
  if (props.request.pathParams?.length) {
    for (const param of props.request.pathParams) {
      if (param.enabled && param.key && param.value) {
        url = url.replace(
          new RegExp(`:${param.key}\\b`, 'g'),
          param.value
        )
      }
    }
  }
  return url
})

const hasUnresolvedVars = computed(() => {
  if (!props.request.url) return false
  const resolved = resolvedUrl.value
  return /\{\{\w+\}\}/.test(resolved) || /:([a-zA-Z_]\w*)/.test(resolved)
})

function onProtocolChange(value: string) {
  emit('update:protocol', value as ProtocolType)
}

function onMethodChange(value: string) {
  emit('update:method', value as HttpMethod)
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') || ''
  if (/^\s*curl\s/i.test(text)) {
    e.preventDefault()
    const parsed = parseCurl(text)
    const activeTab = tabsStore.activeTab
    if (activeTab && activeTab.requestDraft) {
      // parseCurl now returns a RequestDraft — assign fields directly
      activeTab.requestDraft.method = parsed.method
      activeTab.requestDraft.url = parsed.url
      activeTab.requestDraft.headers = parsed.headers
      activeTab.requestDraft.body = parsed.body
      activeTab.requestDraft.auth = parsed.auth
      tabsStore.recomputeDirty(activeTab.id)
    }
    emit('update:method', parsed.method as HttpMethod)
    emit('update:url', parsed.url)
  }
}

const urlPlaceholder = computed(() => {
  switch (currentProtocol.value) {
    case 'websocket': return 'ws://localhost:8080/socket'
    case 'graphql': return 'https://api.example.com/graphql'
    case 'grpc': return 'localhost:50051'
    default: return 'Enter request URL...'
  }
})

const sendLabel = computed(() => {
  switch (currentProtocol.value) {
    case 'websocket': return 'Connect'
    case 'graphql': return 'Query'
    case 'grpc': return 'Invoke'
    default: return 'Send'
  }
})
const isNotReady = computed(() => currentProtocol.value !== 'rest')
</script>

<template>
  <div class="flex items-center gap-2 p-3">
    <!-- Protocol selector -->
    <div class="w-[80px] flex-shrink-0">
      <BaseSelect
        :model-value="currentProtocol"
        :options="protocolOptions"
        size="md"
        @update:model-value="onProtocolChange"
      />
    </div>

    <!-- Method select (only for REST) -->
    <div v-if="currentProtocol === 'rest'" class="w-[130px] flex-shrink-0">
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
        :placeholder="urlPlaceholder"
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

    <!-- Coming soon badge -->
    <span
      v-if="isNotReady"
      class="flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded-full bg-warning/10 text-warning border border-warning/20 whitespace-nowrap"
    >
      Coming Soon
    </span>

    <!-- Send button -->
    <BaseButton :loading="isLoading" :disabled="isNotReady" @click="emit('send')">
      {{ sendLabel }}
    </BaseButton>
  </div>
</template>
