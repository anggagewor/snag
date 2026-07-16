/**
 * StorageAdapter interface.
 *
 * Abstraksi I/O layer. Hari ini: JSON files via Tauri FS.
 * Besok: SQLite, Git, cloud — tanpa mengubah layer di atas.
 *
 * Dependency rule:
 *   StorageAdapter boleh import dari domain/.
 *   StorageAdapter TIDAK BOLEH import dari store/ atau UI.
 */

export interface FileEvent {
  readonly type: 'created' | 'modified' | 'deleted'
  readonly path: string
}

export type Unsubscribe = () => void

export interface StorageAdapter {
  // ─── File I/O ────────────────────────────────────────────────

  /** Read and parse JSON file. Throws if not found. */
  readJson<T>(path: string): Promise<T>

  /** Write object as JSON to file. Creates parent dirs if needed. */
  writeJson(path: string, data: unknown): Promise<void>

  /** Delete file. No-op if not found. */
  deleteFile(path: string): Promise<void>

  /** Check if file or directory exists. */
  exists(path: string): Promise<boolean>

  // ─── Directory Operations ────────────────────────────────────

  /** List filenames in directory matching optional glob pattern. */
  listFiles(directory: string, pattern?: string): Promise<string[]>

  /** Ensure directory exists. Creates recursively if needed. */
  ensureDir(path: string): Promise<void>

  /** Remove directory and all contents. */
  removeDir(path: string): Promise<void>

  // ─── Path Resolution ─────────────────────────────────────────

  /** Resolve path segments relative to active workspace root. */
  workspacePath(...segments: string[]): string

  /** Resolve path segments relative to global app data (~/.snag/). */
  globalPath(...segments: string[]): string

  // ─── Watch (optional, future) ────────────────────────────────

  /** Watch path for changes. Returns unsubscribe function. */
  watch?(path: string, callback: (event: FileEvent) => void): Unsubscribe
}
