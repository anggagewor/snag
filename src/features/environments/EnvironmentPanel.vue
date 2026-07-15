<script setup lang="ts">
import { ref, computed } from 'vue'

import { Plus, X, Check, Pencil, Trash2, FlaskConical } from 'lucide-vue-next'

import { useEnvironmentsStore } from '@/stores/environments'
import type { EnvironmentVariable } from '@/types/environment'
import type { UUID } from '@/types/common'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'

const environmentsStore = useEnvironmentsStore()

const selectedEnvId = ref<UUID | null>(null)
const editingNameId = ref<UUID | null>(null)
const editingName = ref('')
const syntaxHint = '{{variable}}'

const selectedEnv = computed(() =>
  environmentsStore.environments.find((e) => e.id === selectedEnvId.value) || null
)

function selectEnv(id: UUID) {
  selectedEnvId.value = id
}

function createEnv() {
  const env = environmentsStore.createEnvironment('New Environment')
  selectedEnvId.value = env.id
  startRename(env.id, env.name)
}

function deleteEnv(id: UUID) {
  environmentsStore.deleteEnvironment(id)
  if (selectedEnvId.value === id) {
    selectedEnvId.value = environmentsStore.environments[0]?.id || null
  }
}

function startRename(id: UUID, name: string) {
  editingNameId.value = id
  editingName.value = name
}

function finishRename() {
  if (editingNameId.value && editingName.value.trim()) {
    environmentsStore.updateEnvironment(editingNameId.value, { name: editingName.value.trim() })
  }
  editingNameId.value = null
}

function setActive(id: UUID | null) {
  environmentsStore.setActive(id)
}

// Variable management
function getVariables(): EnvironmentVariable[] {
  const vars = selectedEnv.value?.variables || []
  if (vars.length === 0 || (vars[vars.length - 1].key !== '')) {
    return [...vars, { key: '', value: '', enabled: true }]
  }
  return vars
}

function updateVariable(index: number, field: 'key' | 'value', value: string) {
  if (!selectedEnv.value) return
  const vars = [...(selectedEnv.value.variables || [])]

  if (index >= vars.length) {
    vars.push({ key: '', value: '', enabled: true })
  }
  vars[index] = { ...vars[index], [field]: value }

  // Auto-add row
  if (index === vars.length - 1 && (vars[index].key !== '' || vars[index].value !== '')) {
    vars.push({ key: '', value: '', enabled: true })
  }

  // Clean trailing empty rows (keep one)
  const cleaned = vars.filter((v, i) => {
    if (i === vars.length - 1) return true
    return v.key !== '' || v.value !== ''
  })

  environmentsStore.updateEnvironment(selectedEnv.value.id, { variables: cleaned })
}

function toggleVariable(index: number) {
  if (!selectedEnv.value) return
  const vars = [...selectedEnv.value.variables]
  vars[index] = { ...vars[index], enabled: !vars[index].enabled }
  environmentsStore.updateEnvironment(selectedEnv.value.id, { variables: vars })
}

function removeVariable(index: number) {
  if (!selectedEnv.value) return
  const vars = selectedEnv.value.variables.filter((_, i) => i !== index)
  environmentsStore.updateEnvironment(selectedEnv.value.id, { variables: vars })
}
</script>

