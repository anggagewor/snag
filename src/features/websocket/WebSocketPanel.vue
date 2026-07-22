<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

import {
  Plug,
  Unplug,
  Send,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Circle,
} from 'lucide-vue-next'

import { useWebSocket } from '@/composables/useWebSocket'
import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { WebSocketConfig, KeyValuePair } from '@/domain'
import { PROTOCOL_OPTIONS } from '@/domain/protocols-ui'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseKeyValueEditor from '@/components/base/BaseKeyValueEditor.vue'
import BaseCodeEditor from '@/components/base/BaseCodeEditor.vue'
import BaseUrlInput from '@/components/base/BaseUrlInput.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { KeyValuePairEditable } from '@/domain'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()
const { session, isConnected, isConnecting, connect, disconnect, sendMessage, clearMessages } = useWebSocket()

const messageInput = ref('')
const messageFormat = ref<'json' | 'text'>('text')
const activeSection = ref<'messages' | 'headers'>('messages')
const messagesEndRef = ref<HTMLDivElement | null>(null)

const messageFormatOptions = [
  { label: 'Text', value: 'text' },
  { label: 'JSON', value: 'json' },
]

const protocolOptions = PROTOCOL_OPTIONS

function onProtocolChange(value: string) {
  const tab = tabsStore.tabs.find(t => t.id === props.tab.id)
  if (tab) {
    tab.protocol = value as 'rest' | 'websocket' | 'graphql' | 'grpc'
    if (tab.requestDraft) {
      tab.requestDraft.protocol = value as 'rest' | 'websocket' | 'graphql' | 'grpc'
    }
  }
}

// Headers for the connection
const headers = ref<KeyValuePairEditable[]>([])

// Build WebSocketConfig from tab state
const wsConfig = computed<WebSocketConfig>(() => ({
  id: props.tab.id,
  url: props.tab.requestDraft?.url ?? '',
  headers: headers.value
    .filter(h => h.enabled && h.key)
    .map<KeyValuePair>(h => ({ key: h.key, value: h.value, enabled: h.enabled })),
  auth: props.tab.requestDraft?.auth ?? { type: 'none' },
  messageFormat: messageFormat.value,
}))

const statusColor = computed(() => {
  switch (session.value.status) {
    case 'connected': return 'text-success'
    case 'connecting': return 'text-warning'
    case 'error': return 'text-error'
    default: return 'text-secondary'
  }
})

const statusLabel = computed(() => {
  switch (session.value.status) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting...'
    case 'error': return 'Error'
    default: return 'Disconnected'
  }
})

function handleConnect() {
  if (isConnected.value) {
    disconnect()
  } else {
    connect(wsConfig.value, props.tab.collectionVariables)
  }
}

function handleSend() {
  if (!messageInput.value.trim()) return
  sendMessage(messageInput.value)
  messageInput.value = ''
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleSend()
  }
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + date.getMilliseconds().toString().padStart(3, '0')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function tryFormatJson(data: string): string {
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}

// Auto-scroll to bottom on new messages
watch(
  () => session.value.messages.length,
  async () => {
    await nextTick()
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  },
)

