<script setup lang="ts">
import { computed } from 'vue'

import { HttpMethod, ProtocolType } from '@/types/common'
import { useEnvironmentsStore } from '@/stores/environments'
import { useTabsStore } from '@/stores/tabs'
import type { RequestConfig } from '@/types/request'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'
import BaseUrlInput from '@/components/base/BaseUrlInput.vue'
import { parseCurl } from '@/utils/curl-parser'

const props = defineProps<{
  request: RequestConfig
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

const environmentsStore = useEnvironmentsStore()

const protocolOptions: SelectOption[] = [
  { label: 'REST', value: ProtocolType.REST, color: '#10b981' },
  { label: 'WS', value: ProtocolType.WEBSOCKET, color: '#f59e0b' },
  { label: 'GQL', value: ProtocolType.GRAPHQL, color: '#e535ab' },
  { label: 'gRPC', value: ProtocolType.GRPC, color: '#3b82f6' },
]

const currentProtocol = computed(() => props.protocol || ProtocolType.REST)

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

// Resolved URL preview (includes env vars + path params)
const resolvedUrl = computed(() => {
  if (!props.request.url) return ''
  let url = environmentsStore.resolveVariablesInString(props.request.url)
  // Also resolve path params for preview
  const pathParams = props.request.pathParams || []
  for (const param of pathParams) {
    if (param.value) {
      const resolvedValue = environmentsStore.resolveVariablesInString(param.value)
      url = url.replace(new RegExp(`:${param.key}\\b`, 'g'), resolvedValue)
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

const urlPlaceholder = computed(() => {
  switch (currentProtocol.value) {
    case ProtocolType.WEBSOCKET: return 'ws://localhost:8080/socket'
    case ProtocolType.GRAPHQL: return 'https://api.example.com/graphql'
    case ProtocolType.GRPC: return 'localhost:50051'
    default: return 'Enter request URL...'
  }
})

const sendLabel = computed(() => {
  switch (currentProtocol.value) {
    case ProtocolType.WEBSOCKET: return 'Connect'
    case ProtocolType.GRAPHQL: return 'Query'
    case ProtocolType.GRPC: return 'Invoke'
    default: return 'Send'
  }
})
const isNotReady = computed(() => currentProtocol.value !== ProtocolType.REST)
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
