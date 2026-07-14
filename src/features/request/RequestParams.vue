<script setup lang="ts">
import { computed } from 'vue'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { KeyValuePair } from '@/types/common'
import BaseKeyValueEditor from '@/components/base/BaseKeyValueEditor.vue'

const props = defineProps<{
  tab: Tab
}>()

const tabsStore = useTabsStore()

const params = computed(() => props.tab.request?.params || [])

function updateParams(value: KeyValuePair[]) {
  tabsStore.updateTabRequest(props.tab.id, { params: value })
}
</script>

<template>
  <BaseKeyValueEditor
    :model-value="params"
    key-placeholder="Parameter name"
    value-placeholder="Parameter value"
    @update:model-value="updateParams"
  />
</template>
