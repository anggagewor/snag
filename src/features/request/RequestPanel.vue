<script setup lang="ts">
import { ref, computed } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import { useHistoryStore } from '@/stores/history'
import { useHttp } from '@/composables/useHttp'
import { HttpMethod } from '@/types/common'
import type { Tab } from '@/stores/tabs'
import BaseSplitPane from '@/components/base/BaseSplitPane.vue'
import RequestUrlBar from './RequestUrlBar.vue'
import RequestParams from './RequestParams.vue'
import RequestHeaders from './RequestHeaders.vue'
import RequestBody from './RequestBody.vue'
import RequestAuth from './RequestAuth.vue'
import ResponsePanel from '@/features/response/ResponsePanel.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()
const historyStore = useHistoryStore()
const { isLoading, error, sendRequest } = useHttp()

const activeSection = ref<'params' | 'headers' | 'body' | 'auth'>('params')

const request = computed(() => props.tab.request!)

function updateMethod(method: HttpMethod) {
  tabsStore.updateTabRequest(props.tab.id, { method })
}

function updateUrl(url: string) {
  tabsStore.updateTabRequest(props.tab.id, { url })
}

async function handleSend() {
  if (!request.value.url) return

  const response = await sendRequest(request.value)
  tabsStore.updateTabResponse(props.tab.id, response)
  historyStore.addEntry(request.value, response)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- URL Bar -->
    <RequestUrlBar
      :request="request"
      :is-loading="isLoading"
      @update:method="updateMethod"
      @update:url="updateUrl"
      @send="handleSend"
    />

    <!-- Error display -->
    <div v-if="error" class="mx-3 mb-2 px-3 py-2 bg-error/10 text-error text-sm rounded">
      {{ error }}
    </div>

    <!-- Request/Response split -->
    <BaseSplitPane :initial-split="50" class="flex-1">
      <template #top>
        <div class="h-full flex flex-col">
          <!-- Section tabs -->
          <div class="flex border-b border-border px-3">
            <button
              v-for="section in (['params', 'headers', 'body', 'auth'] as const)"
              :key="section"
              class="px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors"
              :class="activeSection === section
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'"
              @click="activeSection = section"
            >
              {{ section }}
            </button>
          </div>

          <!-- Section content -->
          <div class="flex-1 overflow-auto p-3">
            <RequestParams v-if="activeSection === 'params'" :tab="tab" />
            <RequestHeaders v-else-if="activeSection === 'headers'" :tab="tab" />
            <RequestBody v-else-if="activeSection === 'body'" :tab="tab" />
            <RequestAuth v-else-if="activeSection === 'auth'" :tab="tab" />
          </div>
        </div>
      </template>

      <template #bottom>
        <ResponsePanel :response="tab.response" :is-loading="isLoading" />
      </template>
    </BaseSplitPane>
  </div>
</template>
