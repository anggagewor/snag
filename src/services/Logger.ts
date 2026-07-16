export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  source: string
  message: string
  metadata?: Record<string, unknown>
}

export interface Logger {
  debug(source: string, message: string, metadata?: Record<string, unknown>): void
  info(source: string, message: string, metadata?: Record<string, unknown>): void
  warn(source: string, message: string, metadata?: Record<string, unknown>): void
  error(source: string, message: string, metadata?: Record<string, unknown>): void
  _fallbackMode: boolean
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_AGE_DAYS = 7
const LOG_FILE_PATTERN = /^snag-(\d{4}-\d{2}-\d{2})(?:-(\d{3}))?\.log$/

export function formatLogEntry(entry: LogEntry): string {
  const obj: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level,
    source: entry.source,
    message: entry.message,
  }
  if (entry.metadata !== undefined) {
    obj.metadata = entry.metadata
  }
  return JSON.stringify(obj)
}

export function shouldRotate(fileSize: number): boolean {
  return fileSize > MAX_FILE_SIZE
}

export function getExpiredFiles(files: string[], now: Date): string[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS)

  return files.filter(filename => {
    const match = LOG_FILE_PATTERN.exec(filename)
    if (!match) return false
    const fileDate = new Date(match[1] + 'T00:00:00.000Z')
    return fileDate < cutoff
  })
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentLogFilename(): string {
  return `snag-${getTodayDateString()}.log`
}

function getNextSplitFilename(files: string[], dateStr: string): string {
  let maxSuffix = 0
  for (const file of files) {
    const match = LOG_FILE_PATTERN.exec(file)
    if (match && match[1] === dateStr && match[2]) {
      const suffix = parseInt(match[2], 10)
      if (suffix > maxSuffix) maxSuffix = suffix
    }
  }
  const next = (maxSuffix + 1).toString().padStart(3, '0')
  return `snag-${dateStr}-${next}.log`
}

export function createLogger(getLogsDir: () => string): Logger {
  let fallbackMode = false
  let dirEnsured = false

  async function ensureLogsDir(): Promise<void> {
    if (dirEnsured) return
    try {
      const { mkdir, exists } = await import('@tauri-apps/plugin-fs')
      const dir = getLogsDir()
      const dirExists = await exists(dir)
      if (!dirExists) {
        await mkdir(dir, { recursive: true })
      }
      dirEnsured = true
    } catch {
      fallbackMode = true
    }
  }

  async function writeEntry(entry: LogEntry): Promise<void> {
    if (fallbackMode) {
      consoleFallback(entry)
      return
    }

    try {
      await ensureLogsDir()
      if (fallbackMode) {
        consoleFallback(entry)
        return
      }

      const { writeTextFile, readDir, stat, rename, remove } = await import('@tauri-apps/plugin-fs')
      const dir = getLogsDir()
      const filename = getCurrentLogFilename()
      const filepath = `${dir}/${filename}`
      const line = formatLogEntry(entry) + '\n'

      await writeTextFile(filepath, line, { append: true, create: true })

      // Check rotation
      try {
        const fileStat = await stat(filepath)
        if (fileStat.size !== undefined && shouldRotate(fileStat.size)) {
          const entries = await readDir(dir)
          const logFiles = entries
            .filter(e => e.isFile && LOG_FILE_PATTERN.test(e.name))
            .map(e => e.name)

          const dateStr = getTodayDateString()
          const splitName = getNextSplitFilename(logFiles, dateStr)
          await rename(filepath, `${dir}/${splitName}`)

          // Cleanup expired files
          const updatedEntries = await readDir(dir)
          const allFiles = updatedEntries
            .filter(e => e.isFile && LOG_FILE_PATTERN.test(e.name))
            .map(e => e.name)
          const expired = getExpiredFiles(allFiles, new Date())
          for (const expiredFile of expired) {
            await remove(`${dir}/${expiredFile}`)
          }
        }
      } catch (rotationError) {
        console.error('[Logger] Rotation failed:', rotationError)
      }
    } catch {
      fallbackMode = true
      consoleFallback(entry)
    }
  }

  function consoleFallback(entry: LogEntry): void {
    const formatted = formatLogEntry(entry)
    switch (entry.level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  function log(level: LogLevel, source: string, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      ...(metadata !== undefined && { metadata }),
    }
    writeEntry(entry)
  }

  const logger: Logger = {
    debug(source, message, metadata) {
      log('debug', source, message, metadata)
    },
    info(source, message, metadata) {
      log('info', source, message, metadata)
    },
    warn(source, message, metadata) {
      log('warn', source, message, metadata)
    },
    error(source, message, metadata) {
      log('error', source, message, metadata)
    },
    get _fallbackMode() {
      return fallbackMode
    },
    set _fallbackMode(value: boolean) {
      fallbackMode = value
    },
  }

  return logger
}
