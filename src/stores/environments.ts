import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import { useStorage } from '@/composables/useStorage'
import type { Environment } from '@/types/environment'
import type { UUID } from '@/types/common'

const STORAGE_FILE = 'environments.json'

interface EnvironmentsState {
  environments: Environment[]
  activeEnvironmentId: UUID | null
}

export const useEnvironmentsStore = defineStore('environments', () => {
  const environments = ref<Environment[]>([])
  const activeEnvironmentId = ref<UUID | null>(null)
  const isLoading = ref(false)

  const { read, write } = useStorage()

  const activeEnvironment = computed(() =>
    environments.value.find((e) => e.id === activeEnvironmentId.value) || null
  )

  const resolvedVariables = computed(() => {
    const vars: Record<string, string> = {}
    const env = activeEnvironment.value
    if (env) {
      env.variables
        .filter((v) => v.enabled)
        .forEach((v) => {
          vars[v.key] = v.value
        })
    }
    return vars
  })

  async function load() {
    isLoading.value = true
    const data = await read<EnvironmentsState>(STORAGE_FILE, {
      environments: [],
      activeEnvironmentId: null,
    })
    environments.value = data.environments
    activeEnvironmentId.value = data.activeEnvironmentId
    isLoading.value = false
  }

  async function save() {
    await write<EnvironmentsState>(STORAGE_FILE, {
      environments: environments.value,
      activeEnvironmentId: activeEnvironmentId.value,
    })
  }

  function createEnvironment(name: string): Environment {
    const env: Environment = {
      id: crypto.randomUUID(),
      name,
      variables: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    environments.value.push(env)
    save()
    return env
  }

  function deleteEnvironment(id: UUID) {
    environments.value = environments.value.filter((e) => e.id !== id)
    if (activeEnvironmentId.value === id) {
      activeEnvironmentId.value = null
    }
    save()
  }

  function setActive(id: UUID | null) {
    activeEnvironmentId.value = id
    save()
  }

  function updateEnvironment(id: UUID, updates: Partial<Environment>) {
    const env = environments.value.find((e) => e.id === id)
    if (env) {
      Object.assign(env, updates, { updatedAt: new Date().toISOString() })
      save()
    }
  }

  function resolveVariablesInString(str: string): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return resolvedVariables.value[key] ?? `{{${key}}}`
    })
  }

  return {
    environments,
    activeEnvironmentId,
    activeEnvironment,
    resolvedVariables,
    isLoading,
    load,
    save,
    createEnvironment,
    deleteEnvironment,
    setActive,
    updateEnvironment,
    resolveVariablesInString,
  }
})
