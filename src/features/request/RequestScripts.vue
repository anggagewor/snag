<script setup lang="ts">
import { ref, computed } from 'vue'

import { CheckCircle, XCircle, Terminal, ChevronDown } from 'lucide-vue-next'

import { useTabsStore } from '@/stores/tabs'
import type { Tab } from '@/stores/tabs'
import type { TestResult } from '@/composables/useScriptRunner'
import BaseCodeEditor from '@/components/base/BaseCodeEditor.vue'

const props = defineProps<{
  tab: Tab
  logs: string[]
  testResults: TestResult[]
}>()

const tabsStore = useTabsStore()

const activeScript = ref<'pre-request' | 'test'>('pre-request')

const preRequestScript = computed(() => props.tab.request?.preRequestScript || '')
const testScript = computed(() => props.tab.request?.testScript || '')

function updatePreRequestScript(value: string) {
  tabsStore.updateTabRequest(props.tab.id, { preRequestScript: value })
}

function updateTestScript(value: string) {
  tabsStore.updateTabRequest(props.tab.id, { testScript: value })
}

const passedTests = computed(() => props.testResults.filter((t) => t.passed).length)
const failedTests = computed(() => props.testResults.filter((t) => !t.passed).length)

// Snippets
interface Snippet {
  label: string
  code: string
}

const preRequestSnippets: Snippet[] = [
  {
    label: 'Set variable',
    code: `snag.variables.set('myVar', 'value')`,
  },
  {
    label: 'Get variable',
    code: `const val = snag.variables.get('myVar')`,
  },
  {
    label: 'Generate timestamp',
    code: `snag.variables.set('timestamp', Date.now().toString())`,
  },
  {
    label: 'Generate UUID',
    code: `snag.variables.set('uuid', crypto.randomUUID())`,
  },
  {
    label: 'Generate random number',
    code: `snag.variables.set('random', Math.floor(Math.random() * 10000).toString())`,
  },
  {
    label: 'Log request info',
    code: `console.log('Method:', snag.request.method)
console.log('URL:', snag.request.url)`,
  },
  {
    label: 'Set auth token from variable',
    code: `const token = snag.variables.get('authToken')
console.log('Using token:', token ? '***' : 'NOT SET')`,
  },
]

const testSnippets: Snippet[] = [
  {
    label: 'Status is 200',
    code: `snag.test('Status is 200', () => {
  snag.expect(snag.response.status).toBe(200)
})`,
  },
  {
    label: 'Status is 2xx',
    code: `snag.test('Status is 2xx', () => {
  snag.expect(snag.response.status).toBeGreaterThan(199)
  snag.expect(snag.response.status).toBeLessThan(300)
})`,
  },
  {
    label: 'Response time < 500ms',
    code: `snag.test('Response time is acceptable', () => {
  snag.expect(snag.response.time).toBeLessThan(500)
})`,
  },
  {
    label: 'Body contains string',
    code: `snag.test('Body contains expected value', () => {
  snag.expect(snag.response.body).toContain('expected')
})`,
  },
  {
    label: 'JSON has property',
    code: `snag.test('JSON has property', () => {
  const json = JSON.parse(snag.response.body)
  snag.expect(json).toHaveProperty('data')
})`,
  },
  {
    label: 'JSON value equals',
    code: `snag.test('JSON value matches', () => {
  const json = JSON.parse(snag.response.body)
  snag.expect(json.success).toBe(true)
})`,
  },
  {
    label: 'Header exists',
    code: `snag.test('Content-Type is JSON', () => {
  const ct = snag.response.headers['content-type'] || ''
  snag.expect(ct).toContain('application/json')
})`,
  },
  {
    label: 'Save response value to variable',
    code: `snag.test('Extract token', () => {
  const json = JSON.parse(snag.response.body)
  snag.variables.set('token', json.token)
  snag.expect(json.token).toBeTruthy()
})`,
  },
  {
    label: 'Array length check',
    code: `snag.test('Array is not empty', () => {
  const json = JSON.parse(snag.response.body)
  snag.expect(Array.isArray(json.data)).toBe(true)
  snag.expect(json.data.length).toBeGreaterThan(0)
})`,
  },
]

const activeSnippets = computed(() =>
  activeScript.value === 'pre-request' ? preRequestSnippets : testSnippets
)

const showSnippets = ref(false)

function insertSnippet(snippet: Snippet) {
  const current = activeScript.value === 'pre-request' ? preRequestScript.value : testScript.value
  const newValue = current ? `${current}\n${snippet.code}` : snippet.code

  if (activeScript.value === 'pre-request') {
    updatePreRequestScript(newValue)
  } else {
    updateTestScript(newValue)
  }
  showSnippets.value = false
}
</script>

