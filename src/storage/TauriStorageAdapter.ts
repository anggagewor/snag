/**
 * TauriStorageAdapter — concrete StorageAdapter using Tauri FS plugin.
 *
 * Handles all filesystem I/O through @tauri-apps/plugin-fs.
 * Falls back to localStorage in browser dev mode (vite dev without Tauri).
 */

import type { StorageAdapter } from './StorageAdapter'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

let _workspaceRoot: string | null = null
let _globalRoot: string | null = null

async function getGlobalRoot(): Promise<string> {
  if (_globalRoot) return _globalRoot

  if (!isTauri) {
    _globalRoot = '~/.snag'
    return _globalRoot
  }

  const { appDataDir } = await import('@tauri-apps/api/path')
  _globalRoot = await appDataDir()
  return _globalRoot
}

function joinPath(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
}

// ─── Tauri Implementation ────────────────────────────────────────

async function tauriReadJson<T>(path: string): Promise<T> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const content = await readTextFile(path)
  return JSON.parse(content) as T
}

async function tauriWriteJson(path: string, data: unknown): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const dir = path.substring(0, path.lastIndexOf('/'))
  if (dir) {
    await tauriEnsureDir(dir)
  }
  const content = JSON.stringify(data, null, 2)
  await writeTextFile(path, content)
}

async function tauriDeleteFile(path: string): Promise<void> {
  const { remove, exists } = await import('@tauri-apps/plugin-fs')
  const fileExists = await exists(path)
  if (fileExists) {
    await remove(path)
  }
}

async function tauriExists(path: string): Promise<boolean> {
  const { exists } = await import('@tauri-apps/plugin-fs')
  return exists(path)
}

async function tauriListFiles(directory: string, pattern?: string): Promise<string[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs')
  const entries = await readDir(directory)
  let filenames = entries
    .filter(entry => entry.isFile)
    .map(entry => entry.name)

  if (pattern) {
    const regex = globToRegex(pattern)
    filenames = filenames.filter(name => regex.test(name))
  }

  return filenames
}

async function tauriEnsureDir(path: string): Promise<void> {
  const { mkdir, exists } = await import('@tauri-apps/plugin-fs')
  const dirExists = await exists(path)
  if (!dirExists) {
    await mkdir(path, { recursive: true })
  }
}

async function tauriRemoveDir(path: string): Promise<void> {
  const { remove, exists } = await import('@tauri-apps/plugin-fs')
  const dirExists = await exists(path)
  if (dirExists) {
    await remove(path, { recursive: true })
  }
}

// ─── Browser Fallback (dev mode without Tauri) ───────────────────

function localStorageKey(path: string): string {
  return `snag:fs:${path}`
}

function browserReadJson<T>(path: string): Promise<T> {
  const stored = localStorage.getItem(localStorageKey(path))
  if (!stored) {
    return Promise.reject(new Error(`File not found: ${path}`))
  }
  return Promise.resolve(JSON.parse(stored) as T)
}

function browserWriteJson(path: string, data: unknown): Promise<void> {
  localStorage.setItem(localStorageKey(path), JSON.stringify(data, null, 2))
  return Promise.resolve()
}

function browserDeleteFile(path: string): Promise<void> {
  localStorage.removeItem(localStorageKey(path))
  return Promise.resolve()
}

function browserExists(path: string): Promise<boolean> {
  return Promise.resolve(localStorage.getItem(localStorageKey(path)) !== null)
}

function browserListFiles(directory: string, pattern?: string): Promise<string[]> {
  const prefix = localStorageKey(directory + '/')
  const files: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      const relativePath = key.slice(prefix.length)
      if (!relativePath.includes('/')) {
        files.push(relativePath)
      }
    }
  }

  if (pattern) {
    const regex = globToRegex(pattern)
    return Promise.resolve(files.filter(name => regex.test(name)))
  }

  return Promise.resolve(files)
}

function browserEnsureDir(_path: string): Promise<void> {
  return Promise.resolve()
}

function browserRemoveDir(path: string): Promise<void> {
  const prefix = localStorageKey(path)
  const toRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      toRemove.push(key)
    }
  }

  toRemove.forEach(key => localStorage.removeItem(key))
  return Promise.resolve()
}

// ─── Utility ─────────────────────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${escaped}$`)
}

// ─── Factory ─────────────────────────────────────────────────────

export function createTauriStorageAdapter(): StorageAdapter {
  return {
    readJson<T>(path: string): Promise<T> {
      return isTauri ? tauriReadJson<T>(path) : browserReadJson<T>(path)
    },

    writeJson(path: string, data: unknown): Promise<void> {
      return isTauri ? tauriWriteJson(path, data) : browserWriteJson(path, data)
    },

    deleteFile(path: string): Promise<void> {
      return isTauri ? tauriDeleteFile(path) : browserDeleteFile(path)
    },

    exists(path: string): Promise<boolean> {
      return isTauri ? tauriExists(path) : browserExists(path)
    },

    listFiles(directory: string, pattern?: string): Promise<string[]> {
      return isTauri ? tauriListFiles(directory, pattern) : browserListFiles(directory, pattern)
    },

    ensureDir(path: string): Promise<void> {
      return isTauri ? tauriEnsureDir(path) : browserEnsureDir(path)
    },

    removeDir(path: string): Promise<void> {
      return isTauri ? tauriRemoveDir(path) : browserRemoveDir(path)
    },

    workspacePath(...segments: string[]): string {
      if (!_workspaceRoot) {
        throw new Error('No workspace is currently open. Call setWorkspaceRoot() first.')
      }
      return joinPath(_workspaceRoot, ...segments)
    },

    globalPath(...segments: string[]): string {
      if (!_globalRoot) {
        throw new Error('Global root not initialized. Call initGlobalRoot() first.')
      }
      return joinPath(_globalRoot, ...segments)
    },
  }
}

// ─── Adapter Configuration ───────────────────────────────────────

/** Set the workspace root path. Called when opening a workspace. */
export function setWorkspaceRoot(path: string | null): void {
  _workspaceRoot = path
}

/** Get current workspace root path. */
export function getWorkspaceRoot(): string | null {
  return _workspaceRoot
}

/** Initialize global root path. Call once at app startup. */
export async function initGlobalRoot(): Promise<string> {
  const root = await getGlobalRoot()
  _globalRoot = root
  return root
}
