<script setup lang="ts">
import { ref, computed } from 'vue'

import { Play, Square, AlertTriangle, CheckCircle2, XCircle, Search, Database } from 'lucide-vue-next'

import { useGraphQL } from '@/composables/useGraphQL'
import type { IntrospectionType } from '@/composables/useGraphQL'
import { useTabsStore } from '@/stores/tabs'
import { useHistoryStore } from '@/stores/history'
import type { Tab } from '@/stores/tabs'
import type { GraphQLConfig, GraphQLResponseData, KeyValuePair } from '@/domain'
import type { KeyValuePairEditable, RequestAuthDraft } from '@/domain'
import { PROTOCOL_OPTIONS } from '@/domain/protocols-ui'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCodeEditor from '@/components/base/BaseCodeEditor.vue'
import BaseKeyValueEditor from '@/components/base/BaseKeyValueEditor.vue'
import BaseUrlInput from '@/components/base/BaseUrlInput.vue'
import BaseSplitPane from '@/components/base/BaseSplitPane.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import RequestAuth from '@/features/request/RequestAuth.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()
const historyStore = useHistoryStore()
const { isLoading, error, executeQuery, cancelQuery, isIntrospecting, schema, introspectionError, introspect } = useGraphQL()

const activeSection = ref<'query' | 'variables' | 'headers' | 'auth' | 'schema'>('query')
const responseSection = ref<'body' | 'headers'>('body')

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

// GraphQL-specific state
const query = ref(props.tab.graphql?.query ?? `query {\n  \n}`)
const variables = ref(props.tab.graphql?.variables ?? '')
const operationName = ref(props.tab.graphql?.operationName ?? '')
const headers = ref<KeyValuePairEditable[]>([])
const response = ref<GraphQLResponseData | null>(props.tab.graphqlResponse ?? null)

const hasErrors = computed(() => response.value?.errors && response.value.errors.length > 0)
const hasData = computed(() => response.value?.data !== undefined)

const responseBody = computed(() => {
  if (!response.value) return ''
  try {
    return JSON.stringify(JSON.parse(response.value.body), null, 2)
  } catch {
    return response.value.body
  }
})

