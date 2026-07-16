/**
 * ULID generator.
 *
 * Minimal implementation — no external dependencies.
 * Generates Universally Unique Lexicographically Sortable Identifiers.
 *
 * Format: 10 chars timestamp (48-bit ms) + 16 chars randomness (80-bit)
 * Total: 26 chars, Crockford Base32 encoded.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const ENCODING_LEN = ENCODING.length
const TIME_LEN = 10
const RANDOM_LEN = 16

let lastTime = 0
let lastRandom: number[] = []

function encodeTime(now: number, len: number): string {
  let str = ''
  for (let i = len; i > 0; i--) {
    const mod = now % ENCODING_LEN
    str = ENCODING[mod] + str
    now = Math.floor(now / ENCODING_LEN)
  }
  return str
}

function incrementRandom(random: number[]): number[] {
  const result = [...random]
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i] < ENCODING_LEN - 1) {
      result[i]++
      return result
    }
    result[i] = 0
  }
  return result
}

function randomToString(random: number[]): string {
  return random.map(i => ENCODING[i]).join('')
}

function generateRandom(len: number): number[] {
  const result: number[] = []
  for (let i = 0; i < len; i++) {
    result.push(Math.floor(Math.random() * ENCODING_LEN))
  }
  return result
}

/**
 * Generate a new ULID.
 *
 * Monotonic — if called multiple times within same millisecond,
 * increments the random component to maintain sort order.
 */
export function ulid(): string {
  const now = Date.now()

  if (now === lastTime) {
    lastRandom = incrementRandom(lastRandom)
    return encodeTime(now, TIME_LEN) + randomToString(lastRandom)
  }

  lastTime = now
  lastRandom = generateRandom(RANDOM_LEN)
  return encodeTime(now, TIME_LEN) + randomToString(lastRandom)
}

/**
 * Extract timestamp from ULID.
 * Returns milliseconds since Unix epoch.
 */
export function ulidTimestamp(id: string): number {
  const timeStr = id.substring(0, TIME_LEN)
  let time = 0
  for (let i = 0; i < timeStr.length; i++) {
    const charIndex = ENCODING.indexOf(timeStr[i])
    if (charIndex === -1) {
      throw new Error(`Invalid ULID character: ${timeStr[i]}`)
    }
    time = time * ENCODING_LEN + charIndex
  }
  return time
}