<template>
  <div class="space-y-3">
    <!-- Script type toggle -->
    <div class="flex items-center gap-1 border-b border-border">
      <button
        class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors"
        :class="activeScript === 'pre-request'
          ? 'border-accent text-primary'
          : 'border-transparent text-secondary hover:text-primary'"
        @click="activeScript = 'pre-request'"
      >
        Pre-request
      </button>
      <button
        class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors"
        :class="activeScript === 'test'
          ? 'border-accent text-primary'
          : 'border-transparent text-secondary hover:text-primary'"
        @click="activeScript = 'test'"
      >
        Tests
        <span v-if="testResults.length > 0" class="ml-1">
          <span :class="failedTests === 0 ? 'text-success' : 'text-error'">
            {{ passedTests }}/{{ testResults.length }}
          </span>
        </span>
      </button>
    </div>

    <!-- Script editor -->
    <div v-if="activeScript === 'pre-request'">
      <p class="text-[10px] text-muted mb-2">
        Runs before the request is sent. Use <code class="bg-surface-alt px-1 rounded">snag.variables.set(key, value)</code> to set variables.
      </p>
      <div class="h-[160px] border border-border rounded overflow-hidden">
        <BaseCodeEditor
          :model-value="preRequestScript"
          language="javascript"
          placeholder="// Pre-request script..."
          @update:model-value="updatePreRequestScript"
        />
      </div>
    </div>

    <div v-if="activeScript === 'test'">
      <p class="text-[10px] text-muted mb-2">
        Runs after the response. Use <code class="bg-surface-alt px-1 rounded">snag.test(name, fn)</code> and <code class="bg-surface-alt px-1 rounded">snag.expect(value)</code>.
      </p>
      <div class="h-[160px] border border-border rounded overflow-hidden">
        <BaseCodeEditor
          :model-value="testScript"
          language="javascript"
          placeholder="// Test script...
// snag.test('Status is 200', () => {
//   snag.expect(snag.response.status).toBe(200)
// })"
          @update:model-value="updateTestScript"
        />
      </div>
    </div>

    <!-- Snippets dropdown -->
    <div class="relative">
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-accent hover:bg-accent/5 border border-border rounded transition-colors"
        @click="showSnippets = !showSnippets"
      >
        <ChevronDown class="w-3 h-3 transition-transform" :class="{ 'rotate-180': showSnippets }" />
        Snippets
      </button>

      <div
        v-if="showSnippets"
        class="absolute left-0 top-full mt-1 w-[280px] bg-surface border border-border rounded-lg shadow-lg z-10 max-h-[220px] overflow-y-auto"
      >
        <button
          v-for="snippet in activeSnippets"
          :key="snippet.label"
          class="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-hover transition-colors border-b border-border last:border-b-0"
          @click="insertSnippet(snippet)"
        >
          <span class="text-xs font-medium text-primary">{{ snippet.label }}</span>
          <span class="text-[10px] font-mono text-muted truncate">{{ snippet.code.split('\n')[0] }}</span>
        </button>
      </div>
    </div>

    <!-- Test Results -->
    <div v-if="testResults.length > 0" class="space-y-1">
      <h4 class="text-xs font-medium text-primary">Test Results</h4>
      <div
        v-for="(result, i) in testResults"
        :key="i"
        class="flex items-center gap-2 px-2 py-1 rounded text-xs"
        :class="result.passed ? 'bg-success/5' : 'bg-error/5'"
      >
        <CheckCircle v-if="result.passed" class="w-3.5 h-3.5 text-success flex-shrink-0" />
        <XCircle v-else class="w-3.5 h-3.5 text-error flex-shrink-0" />
        <span :class="result.passed ? 'text-success' : 'text-error'">{{ result.name }}</span>
        <span v-if="result.error" class="text-error text-[10px] ml-auto truncate max-w-[200px]">{{ result.error }}</span>
      </div>
    </div>

    <!-- Console logs -->
    <div v-if="logs.length > 0" class="space-y-1">
      <div class="flex items-center gap-1">
        <Terminal class="w-3 h-3 text-muted" />
        <h4 class="text-xs font-medium text-primary">Console</h4>
      </div>
      <div class="bg-surface-alt border border-border rounded p-2 max-h-[100px] overflow-y-auto">
        <div v-for="(log, i) in logs" :key="i" class="text-[11px] font-mono text-secondary">
          {{ log }}
        </div>
      </div>
    </div>
  </div>
</template>