const responseHeadersFormatted = computed(() => {
  if (!response.value) return ''
  return Object.entries(response.value.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
})

function statusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-success'
  if (status >= 400) return 'text-error'
  return 'text-warning'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function buildConfig(): GraphQLConfig {
  return {
    id: props.tab.id,
    url: props.tab.requestDraft?.url ?? '',
    headers: headers.value
      .filter(h => h.enabled && h.key)
      .map<KeyValuePair>(h => ({ key: h.key, value: h.value, enabled: h.enabled })),
    auth: props.tab.requestDraft?.auth ?? { type: 'none' },
    query: query.value,
    variables: variables.value || undefined,
    operationName: operationName.value || undefined,
  }
}

async function handleQuery() {
  const url = props.tab.requestDraft?.url
  if (!url || !query.value.trim()) return

  const config = buildConfig()
  const auth: RequestAuthDraft = props.tab.requestDraft?.auth ?? { type: 'none' }

  const result = await executeQuery(config, auth, props.tab.collectionVariables)
  response.value = result

  // Sync to tab
  const tab = tabsStore.tabs.find(t => t.id === props.tab.id)
  if (tab) {
    tab.graphqlResponse = result
    tab.graphql = config
  }

  // Record in history
  if (result) {
    historyStore.recordEntry({
      method: 'POST',
      url: url,
      status: result.status,
      duration: result.time,
      responseSize: result.size,
      request: {
        headers: headers.value
          .filter(h => h.enabled && h.key)
          .map(h => ({ key: h.key, value: h.value, enabled: h.enabled })),
        params: [],
        body: {
          type: 'graphql',
          content: JSON.stringify({ query: query.value, variables: variables.value, operationName: operationName.value }),
        },
        auth: { type: auth.type },
      },
      response: {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body,
        size: result.size,
        time: result.time,
      },
    })
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleQuery()
  }
}

// ─── Schema Introspection ─────────────────────────────────────────

const schemaFilter = ref('')
const expandedType = ref<string | null>(null)

const filteredTypes = computed(() => {
  if (!schema.value) return []
  const q = schemaFilter.value.toLowerCase()
  if (!q) return schema.value.types
  return schema.value.types.filter(
    t => t.name.toLowerCase().includes(q)
      || t.fields.some(f => f.name.toLowerCase().includes(q))
  )
})

function toggleType(name: string) {
  expandedType.value = expandedType.value === name ? null : name
}

async function handleIntrospect() {
  const url = props.tab.requestDraft?.url
  if (!url) return

  const auth: RequestAuthDraft = props.tab.requestDraft?.auth ?? { type: 'none' }
  const configHeaders = headers.value
    .filter(h => h.enabled && h.key)
    .map(h => ({ key: h.key, value: h.value, enabled: h.enabled }))

  await introspect(url, auth, configHeaders, props.tab.collectionVariables)
  activeSection.value = 'schema'
}

function insertTypeQuery(type: IntrospectionType) {
  if (!type.fields.length) return
  const fields = type.fields.slice(0, 5).map(f => `    ${f.name}`).join('\n')
  const snippet = `query {\n  # ${type.name}\n${fields}\n}`
  query.value = snippet
  activeSection.value = 'query'
}
</script>

<template>
  <div class="flex flex-col h-full" @keydown="handleKeyDown">
    <!-- URL Bar -->
    <div class="flex items-center gap-2 p-3 border-b border-border">
      <!-- Protocol selector -->
      <div class="w-[100px] flex-shrink-0">
        <BaseSelect
          :model-value="'graphql'"
          :options="protocolOptions"
          size="md"
          @update:model-value="onProtocolChange"
        />
      </div>

      <!-- URL input -->
      <div class="flex-1">
        <BaseUrlInput
          :model-value="tab.requestDraft?.url ?? ''"
          placeholder="https://api.example.com/graphql"
          @update:model-value="(v) => { if (tab.requestDraft) { tab.requestDraft.url = v; tabsStore.recomputeDirty(tab.id) } }"
          @send="handleQuery"
        />
      </div>

      <!-- Query / Cancel button -->
      <BaseButton
        v-if="!isLoading"
        :disabled="!tab.requestDraft?.url || !query.trim()"
        @click="handleQuery"
      >
        <Play class="w-3.5 h-3.5 mr-1" />
        Query
      </BaseButton>
      <BaseButton v-else @click="cancelQuery">
        <Square class="w-3.5 h-3.5 mr-1" />
        Cancel
      </BaseButton>
    </div>

    <!-- Split pane: request / response -->
    <BaseSplitPane :initial-split="50" class="flex-1">
      <template #top>
        <div class="h-full flex flex-col">
          <!-- Section tabs -->
          <div class="flex border-b border-border px-3">
            <button
              v-for="section in (['query', 'variables', 'headers', 'auth', 'schema'] as const)"
              :key="section"
              class="px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors"
              :class="activeSection === section
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'"
              @click="activeSection = section"
            >
              {{ section }}
              <span v-if="section === 'schema' && schema" class="ml-1 text-[10px] text-success">●</span>
            </button>

            <!-- Introspect button -->
            <button
              class="ml-auto px-2 py-1 text-[10px] text-secondary hover:text-accent transition-colors flex items-center gap-1"
              :disabled="!tab.requestDraft?.url || isIntrospecting"
              @click="handleIntrospect"
            >
              <Database class="w-3 h-3" :class="{ 'animate-pulse': isIntrospecting }" />
              {{ isIntrospecting ? 'Loading...' : 'Introspect' }}
            </button>
          </div>

          <!-- Section content -->
          <div class="flex-1 overflow-hidden">
            <!-- Query editor -->
            <div v-if="activeSection === 'query'" class="h-full flex flex-col">
              <!-- Operation name (optional) -->
              <div class="px-3 pt-2 pb-1">
                <input
                  v-model="operationName"
                  type="text"
                  placeholder="Operation name (optional)"
                  class="w-full text-xs bg-surface-alt border border-border rounded px-2 py-1.5 text-primary placeholder:text-secondary/50 focus:outline-none focus:border-accent"
                />
              </div>
              <div class="flex-1 p-3 pt-1">
                <BaseCodeEditor
                  v-model:model-value="query"
                  language="text"
                  placeholder="query { }"
                />
              </div>
            </div>

            <!-- Variables editor -->
            <div v-else-if="activeSection === 'variables'" class="h-full p-3">
              <BaseCodeEditor
                v-model:model-value="variables"
                language="json"
                placeholder='{ "key": "value" }'
              />
            </div>

            <!-- Headers editor -->
            <div v-else-if="activeSection === 'headers'" class="h-full overflow-auto p-3">
              <BaseKeyValueEditor
                v-model="headers"
                key-placeholder="Header name"
                value-placeholder="Header value"
              />
            </div>

            <!-- Auth -->
            <div v-else-if="activeSection === 'auth'" class="h-full overflow-auto p-3">
              <RequestAuth :tab="tab" />
            </div>

            <!-- Schema explorer -->
            <div v-else-if="activeSection === 'schema'" class="h-full overflow-auto p-3">
              <!-- Introspection error -->
              <div v-if="introspectionError" class="flex items-center gap-2 p-2 mb-3 rounded bg-error/5 border border-error/20">
                <AlertTriangle class="w-3.5 h-3.5 text-error flex-shrink-0" />
                <span class="text-xs text-error">{{ introspectionError }}</span>
              </div>

              <!-- No schema yet -->
              <div v-else-if="!schema" class="h-full flex flex-col items-center justify-center text-muted">
                <Database class="w-8 h-8 text-secondary/30 mb-2" />
                <p class="text-sm">No schema loaded</p>
                <p class="text-xs mt-1">Click "Introspect" to fetch the schema from the endpoint</p>
              </div>

              <!-- Schema loaded -->
              <template v-else>
                <!-- Schema summary -->
                <div class="flex items-center gap-3 mb-3 text-[10px] text-secondary">
                  <span v-if="schema.queryType" class="px-1.5 py-0.5 rounded bg-success/10 text-success">
                    Query: {{ schema.queryType }}
                  </span>
                  <span v-if="schema.mutationType" class="px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                    Mutation: {{ schema.mutationType }}
                  </span>
                  <span v-if="schema.subscriptionType" class="px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                    Subscription: {{ schema.subscriptionType }}
                  </span>
                  <span class="text-secondary">{{ schema.types.length }} types</span>
                </div>

                <!-- Search/filter -->
                <div class="relative mb-3">
                  <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary" />
                  <input
                    v-model="schemaFilter"
                    type="text"
                    placeholder="Filter types..."
                    class="w-full text-xs bg-surface-alt border border-border rounded pl-7 pr-2 py-1.5 text-primary placeholder:text-secondary/50 focus:outline-none focus:border-accent"
                  />
                </div>

                <!-- Type list -->
                <div class="space-y-1">
                  <div
                    v-for="type in filteredTypes"
                    :key="type.name"
                    class="border border-border rounded overflow-hidden"
                  >
                    <!-- Type header -->
                    <button
                      class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-alt transition-colors"
                      @click="toggleType(type.name)"
                    >
                      <span
                        class="text-[10px] px-1 py-0.5 rounded font-mono"
                        :class="{
                          'bg-blue-500/10 text-blue-500': type.kind === 'OBJECT',
                          'bg-purple-500/10 text-purple-500': type.kind === 'INPUT_OBJECT',
                          'bg-amber-500/10 text-amber-500': type.kind === 'ENUM',
                          'bg-pink-500/10 text-pink-500': type.kind === 'INTERFACE',
                          'bg-teal-500/10 text-teal-500': type.kind === 'UNION',
                          'bg-gray-500/10 text-gray-500': type.kind === 'SCALAR',
                        }"
                      >
                        {{ type.kind }}
                      </span>
                      <span class="text-xs font-medium text-primary">{{ type.name }}</span>
                      <span v-if="type.fields.length" class="text-[10px] text-secondary ml-auto">
                        {{ type.fields.length }} fields
                      </span>
                      <svg
                        class="w-3 h-3 text-secondary transition-transform"
                        :class="{ 'rotate-90': expandedType === type.name }"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <!-- Type fields (expanded) -->
                    <div v-if="expandedType === type.name && type.fields.length" class="border-t border-border bg-surface-alt">
                      <div
                        v-for="field in type.fields"
                        :key="field.name"
                        class="px-3 py-1 border-b border-border last:border-b-0 flex items-center gap-2"
                      >
                        <span class="text-xs font-mono text-primary">{{ field.name }}</span>
                        <span v-if="field.args.length" class="text-[10px] text-secondary">
                          ({{ field.args.map(a => `${a.name}: ${a.type}`).join(', ') }})
                        </span>
                        <span class="text-[10px] text-accent ml-auto font-mono">{{ field.type }}</span>
                      </div>

                      <!-- Use type button -->
                      <button
                        class="w-full px-3 py-1.5 text-[10px] text-accent hover:bg-accent/5 transition-colors text-left"
                        @click="insertTypeQuery(type)"
                      >
                        → Insert query snippet
                      </button>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <template #bottom>
        <!-- Response panel -->
        <div class="h-full flex flex-col">
          <!-- Response header -->
          <div class="flex items-center gap-3 px-3 py-2 border-b border-border">
            <span class="text-xs font-medium text-secondary">Response</span>

            <template v-if="response">
              <span class="text-xs font-mono font-medium" :class="statusColorClass(response.status)">
                {{ response.status }} {{ response.statusText }}
              </span>
              <span class="text-[10px] text-secondary">{{ response.time }}ms</span>
              <span class="text-[10px] text-secondary">{{ formatSize(response.size) }}</span>

              <!-- Error/Success indicators -->
              <span v-if="hasErrors" class="flex items-center gap-1 text-[10px] text-error">
                <XCircle class="w-3 h-3" />
                {{ response.errors!.length }} error{{ response.errors!.length > 1 ? 's' : '' }}
              </span>
              <span v-else-if="hasData" class="flex items-center gap-1 text-[10px] text-success">
                <CheckCircle2 class="w-3 h-3" />
                OK
              </span>
            </template>

            <!-- Section toggle for response -->
            <div v-if="response" class="ml-auto flex gap-1">
              <button
                v-for="s in (['body', 'headers'] as const)"
                :key="s"
                class="px-2 py-0.5 text-[10px] font-medium capitalize rounded transition-colors"
                :class="responseSection === s
                  ? 'bg-accent/10 text-accent'
                  : 'text-secondary hover:text-primary'"
                @click="responseSection = s"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <!-- Response content -->
          <div class="flex-1 overflow-hidden">
            <!-- Loading -->
            <div v-if="isLoading" class="h-full flex items-center justify-center text-muted">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <span class="text-xs">Executing query...</span>
              </div>
            </div>

            <!-- Error -->
            <div v-else-if="error && !response" class="h-full flex items-center justify-center p-4">
              <div class="flex items-center gap-2 text-error">
                <AlertTriangle class="w-4 h-4" />
                <span class="text-xs">{{ error }}</span>
              </div>
            </div>

            <!-- Empty state -->
            <div v-else-if="!response" class="h-full flex flex-col items-center justify-center text-muted">
              <p class="text-sm">No response yet</p>
              <p class="text-xs mt-1">Write a query and press Cmd+Enter</p>
            </div>

            <!-- Response body -->
            <div v-else-if="responseSection === 'body'" class="h-full">
              <!-- GraphQL errors highlight -->
              <div v-if="hasErrors" class="px-3 py-2 bg-error/5 border-b border-error/20">
                <div v-for="(err, i) in response.errors" :key="i" class="text-xs text-error">
                  <span class="font-medium">Error:</span> {{ err.message }}
                  <span v-if="err.locations" class="text-secondary ml-1">
                    (line {{ err.locations[0]?.line }}, col {{ err.locations[0]?.column }})
                  </span>
                </div>
              </div>
              <div class="h-full">
                <BaseCodeEditor
                  :model-value="responseBody"
                  language="json"
                  :readonly="true"
                />
              </div>
            </div>

            <!-- Response headers -->
            <div v-else-if="responseSection === 'headers'" class="h-full">
              <BaseCodeEditor
                :model-value="responseHeadersFormatted"
                language="text"
                :readonly="true"
              />
            </div>
          </div>
        </div>
      </template>
    </BaseSplitPane>
  </div>
</template>
