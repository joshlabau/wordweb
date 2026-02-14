import type { GameData, ParentEntry, RoundCandidate } from '@/types/game'

let cachedData: GameData | null = null

export async function loadGameData(): Promise<GameData> {
  if (cachedData) return cachedData
  const response = await fetch('/game-data.json')
  cachedData = (await response.json()) as GameData
  return cachedData
}

/** Resolve a parent entry into actual words */
export function resolveParent(
  data: GameData,
  parent: ParentEntry
): { word: string; candidates: RoundCandidate[] } {
  return {
    word: data.vocabulary[parent.word],
    candidates: parent.candidates.map((c) => ({
      word: data.vocabulary[c.word],
      similarity: c.similarity,
    })),
  }
}

/**
 * Sample `count` candidates from a parent entry.
 * If there are more candidates than needed, picks randomly.
 */
export function sampleCandidates(
  candidates: RoundCandidate[],
  count: number,
  rng: () => number
): RoundCandidate[] {
  if (candidates.length <= count) return [...candidates]

  // Shuffle and take first `count`
  const shuffled = [...candidates]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}
