/**
 * CookieJarService — per-workspace cookie management.
 *
 * Stores cookies from Set-Cookie response headers.
 * Provides matching cookies for outgoing requests based on domain/path.
 *
 * Depends on: domain/, storage/
 * Does NOT depend on: stores/, UI, Vue, Pinia
 */

import type { Cookie } from '../domain'

export interface CookieJarService {
  /** Load cookies from workspace storage. Call after workspace open. */
  load(): Promise<void>

  /** Get all stored cookies. */
  getAll(): Cookie[]

  /** Get cookies matching the given URL (domain + path matching). */
  getCookiesForUrl(url: string): Cookie[]

  /** Build a Cookie header value for the given URL. */
  buildCookieHeader(url: string): string

  /** Parse Set-Cookie headers from a response and store them. */
  captureFromResponse(responseHeaders: Record<string, string>, requestUrl: string): Promise<void>

  /** Remove a specific cookie by name + domain. */
  remove(name: string, domain: string): Promise<void>

  /** Remove all cookies for a domain. */
  removeForDomain(domain: string): Promise<void>

  /** Clear all cookies. */
  clearAll(): Promise<void>
}