// Sync session to tab
watch(session, (s) => {
  const tab = tabsStore.tabs.find(t => t.id === props.tab.id)
  if (tab) {
    tab.websocketSession = s
  }
}, { deep: true })
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- URL Bar -->
    <div class="flex items-center gap-2 p-3 border-b border-border">
      <!-- Protocol selector -->
      <div class="w-[100px] flex-shrink-0">
        <BaseSelect
          :model-value="'websocket'"
          :options="protocolOptions"
          size="md"
          @update:model-value="onProtocolChange"
        />
      </div>

      <!-- URL input -->
      <div class="flex-1">
        <BaseUrlInput
          :model-value="tab.requestDraft?.url ?? ''"
          placeholder="ws://localhost:8080/socket"
          @update:model-value="(v) => { if (tab.requestDraft) { tab.requestDraft.url = v; tabsStore.recomputeDirty(tab.id) } }"
          @send="handleConnect"
        />
      </div>

      <!-- Status indicator -->
      <div class="flex items-center gap-1.5 text-xs">
        <Circle class="w-2.5 h-2.5 fill-current" :class="statusColor" />
        <span :class="statusColor" class="font-medium">{{ statusLabel }}</span>
      </div>

      <!-- Connect/Disconnect button -->
      <BaseButton
        :loading="isConnecting"
        @click="handleConnect"
      >
        <template v-if="isConnected">
          <Unplug class="w-3.5 h-3.5 mr-1" />
          Disconnect
        </template>
        <template v-else>
          <Plug class="w-3.5 h-3.5 mr-1" />
          Connect
        </template>
      </BaseButton>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Section tabs -->
      <div class="flex border-b border-border px-3">
        <button
          v-for="section in (['messages', 'headers'] as const)"
          :key="section"
          class="px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors"
          :class="activeSection === section
            ? 'border-accent text-primary'
            : 'border-transparent text-secondary hover:text-primary'"
          @click="activeSection = section"
        >
          {{ section }}
          <span v-if="section === 'messages' && session.messages.length > 0" class="ml-1 text-[10px] text-secondary">
            ({{ session.messages.length }})
          </span>
        </button>
      </div>

      <!-- Messages section -->
      <div v-if="activeSection === 'messages'" class="flex-1 flex flex-col overflow-hidden">
        <!-- Message list -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <!-- Empty state -->
          <div v-if="session.messages.length === 0" class="h-full flex flex-col items-center justify-center text-muted">
            <p class="text-sm">No messages yet</p>
            <p class="text-xs mt-1">Connect to a WebSocket server to start</p>
          </div>

          <!-- Messages -->
          <div
            v-for="msg in session.messages"
            :key="msg.id"
            class="flex gap-2 group"
          >
            <!-- Direction icon -->
            <div class="flex-shrink-0 mt-1">
              <ArrowUpRight
                v-if="msg.direction === 'sent'"
                class="w-3.5 h-3.5 text-accent"
              />
              <ArrowDownLeft
                v-else
                class="w-3.5 h-3.5 text-success"
              />
            </div>

            <!-- Message content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-[10px] font-medium" :class="msg.direction === 'sent' ? 'text-accent' : 'text-success'">
                  {{ msg.direction === 'sent' ? 'SENT' : 'RECEIVED' }}
                </span>
                <span class="text-[10px] text-secondary">{{ formatTimestamp(msg.timestamp) }}</span>
                <span class="text-[10px] text-secondary">{{ formatSize(msg.size) }}</span>
              </div>
              <pre class="text-xs font-mono text-primary bg-surface-alt rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{{ tryFormatJson(msg.data) }}</pre>
            </div>
          </div>

          <div ref="messagesEndRef" />
        </div>

        <!-- Error display -->
        <div v-if="session.error" class="px-3 py-2 bg-error/10 border-t border-error/20">
          <p class="text-xs text-error">{{ session.error }}</p>
        </div>

        <!-- Message composer -->
        <div class="border-t border-border p-3">
          <div class="flex items-center gap-2 mb-2">
            <BaseSelect
              :model-value="messageFormat"
              :options="messageFormatOptions"
              size="sm"
              @update:model-value="(v) => messageFormat = v as 'json' | 'text'"
            />

            <BaseButton size="sm" variant="ghost" title="Clear messages" @click="clearMessages">
              <Trash2 class="w-3.5 h-3.5" />
            </BaseButton>
          </div>

          <div class="flex gap-2">
            <div class="flex-1">
              <BaseCodeEditor
                v-model:model-value="messageInput"
                :language="messageFormat === 'json' ? 'json' : 'text'"
                placeholder="Type a message..."
                class="h-24"
                @keydown="handleKeyDown"
              />
            </div>
            <BaseButton
              :disabled="!isConnected || !messageInput.trim()"
              class="self-end"
              @click="handleSend"
            >
              <Send class="w-3.5 h-3.5 mr-1" />
              Send
            </BaseButton>
          </div>
          <p class="text-[10px] text-secondary mt-1">Cmd+Enter to send</p>
        </div>
      </div>

      <!-- Headers section -->
      <div v-else-if="activeSection === 'headers'" class="flex-1 overflow-auto p-3">
        <BaseKeyValueEditor
          v-model="headers"
          key-placeholder="Header name"
          value-placeholder="Header value"
        />
      </div>
    </div>
  </div>
</template>
