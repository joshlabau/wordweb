/**
 * SplitMix32 seeded PRNG.
 * Returns a function that produces deterministic floats in [0, 1).
 */
export function createRng(seed: number): () => number {
  let state = seed | 0
  return function () {
    state = (state + 0x9e3779b9) | 0
    let t = state ^ (state >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    t = t ^ (t >>> 15)
    return (t >>> 0) / 4294967296
  }
}

/** djb2 string hash → 32-bit integer */
export function hashString(s: string): number {
  let hash = 5381
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0
  }
  return hash
}

/** Date-based seed for daily puzzles */
export function getDailySeed(): number {
  const today = new Date()
  const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
  return hashString(dateString)
}

/** Fisher-Yates shuffle using the provided RNG */
export function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