<template>
  <div class="flex h-full">
    <!-- Left: Environment list -->
    <div class="w-[200px] flex-shrink-0 border-r border-border flex flex-col">
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <span class="text-xs font-medium text-muted uppercase tracking-wide">Environments</span>
        <BaseButton variant="ghost" size="sm" @click="createEnv">
          <Plus class="w-3.5 h-3.5" />
        </BaseButton>
      </div>

      <div class="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        <div
          v-for="env in environmentsStore.environments"
          :key="env.id"
          class="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer group"
          :class="selectedEnvId === env.id ? 'bg-accent/10 text-accent' : 'text-primary hover:bg-surface-hover'"
          @click="selectEnv(env.id)"
        >
          <!-- Active indicator -->
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :class="environmentsStore.activeEnvironmentId === env.id ? 'bg-success' : 'bg-border'"
          />

          <!-- Name -->
          <input
            v-if="editingNameId === env.id"
            v-model="editingName"
            class="flex-1 bg-surface border border-accent rounded px-1 py-0.5 text-xs focus:outline-none"
            @keydown.enter="finishRename"
            @keydown.escape="editingNameId = null"
            @blur="finishRename"
            @click.stop
          />
          <span v-else class="flex-1 truncate">{{ env.name }}</span>

          <!-- Actions -->
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100" @click.stop>
            <button
              class="p-0.5 text-muted hover:text-success rounded"
              title="Set as active"
              @click="setActive(environmentsStore.activeEnvironmentId === env.id ? null : env.id)"
            >
              <Check class="w-3 h-3" />
            </button>
            <button
              class="p-0.5 text-muted hover:text-primary rounded"
              title="Rename"
              @click="startRename(env.id, env.name)"
            >
              <Pencil class="w-3 h-3" />
            </button>
            <button
              class="p-0.5 text-muted hover:text-error rounded"
              title="Delete"
              @click="deleteEnv(env.id)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>

        <div v-if="environmentsStore.environments.length === 0" class="text-center py-6">
          <p class="text-xs text-muted">No environments</p>
        </div>
      </div>
    </div>

    <!-- Right: Variables editor -->
    <div class="flex-1 flex flex-col">
      <div v-if="!selectedEnv" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <FlaskConical class="w-10 h-10 mx-auto text-muted/30 mb-2" :stroke-width="1.5" />
          <p class="text-sm text-muted">Select an environment</p>
          <p class="text-xs text-muted mt-0.5">or create a new one</p>
        </div>
      </div>

      <template v-else>
        <!-- Env header -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border">
          <div>
            <h3 class="text-sm font-medium text-primary">{{ selectedEnv.name }}</h3>
            <p class="text-[10px] text-muted">
              Use <code class="px-1 py-0.5 rounded bg-surface-alt font-mono">{{ syntaxHint }}</code> syntax in requests
            </p>
          </div>
          <BaseBadge
            v-if="environmentsStore.activeEnvironmentId === selectedEnv.id"
            variant="success"
          >
            Active
          </BaseBadge>
        </div>

        <!-- Variables table -->
        <div class="flex-1 overflow-auto">
          <!-- Header -->
          <div class="grid grid-cols-[32px_1fr_1fr_32px] gap-0 text-xs text-muted border-b border-border sticky top-0 bg-surface">
            <span class="px-1 py-1.5"></span>
            <span class="px-2 py-1.5 border-l border-border">Variable</span>
            <span class="px-2 py-1.5 border-l border-border">Value</span>
            <span class="px-1 py-1.5 border-l border-border"></span>
          </div>

          <!-- Rows -->
          <div
            v-for="(variable, index) in getVariables()"
            :key="index"
            class="grid grid-cols-[32px_1fr_1fr_32px] gap-0 items-center group border-b border-border"
          >
            <div class="flex justify-center h-full items-center">
              <input
                v-if="variable.key"
                type="checkbox"
                :checked="variable.enabled"
                class="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
                @change="toggleVariable(index)"
              />
            </div>
            <div class="border-l border-border h-full" :class="{ 'opacity-50': !variable.enabled }">
              <input
                :value="variable.key"
                placeholder="Variable name"
                class="w-full h-full bg-transparent text-primary text-xs px-2 py-2 font-mono placeholder:text-muted focus:outline-none focus:bg-surface-hover"
                @input="updateVariable(index, 'key', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="border-l border-border h-full" :class="{ 'opacity-50': !variable.enabled }">
              <input
                :value="variable.value"
                placeholder="Value"
                class="w-full h-full bg-transparent text-primary text-xs px-2 py-2 font-mono placeholder:text-muted focus:outline-none focus:bg-surface-hover"
                @input="updateVariable(index, 'value', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="flex justify-center h-full items-center border-l border-border">
              <button
                v-if="variable.key"
                class="text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                @click="removeVariable(index)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
