/**
 * Cookie domain model.
 *
 * Represents a single HTTP cookie.
 * Stored per-workspace in cookies.json.
 */

export interface Cookie {
  readonly name: string
  readonly value: string
  readonly domain: string
  readonly path: string
  readonly expires?: string
  readonly httpOnly: boolean
  readonly secure: boolean
  readonly sameSite?: 'Strict' | 'Lax' | 'None'
  readonly createdAt: string
}
