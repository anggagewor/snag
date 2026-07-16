<script setup lang="ts">
import { computed } from 'vue'

import { useWorkspaceStore } from '@/stores/workspace'
import type { EnvironmentId } from '@/domain'
import BaseSelect from '@/components/base/BaseSelect.vue'
import type { SelectOption } from '@/components/base/BaseSelect.vue'

const workspaceStore = useWorkspaceStore()

const options = computed<SelectOption[]>(() => [
  { label: 'No Environment', value: '__none__' },
  ...workspaceStore.environments.map((env) => ({
    label: env.name,
    value: env.id,
    color: '#10b981',
  })),
])

const selectedValue = computed(() => workspaceStore.activeEnvironmentId || '__none__')

function onSelect(value: string) {
  workspaceStore.setActiveEnvironment(value === '__none__' ? null : value as EnvironmentId)
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
