/**
 * CookieJarService implementation.
 *
 * Stores cookies per-workspace at <workspace>/cookies.json.
 * Handles Set-Cookie parsing, domain/path matching, and expiration.
 */

import type { Cookie } from '../domain'
import type { StorageAdapter } from '../storage'
import type { CookieJarService } from './CookieJarService'

const COOKIES_FILE = 'cookies.json'

interface CookieJarFile {
  readonly version: 1
  readonly cookies: Cookie[]
}

export function createCookieJarService(storage: StorageAdapter): CookieJarService {
  let cookies: Cookie[] = []

  function cookiesPath(): string {
    return storage.workspacePath(COOKIES_FILE)
  }

  async function persist(): Promise<void> {
    const file: CookieJarFile = { version: 1, cookies }
    await storage.writeJson(cookiesPath(), file)
  }

  function parseDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }

  function parsePath(url: string): string {
    try {
      return new URL(url).pathname
    } catch {
      return '/'
    }
  }

  function isExpired(cookie: Cookie): boolean {
    if (!cookie.expires) return false
    return new Date(cookie.expires).getTime() < Date.now()
  }

  function domainMatches(cookieDomain: string, requestDomain: string): boolean {
    if (cookieDomain === requestDomain) return true
    // Leading dot means subdomain matching
    const withDot = cookieDomain.startsWith('.') ? cookieDomain : `.${cookieDomain}`
    return requestDomain.endsWith(withDot) || requestDomain === withDot.slice(1)
  }

  function pathMatches(cookiePath: string, requestPath: string): boolean {
    if (cookiePath === '/') return true
    if (requestPath === cookiePath) return true
    return requestPath.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`)
  }

  function isSecureUrl(url: string): boolean {
    try {
      return new URL(url).protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Parse a single Set-Cookie header value into a Cookie object.
   */
  function parseSetCookie(headerValue: string, requestUrl: string): Cookie | null {
    const parts = headerValue.split(';').map(p => p.trim())
    if (parts.length === 0) return null

    // First part is name=value
    const nameValue = parts[0]
    const eqIdx = nameValue.indexOf('=')
    if (eqIdx < 1) return null

    const name = nameValue.slice(0, eqIdx).trim()
    const value = nameValue.slice(eqIdx + 1).trim()

    let domain = parseDomain(requestUrl)
    let path = '/'
    let expires: string | undefined
    let httpOnly = false
    let secure = false
    let sameSite: 'Strict' | 'Lax' | 'None' | undefined

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      const lowerPart = part.toLowerCase()

      if (lowerPart.startsWith('domain=')) {
        domain = part.slice(7).trim()
        if (domain.startsWith('.')) domain = domain.slice(1)
      } else if (lowerPart.startsWith('path=')) {
        path = part.slice(5).trim() || '/'
      } else if (lowerPart.startsWith('expires=')) {
        const dateStr = part.slice(8).trim()
        const parsed = new Date(dateStr)
        if (!isNaN(parsed.getTime())) {
          expires = parsed.toISOString()
        }
      } else if (lowerPart.startsWith('max-age=')) {
        const seconds = parseInt(part.slice(8).trim(), 10)
        if (!isNaN(seconds)) {
          expires = new Date(Date.now() + seconds * 1000).toISOString()
        }
      } else if (lowerPart === 'httponly') {
        httpOnly = true
      } else if (lowerPart === 'secure') {
        secure = true
      } else if (lowerPart.startsWith('samesite=')) {
        const val = part.slice(9).trim().toLowerCase()
        if (val === 'strict') sameSite = 'Strict'
        else if (val === 'lax') sameSite = 'Lax'
        else if (val === 'none') sameSite = 'None'
      }
    }

    return {
      name,
      value,
      domain,
      path,
      expires,
      httpOnly,
      secure,
      sameSite,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Upsert a cookie — replace if same name+domain+path exists.
   */
  function upsertCookie(cookie: Cookie): void {
    const idx = cookies.findIndex(
      c => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
    )
    if (idx >= 0) {
      cookies[idx] = cookie
    } else {
      cookies.push(cookie)
    }
  }

  /**
   * Remove expired cookies from memory.
   */
  function pruneExpired(): void {
    cookies = cookies.filter(c => !isExpired(c))
  }

  return {
    async load(): Promise<void> {
      try {
        const path = cookiesPath()
        const exists = await storage.exists(path)
        if (!exists) {
          cookies = []
          return
        }
        const file = await storage.readJson<CookieJarFile>(path)
        cookies = [...(file.cookies || [])]
        pruneExpired()
      } catch {
        cookies = []
      }
    },

    getAll(): Cookie[] {
      pruneExpired()
      return [...cookies]
    },

    getCookiesForUrl(url: string): Cookie[] {
      pruneExpired()
      const domain = parseDomain(url)
      const path = parsePath(url)
      const secure = isSecureUrl(url)

      return cookies.filter(c => {
        if (!domainMatches(c.domain, domain)) return false
        if (!pathMatches(c.path, path)) return false
        if (c.secure && !secure) return false
        return true
      })
    },

    buildCookieHeader(url: string): string {
      const matching = this.getCookiesForUrl(url)
      if (matching.length === 0) return ''
      return matching.map(c => `${c.name}=${c.value}`).join('; ')
    },

    async captureFromResponse(responseHeaders: Record<string, string>, requestUrl: string): Promise<void> {
      // Look for set-cookie headers (case-insensitive)
      const setCookieValues: string[] = []

      for (const [key, value] of Object.entries(responseHeaders)) {
        if (key.toLowerCase() === 'set-cookie') {
          // Multiple cookies may be comma-separated (though not recommended)
          // More commonly, Tauri/reqwest might join them with comma
          // Split carefully — commas inside Expires dates are tricky
          // Safest: split on comma followed by a cookie-name= pattern
          const parts = splitSetCookieHeader(value)
          setCookieValues.push(...parts)
        }
      }

      if (setCookieValues.length === 0) return

      for (const cookieStr of setCookieValues) {
        const cookie = parseSetCookie(cookieStr, requestUrl)
        if (cookie) {
          // If value is empty or max-age=0, remove the cookie
          if (cookie.value === '' || (cookie.expires && new Date(cookie.expires).getTime() <= Date.now())) {
            cookies = cookies.filter(
              c => !(c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path)
            )
          } else {
            upsertCookie(cookie)
          }
        }
      }

      await persist()
    },

    async remove(name: string, domain: string): Promise<void> {
      cookies = cookies.filter(c => !(c.name === name && c.domain === domain))
      await persist()
    },

    async removeForDomain(domain: string): Promise<void> {
      cookies = cookies.filter(c => c.domain !== domain)
      await persist()
    },

    async clearAll(): Promise<void> {
      cookies = []
      await persist()
    },
  }
}

/**
 * Split a combined Set-Cookie header string into individual cookie strings.
 * Handles the tricky case where commas appear in Expires date values.
 */
function splitSetCookieHeader(header: string): string[] {
  const cookies: string[] = []
  let current = ''
  let i = 0

  while (i < header.length) {
    // Check if we're at a comma that separates cookies (not inside expires)
    if (header[i] === ',') {
      // Look ahead to see if what follows looks like a new cookie (name=)
      const rest = header.slice(i + 1).trimStart()
      // A new cookie starts with a token followed by =
      if (/^[a-zA-Z0-9_\-]+\s*=/.test(rest)) {
        cookies.push(current.trim())
        current = ''
        i++
        continue
      }
    }
    current += header[i]
    i++
  }

  if (current.trim()) {
    cookies.push(current.trim())
  }

  return cookies
}
