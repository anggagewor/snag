import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('vitest runs correctly', () => {
    expect(true).toBe(true)
  })

  it('path alias resolves @/ to src/', async () => {
    const domain = await import('@/domain/index')
    expect(domain).toBeDefined()
  })
})
