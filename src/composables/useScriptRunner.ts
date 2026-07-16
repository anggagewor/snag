export interface ScriptContext {
  /** Environment variables (read/write) */
  variables: Record<string, string>
  /** Request details (read-only in pre-request, can set headers/params) */
  request: {
    url: string
    method: string
    headers: Record<string, string>
  }
  /** Response details (only available in test scripts) */
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    time: number
    size: number
  }
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface ScriptOutput {
  logs: string[]
  variables: Record<string, string>
  tests: TestResult[]
  error?: string
}

/**
 * Run a user-provided script in a sandboxed context.
 * Uses Function constructor (isolated from module scope).
 */
export function useScriptRunner() {
  function runPreRequestScript(
    script: string,
    ctx: ScriptContext
  ): ScriptOutput {
    return executeScript(script, ctx)
  }

  function runTestScript(
    script: string,
    ctx: ScriptContext
  ): ScriptOutput {
    return executeScript(script, ctx)
  }

  function executeScript(script: string, ctx: ScriptContext): ScriptOutput {
    const logs: string[] = []
    const tests: TestResult[] = []
    const variables = { ...ctx.variables }

    if (!script || !script.trim()) {
      return { logs, variables, tests }
    }

    // Build sandbox API
    const snag = {
      variables: {
        get(key: string): string | undefined {
          return variables[key]
        },
        set(key: string, value: string) {
          variables[key] = value
        },
      },
      request: ctx.request,
      response: ctx.response || null,
      test(name: string, fn: () => void) {
        try {
          fn()
          tests.push({ name, passed: true })
        } catch (err) {
          tests.push({
            name,
            passed: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
      expect(value: unknown) {
        return createExpect(value)
      },
    }

    const console = {
      log(...args: unknown[]) {
        logs.push(args.map(String).join(' '))
      },
      warn(...args: unknown[]) {
        logs.push(`[warn] ${args.map(String).join(' ')}`)
      },
      error(...args: unknown[]) {
        logs.push(`[error] ${args.map(String).join(' ')}`)
      },
    }

    try {
      const fn = new Function('snag', 'console', script)
      fn(snag, console)
    } catch (err) {
      return {
        logs,
        variables,
        tests,
        error: err instanceof Error ? err.message : String(err),
      }
    }

    return { logs, variables, tests }
  }

  return {
    runPreRequestScript,
    runTestScript,
  }
}

function createExpect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`)
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`)
      }
    },
    toContain(expected: string) {
      if (typeof actual !== 'string' || !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`)
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`)
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`)
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`)
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`)
      }
    },
    toHaveProperty(key: string) {
      if (typeof actual !== 'object' || actual === null || !(key in actual)) {
        throw new Error(`Expected object to have property "${key}"`)
      }
    },
    toHaveStatus(status: number) {
      const s = (actual as { status?: number })?.status
      if (s !== status) {
        throw new Error(`Expected status ${status}, got ${s}`)
      }
    },
  }
}
