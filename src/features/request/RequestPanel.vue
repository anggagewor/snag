<script setup lang="ts">
import { ref, computed } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import { useHistoryStore } from '@/stores/history'
import { useEnvironmentsStore } from '@/stores/environments'
import { useHttp } from '@/composables/useHttp'
import { useScriptRunner } from '@/composables/useScriptRunner'
import { HttpMethod, ProtocolType } from '@/types/common'
import type { Tab } from '@/stores/tabs'
import type { TestResult } from '@/composables/useScriptRunner'
import BaseSplitPane from '@/components/base/BaseSplitPane.vue'
import RequestUrlBar from './RequestUrlBar.vue'
import RequestParams from './RequestParams.vue'
import RequestHeaders from './RequestHeaders.vue'
import RequestBody from './RequestBody.vue'
import RequestAuth from './RequestAuth.vue'
import RequestScripts from './RequestScripts.vue'
import ResponsePanel from '@/features/response/ResponsePanel.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()
const historyStore = useHistoryStore()
const environmentsStore = useEnvironmentsStore()
const { isLoading, error, sendRequest, cancelRequest } = useHttp()
const { runPreRequestScript, runTestScript } = useScriptRunner()

const activeSection = ref<'params' | 'headers' | 'body' | 'auth' | 'scripts'>('params')
const scriptLogs = ref<string[]>([])
const testResults = ref<TestResult[]>([])

const request = computed(() => props.tab.request!)

function updateMethod(method: HttpMethod) {
  tabsStore.updateTabRequest(props.tab.id, { method })
}

function updateUrl(url: string) {
  tabsStore.updateTabRequest(props.tab.id, { url })
}

function updateProtocol(protocol: ProtocolType) {
  const tab = tabsStore.tabs.find((t) => t.id === props.tab.id)
  if (tab) {
    tab.protocol = protocol
    tab.isDirty = true
  }
}

async function handleSend() {
  if (!request.value.url) return

  scriptLogs.value = []
  testResults.value = []

  const collectionVars = props.tab.collectionVariables
  const envVars = { ...environmentsStore.resolvedVariables }

  // Run pre-request script
  if (request.value.preRequestScript) {
    const preResult = runPreRequestScript(request.value.preRequestScript, {
      variables: envVars,
      request: {
        url: request.value.url,
        method: request.value.method,
        headers: Object.fromEntries(
          request.value.headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])
        ),
      },
    })

    scriptLogs.value.push(...preResult.logs)

    if (preResult.error) {
      scriptLogs.value.push(`[pre-request error] ${preResult.error}`)
    }

    // Apply variable changes back to environment (runtime only)
    for (const [key, value] of Object.entries(preResult.variables)) {
      if (envVars[key] !== value) {
        envVars[key] = value
      }
    }
  }

  const response = await sendRequest(request.value, collectionVars)
  tabsStore.updateTabResponse(props.tab.id, response)
  historyStore.addEntry(request.value, response)

  // Run test script
  if (request.value.testScript && response) {
    const testResult = runTestScript(request.value.testScript, {
      variables: envVars,
      request: {
        url: request.value.url,
        method: request.value.method,
        headers: Object.fromEntries(
          request.value.headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])
        ),
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        time: response.time,
        size: response.size,
      },
    })

    scriptLogs.value.push(...testResult.logs)
    testResults.value = testResult.tests

    if (testResult.error) {
      scriptLogs.value.push(`[test error] ${testResult.error}`)
    }
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- URL Bar -->
    <RequestUrlBar
      :request="request"
      :is-loading="isLoading"
      :protocol="tab.protocol"
      @update:method="updateMethod"
      @update:url="updateUrl"
      @update:protocol="updateProtocol"
      @send="handleSend"
    />

    <!-- Error display (inline, no longer separate) -->

    <!-- Request/Response split -->
    <BaseSplitPane :initial-split="50" class="flex-1">
      <template #top>
        <div class="h-full flex flex-col">
          <!-- Section tabs -->
          <div class="flex border-b border-border px-3">
            <button
              v-for="section in (['params', 'headers', 'body', 'auth', 'scripts'] as const)"
              :key="section"
              class="px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors"
              :class="activeSection === section
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'"
              @click="activeSection = section"
            >
              {{ section }}
              <span v-if="section === 'scripts' && testResults.length > 0" class="ml-1 text-[10px]">
                <span :class="testResults.every(t => t.passed) ? 'text-success' : 'text-error'">
                  {{ testResults.filter(t => t.passed).length }}/{{ testResults.length }}
                </span>
              </span>
            </button>
          </div>

          <!-- Section content -->
          <div class="flex-1 overflow-auto p-3">
            <RequestParams v-if="activeSection === 'params'" :tab="tab" />
            <RequestHeaders v-else-if="activeSection === 'headers'" :tab="tab" />
            <RequestBody v-else-if="activeSection === 'body'" :tab="tab" />
            <RequestAuth v-else-if="activeSection === 'auth'" :tab="tab" />
            <RequestScripts v-else-if="activeSection === 'scripts'" :tab="tab" :logs="scriptLogs" :test-results="testResults" />
          </div>
        </div>
      </template>

      <template #bottom>
        <ResponsePanel :response="tab.response" :request="tab.request" :is-loading="isLoading" :error="error" @cancel="cancelRequest" />
      </template>
    </BaseSplitPane>
  </div>
</template>
