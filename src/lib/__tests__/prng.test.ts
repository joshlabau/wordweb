import { describe, it, expect } from 'vitest'
import { createRng, hashString, shuffle } from '../prng'

describe('createRng', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(42)

    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())

    expect(seq1).toEqual(seq2)
  })

  it('produces different output for different seeds', () => {
    const rng1 = createRng(42)
    const rng2 = createRng(99)

    const val1 = rng1()
    const val2 = rng2()

    expect(val1).not.toEqual(val2)
  })

  it('produces values in [0, 1)', () => {
    const rng = createRng(12345)
    for (let i = 0; i < 1000; i++) {
      const val = rng()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })
})

describe('hashString', () => {
  it('returns consistent hash for same input', () => {
    expect(hashString('hello')).toBe(hashString('hello'))
  })

  it('returns different hash for different inputs', () => {
    expect(hashString('hello')).not.toBe(hashString('world'))
  })
})

describe('shuffle', () => {
  it('returns all original elements', () => {
    const rng = createRng(42)
    const items = [1, 2, 3, 4, 5]
    const result = shuffle(items, rng)

    expect(result).toHaveLength(5)
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate the original array', () => {
    const rng = createRng(42)
    const items = [1, 2, 3, 4, 5]
    shuffle(items, rng)

    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('produces deterministic results with same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const result1 = shuffle(items, createRng(42))
    const result2 = shuffle(items, createRng(42))

    expect(result1).toEqual(result2)
  })
})
