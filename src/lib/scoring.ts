import type { RoundCandidate, RoundResult } from '@/types/game'

/**
 * Score a player's ranking using exact position matching.
 * Each candidate in the exact correct position earns 1 token.
 * Candidates in wrong positions will be removed from the graph.
 */
export function scoreRanking(
  playerRanking: string[],
  candidates: RoundCandidate[]
): RoundResult {
  // Build ideal ranking (sorted by similarity, descending)
  const idealRanking = [...candidates].sort((a, b) => b.similarity - a.similarity)

  // Check each position for an exact match
  const correctWords: string[] = []
  for (let i = 0; i < playerRanking.length; i++) {
    if (i < idealRanking.length && playerRanking[i] === idealRanking[i].word) {
      correctWords.push(playerRanking[i])
    }
  }

  const totalPositions = candidates.length
  const accuracy = totalPositions > 0
    ? Math.round((correctWords.length / totalPositions) * 100)
    : 0

  return {
    accuracy,
    tokenDelta: correctWords.length,
    correctWords,
    playerRanking,
    idealRanking: idealRanking.map((c) => ({ word: c.word, similarity: c.similarity })),
  }
}
