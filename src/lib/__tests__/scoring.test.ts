import { describe, it, expect } from 'vitest'
import { scoreRanking } from '../scoring'
import type { RoundCandidate } from '@/types/game'

const candidates: RoundCandidate[] = [
  { word: 'sea', similarity: 0.92 },
  { word: 'water', similarity: 0.85 },
  { word: 'lake', similarity: 0.72 },
  { word: 'shore', similarity: 0.45 },
  { word: 'ridge', similarity: 0.12 },
]

// Ideal order: sea, water, lake, shore, ridge

describe('scoreRanking', () => {
  it('gives 100% accuracy for perfect ranking', () => {
    const result = scoreRanking(
      ['sea', 'water', 'lake', 'shore', 'ridge'],
      candidates
    )
    expect(result.accuracy).toBe(100)
    expect(result.correctWords).toHaveLength(5)
    expect(result.correctWords).toEqual(['sea', 'water', 'lake', 'shore', 'ridge'])
  })

  it('gives 1 correct for reversed ranking (middle element stays)', () => {
    // Reversed: ridge, shore, lake, water, sea
    // Only position 2 (lake) matches ideal position 2
    const result = scoreRanking(
      ['ridge', 'shore', 'lake', 'water', 'sea'],
      candidates
    )
    expect(result.accuracy).toBe(20)
    expect(result.correctWords).toHaveLength(1)
    expect(result.correctWords).toEqual(['lake'])
  })

  it('identifies exact position matches for partial correctness', () => {
    // Player: sea, lake, water, shore, ridge
    // Ideal:  sea, water, lake, shore, ridge
    // Match at positions 0 (sea), 3 (shore), 4 (ridge)
    const result = scoreRanking(
      ['sea', 'lake', 'water', 'shore', 'ridge'],
      candidates
    )
    expect(result.accuracy).toBe(60)
    expect(result.correctWords).toHaveLength(3)
    expect(result.correctWords).toEqual(['sea', 'shore', 'ridge'])
  })

  it('gives 0% for completely wrong positions', () => {
    // Player: water, sea, shore, ridge, lake
    // Ideal:  sea,   water, lake, shore, ridge
    // No position matches
    const result = scoreRanking(
      ['water', 'sea', 'shore', 'ridge', 'lake'],
      candidates
    )
    expect(result.accuracy).toBe(0)
    expect(result.correctWords).toHaveLength(0)
    expect(result.correctWords).toEqual([])
  })

  it('includes ideal ranking sorted by similarity', () => {
    const result = scoreRanking(
      ['sea', 'water', 'lake', 'shore', 'ridge'],
      candidates
    )
    expect(result.idealRanking[0].word).toBe('sea')
    expect(result.idealRanking[0].similarity).toBe(0.92)
    expect(result.idealRanking[4].word).toBe('ridge')
    expect(result.idealRanking[4].similarity).toBe(0.12)
  })

  it('includes the player ranking in the result', () => {
    const ranking = ['ridge', 'lake', 'sea', 'water', 'shore']
    const result = scoreRanking(ranking, candidates)
    expect(result.playerRanking).toEqual(ranking)
  })

  it('handles two candidates with same similarity', () => {
    const tied: RoundCandidate[] = [
      { word: 'a', similarity: 0.80 },
      { word: 'b', similarity: 0.80 },
      { word: 'c', similarity: 0.50 },
    ]
    // Ideal sorted by similarity desc — ties break by original order
    // With exact matching, only the exact position matters
    const result = scoreRanking(['a', 'b', 'c'], tied)
    expect(result.correctWords).toContain('c')
    expect(result.correctWords.length).toBeGreaterThanOrEqual(1)
  })
})
