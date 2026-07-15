<script setup lang="ts">
import { computed } from 'vue'

import { useEnvironmentsStore } from '@/stores/environments'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'

const environmentsStore = useEnvironmentsStore()

const options = computed<SelectOption[]>(() => [
  { label: 'No Environment', value: '__none__' },
  ...environmentsStore.environments.map((env) => ({
    label: env.name,
    value: env.id,
    color: '#10b981', // green dot for all envs
  })),
])

const selectedValue = computed(() => environmentsStore.activeEnvironmentId || '__none__')

function onSelect(value: string) {
  environmentsStore.setActive(value === '__none__' ? null : value)
}
</script>

<template>
  <BaseSelect
    :model-value="selectedValue"
    :options="options"
    size="md"
    placeholder="Environment"
    searchable
    align="right"
    @update:model-value="onSelect"
  />
</template>
