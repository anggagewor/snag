import { ref } from 'vue'

const isReady = ref(false)
const isTauri = ref(typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window)

async function ensureAppDir() {
  if (!isTauri.value) {
    isReady.value = true
    return
  }

  const { exists, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
  const dirExists = await exists('', { baseDir: BaseDirectory.AppData })
  if (!dirExists) {
    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
  }
  isReady.value = true
}

export function useStorage() {
  async function read<T>(filename: string, fallback: T): Promise<T> {
    try {
      if (!isTauri.value) {
        // Fallback to localStorage in browser dev mode
        const stored = localStorage.getItem(`snag:${filename}`)
        return stored ? JSON.parse(stored) as T : fallback
      }

      if (!isReady.value) await ensureAppDir()

      const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const fileExists = await exists(filename, { baseDir: BaseDirectory.AppData })
      if (!fileExists) return fallback

      const content = await readTextFile(filename, { baseDir: BaseDirectory.AppData })
      return JSON.parse(content) as T
    } catch (error) {
      console.error(`[useStorage] Failed to read ${filename}:`, error)
      return fallback
    }
  }

  async function write<T>(filename: string, data: T): Promise<boolean> {
    try {
      if (!isTauri.value) {
        // Fallback to localStorage in browser dev mode
        localStorage.setItem(`snag:${filename}`, JSON.stringify(data))
        return true
      }

      if (!isReady.value) await ensureAppDir()

      const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const content = JSON.stringify(data, null, 2)
      await writeTextFile(filename, content, { baseDir: BaseDirectory.AppData })
      return true
    } catch (error) {
      console.error(`[useStorage] Failed to write ${filename}:`, error)
      return false
    }
  }

  return { read, write, isTauri }
}
