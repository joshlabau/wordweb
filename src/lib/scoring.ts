import type { RoundCandidate, RoundResult } from '@/types/game'

/**
 * Score a player's ranking using exact position matching.
 * Candidates in correct positions stay in the graph; wrong ones are removed.
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
    correctWords,
    playerRanking,
    idealRanking: idealRanking.map((c) => ({ word: c.word, similarity: c.similarity })),
  }
}
