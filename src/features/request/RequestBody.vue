<script setup lang="ts">
import { computed, ref } from 'vue'

import { AlignLeft, Ban } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import type { BodyType } from '@/types/request'
import type { Tab } from '@/stores/tabs'
import type { KeyValuePair } from '@/types/common'
import BaseKeyValueEditor from '@/components/base/BaseKeyValueEditor.vue'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'
import BaseCodeEditor from '@/components/base/BaseCodeEditor.vue'
import type { EditorLanguage } from '@/components/base/BaseCodeEditor.vue'
import RequestFormData from './RequestFormData.vue'
import RequestBinary from './RequestBinary.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const bodyTypes: { label: string; value: BodyType }[] = [
  { label: 'none', value: 'none' },
  { label: 'JSON', value: 'json' },
  { label: 'Form Data', value: 'form-data' },
  { label: 'URL Encoded', value: 'x-www-form-urlencoded' },
  { label: 'Raw', value: 'raw' },
  { label: 'Binary', value: 'binary' },
]

const rawLanguageOptions: SelectOption[] = [
  { label: 'Text', value: 'text' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'HTML', value: 'html' },
  { label: 'XML', value: 'xml' },
]

const rawLanguage = ref<EditorLanguage>('text')

const currentBody = computed(() => props.tab.request?.body)

function setBodyType(type: BodyType) {
  const body = { ...props.tab.request!.body, type }
  // Initialize sub-fields if needed
  if (type === 'form-data' && !body.formData) {
    body.formData = []
  }
  if (type === 'x-www-form-urlencoded' && !body.urlencoded) {
    body.urlencoded = []
  }
  if ((type === 'json' || type === 'raw') && body.raw === undefined) {
    body.raw = ''
  }
  tabsStore.updateTabRequest(props.tab.id, { body })
}

function updateRawBody(value: string) {
  tabsStore.updateTabRequest(props.tab.id, {
    body: { ...props.tab.request!.body, raw: value },
  })
}

function updateUrlEncoded(value: KeyValuePair[]) {
  tabsStore.updateTabRequest(props.tab.id, {
    body: { ...props.tab.request!.body, urlencoded: value },
  })
}

function formatJson() {
  const raw = currentBody.value?.raw
  if (!raw) return
  try {
    const formatted = JSON.stringify(JSON.parse(raw), null, 2)
    updateRawBody(formatted)
  } catch {
    // invalid JSON, do nothing
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Body type selector -->
    <div class="flex items-center gap-1 pb-3 border-b border-border">
      <button
        v-for="bt in bodyTypes"
        :key="bt.value"
        class="px-2.5 py-1.5 text-xs rounded transition-colors"
        :class="currentBody?.type === bt.value
          ? 'bg-accent/10 text-accent font-medium'
          : 'text-secondary hover:text-primary hover:bg-surface-hover'"
        @click="setBodyType(bt.value)"
      >
        {{ bt.label }}
      </button>

      <!-- Raw language selector -->
      <div v-if="currentBody?.type === 'raw'" class="ml-auto w-[120px]">
        <BaseSelect
          v-model="rawLanguage"
          :options="rawLanguageOptions"
          size="sm"
        />
      </div>

      <!-- JSON format button -->
      <button
        v-if="currentBody?.type === 'json'"
        class="ml-auto px-2 py-1 text-xs text-secondary hover:text-primary hover:bg-surface-hover rounded transition-colors"
        title="Format JSON"
        @click="formatJson"
      >
        <AlignLeft class="w-4 h-4 inline-block mr-0.5" />
        Format
      </button>
    </div>

    <!-- Body content -->
    <div class="flex-1 pt-3 overflow-auto">
      <!-- None -->
      <div v-if="currentBody?.type === 'none'" class="flex items-center justify-center h-full">
        <div class="text-center">
          <Ban class="w-10 h-10 mx-auto text-muted/40 mb-2" :stroke-width="1.5" />
          <p class="text-sm text-muted">No body</p>
          <p class="text-xs text-muted mt-0.5">This request does not have a body</p>
        </div>
      </div>

      <!-- JSON editor -->
      <div v-else-if="currentBody?.type === 'json'" class="h-full flex flex-col">
        <BaseCodeEditor
          :model-value="currentBody?.raw || ''"
          language="json"
          placeholder='{ "key": "value" }'
          @update:model-value="updateRawBody"
        />
      </div>

      <!-- Raw editor -->
      <div v-else-if="currentBody?.type === 'raw'" class="h-full">
        <BaseCodeEditor
          :model-value="currentBody?.raw || ''"
          :language="rawLanguage"
          placeholder="Enter raw body content..."
          @update:model-value="updateRawBody"
        />
      </div>

      <!-- Form Data -->
      <div v-else-if="currentBody?.type === 'form-data'">
        <RequestFormData :tab="tab" />
      </div>

      <!-- URL Encoded -->
      <div v-else-if="currentBody?.type === 'x-www-form-urlencoded'">
        <BaseKeyValueEditor
          :model-value="currentBody?.urlencoded || []"
          key-placeholder="Field name"
          value-placeholder="Field value"
          @update:model-value="updateUrlEncoded"
        />
      </div>

      <!-- Binary -->
      <div v-else-if="currentBody?.type === 'binary'" class="h-full">
        <RequestBinary :tab="tab" />
      </div>
    </div>
  </div>
</template>
