import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGame,
  expandNode,
  toggleCandidateRank,
  resetRanking,
  submitRanking,
  continueFromEvaluation,
  isGameOver,
  getRunSummary,
  resetNodeIds,
  TARGET_NODES,
} from '../game-engine'
import type { GameData, GameState } from '@/types/game'

const stubGameData: GameData = {
  version: 1,
  vocabulary: [
    'ocean', 'sea', 'water', 'lake', 'river',
    'wave', 'tide', 'shore', 'beach', 'island',
  ],
  parents: [
    {
      word: 0, // ocean
      candidates: [
        { word: 1, similarity: 0.92 },
        { word: 2, similarity: 0.85 },
        { word: 3, similarity: 0.72 },
        { word: 4, similarity: 0.68 },
        { word: 5, similarity: 0.65 },
        { word: 6, similarity: 0.58 },
        { word: 7, similarity: 0.45 },
        { word: 8, similarity: 0.42 },
        { word: 9, similarity: 0.35 },
      ],
    },
    // All candidate words must also be parents (so they're expandable)
    { word: 1, candidates: [{ word: 0, similarity: 0.92 }, { word: 2, similarity: 0.80 }, { word: 3, similarity: 0.60 }, { word: 4, similarity: 0.55 }] },
    { word: 2, candidates: [{ word: 0, similarity: 0.85 }, { word: 1, similarity: 0.80 }, { word: 3, similarity: 0.70 }, { word: 5, similarity: 0.50 }] },
    { word: 3, candidates: [{ word: 0, similarity: 0.72 }, { word: 4, similarity: 0.75 }, { word: 2, similarity: 0.70 }, { word: 6, similarity: 0.40 }] },
    { word: 4, candidates: [{ word: 0, similarity: 0.68 }, { word: 3, similarity: 0.75 }, { word: 1, similarity: 0.55 }, { word: 7, similarity: 0.35 }] },
    { word: 5, candidates: [{ word: 0, similarity: 0.65 }, { word: 6, similarity: 0.72 }, { word: 2, similarity: 0.50 }, { word: 8, similarity: 0.30 }] },
    { word: 6, candidates: [{ word: 5, similarity: 0.72 }, { word: 0, similarity: 0.58 }, { word: 7, similarity: 0.55 }, { word: 9, similarity: 0.25 }] },
    { word: 7, candidates: [{ word: 8, similarity: 0.78 }, { word: 0, similarity: 0.45 }, { word: 6, similarity: 0.55 }, { word: 9, similarity: 0.40 }] },
    { word: 8, candidates: [{ word: 7, similarity: 0.78 }, { word: 0, similarity: 0.42 }, { word: 9, similarity: 0.65 }, { word: 5, similarity: 0.30 }] },
    { word: 9, candidates: [{ word: 8, similarity: 0.65 }, { word: 7, similarity: 0.40 }, { word: 0, similarity: 0.35 }, { word: 6, similarity: 0.25 }] },
  ],
}

describe('game-engine', () => {
  beforeEach(() => {
    resetNodeIds()
  })

  describe('createGame', () => {
    it('creates initial game state with root node', () => {
      const state = createGame(42, stubGameData)

      expect(state.phase).toBe('IDLE')
      expect(state.won).toBe(false)
      expect(state.graph.nodes).toHaveLength(1)
      expect(state.graph.nodes[0].depth).toBe(0)
      expect(state.graph.nodes[0].expanded).toBe(false)
      expect(state.graph.edges).toHaveLength(0)
    })

    it('produces deterministic state from same seed', () => {
      resetNodeIds()
      const state1 = createGame(42, stubGameData)
      resetNodeIds()
      const state2 = createGame(42, stubGameData)

      expect(state1.graph.nodes[0].word).toBe(state2.graph.nodes[0].word)
    })
  })

  describe('expandNode', () => {
    let state: GameState

    beforeEach(() => {
      state = createGame(42, stubGameData)
    })

    it('transitions to RANKING phase', () => {
      const rootId = state.graph.nodes[0].id
      const newState = expandNode(state, rootId)

      expect(newState.phase).toBe('RANKING')
      expect(newState.currentRound).not.toBeNull()
      expect(newState.currentRound!.parentNodeId).toBe(rootId)
    })

    it('marks node as expanded', () => {
      const rootId = state.graph.nodes[0].id
      const newState = expandNode(state, rootId)

      const rootNode = newState.graph.nodes.find((n) => n.id === rootId)
      expect(rootNode!.expanded).toBe(true)
    })

    it('sprouts candidate nodes into the graph', () => {
      const rootId = state.graph.nodes[0].id
      const newState = expandNode(state, rootId)

      const candidateNodes = newState.graph.nodes.filter((n) => n.isCandidate)
      expect(candidateNodes.length).toBeGreaterThanOrEqual(2)
      expect(candidateNodes.length).toBe(newState.currentRound!.candidates.length)

      // Each candidate should have an edge from the root
      const candidateEdges = newState.graph.edges.filter(
        (e) => e.source === rootId
      )
      expect(candidateEdges).toHaveLength(candidateNodes.length)
    })

    it('does nothing for already expanded nodes', () => {
      const rootId = state.graph.nodes[0].id
      const expanded = expandNode(state, rootId)
      const result = expandNode(expanded, rootId)

      expect(result.phase).toBe('RANKING')
    })
  })

  describe('toggleCandidateRank', () => {
    it('adds and removes words from ranking', () => {
      let state = createGame(42, stubGameData)
      state = expandNode(state, state.graph.nodes[0].id)

      const word = state.currentRound!.candidates[0].word

      // Add
      state = toggleCandidateRank(state, word)
      expect(state.currentRound!.playerRanking).toContain(word)

      // The candidate node should have rank=1
      const candidateNode = state.graph.nodes.find(
        (n) => n.isCandidate && n.word === word
      )
      expect(candidateNode!.rank).toBe(1)

      // Remove
      state = toggleCandidateRank(state, word)
      expect(state.currentRound!.playerRanking).not.toContain(word)
    })
  })

  describe('resetRanking', () => {
    it('clears all rankings', () => {
      let state = createGame(42, stubGameData)
      state = expandNode(state, state.graph.nodes[0].id)

      const words = state.currentRound!.candidates.map((c) => c.word)
      state = toggleCandidateRank(state, words[0])
      state = toggleCandidateRank(state, words[1])
      expect(state.currentRound!.playerRanking).toHaveLength(2)

      state = resetRanking(state)
      expect(state.currentRound!.playerRanking).toHaveLength(0)

      // All candidate nodes should have rank cleared
      const rankedNodes = state.graph.nodes.filter((n) => n.rank != null)
      expect(rankedNodes).toHaveLength(0)
    })
  })

  describe('submitRanking', () => {
    it('evaluates ranking and transitions to EVALUATING', () => {
      let state = createGame(42, stubGameData)
      const rootId = state.graph.nodes[0].id
      state = expandNode(state, rootId)

      const candidates = state.currentRound!.candidates.map((c) => c.word)
      const { state: newState, result } = submitRanking(state, candidates)

      expect(newState.phase).toBe('EVALUATING')
      expect(result.accuracy).toBeGreaterThanOrEqual(0)
      expect(result.accuracy).toBeLessThanOrEqual(100)
      expect(newState.roundsPlayed).toBe(1)
      expect(result.correctWords).toBeDefined()
    })

    it('identifies all correct words for perfect ranking', () => {
      let state = createGame(42, stubGameData)
      const rootId = state.graph.nodes[0].id
      state = expandNode(state, rootId)

      // Submit perfect ranking (sorted by similarity descending)
      const sorted = [...state.currentRound!.candidates].sort(
        (a, b) => b.similarity - a.similarity
      )
      const { result } = submitRanking(
        state,
        sorted.map((c) => c.word)
      )

      expect(result.correctWords).toHaveLength(sorted.length)
      expect(result.accuracy).toBe(100)
    })
  })

  describe('continue from evaluation', () => {
    it('keeps only correctly-ranked candidates as permanent nodes', () => {
      let state = createGame(42, stubGameData)
      state = expandNode(state, state.graph.nodes[0].id)
      const numCandidates = state.currentRound!.candidates.length

      // Submit perfect ranking so all candidates are kept
      const sorted = [...state.currentRound!.candidates].sort(
        (a, b) => b.similarity - a.similarity
      )
      const { state: evaluated } = submitRanking(state, sorted.map((c) => c.word))

      const continued = continueFromEvaluation(evaluated)

      expect(continued.phase).toBe('IDLE')
      // Root + all candidates (all correct)
      expect(continued.graph.nodes).toHaveLength(1 + numCandidates)
      // All nodes should be permanent (not candidates)
      const remainingCandidates = continued.graph.nodes.filter((n) => n.isCandidate)
      expect(remainingCandidates).toHaveLength(0)
      // Edges should all still be present
      expect(continued.graph.edges).toHaveLength(numCandidates)
    })

    it('removes incorrectly-ranked candidates from the graph', () => {
      let state = createGame(42, stubGameData)
      state = expandNode(state, state.graph.nodes[0].id)

      // Submit reversed ranking — some candidates will be wrong
      const sorted = [...state.currentRound!.candidates].sort(
        (a, b) => b.similarity - a.similarity
      )
      const reversed = [...sorted].reverse().map((c) => c.word)
      const { state: evaluated, result } = submitRanking(state, reversed)

      const numCorrect = result.correctWords.length
      const continued = continueFromEvaluation(evaluated)

      // Root + only correctly-ranked candidates
      expect(continued.graph.nodes).toHaveLength(1 + numCorrect)
      // Edges should match kept nodes
      expect(continued.graph.edges).toHaveLength(numCorrect)
      // No candidate nodes should remain
      const remainingCandidates = continued.graph.nodes.filter((n) => n.isCandidate)
      expect(remainingCandidates).toHaveLength(0)

      // If no unexpanded nodes left, it's game over; otherwise IDLE
      const hasUnexpanded = continued.graph.nodes.some((n) => !n.expanded)
      if (hasUnexpanded) {
        expect(continued.phase).toBe('IDLE')
      } else {
        expect(continued.phase).toBe('GAME_OVER')
        expect(continued.won).toBe(false)
      }
    })
  })

  describe('game over detection', () => {
    it('loses when no unexpanded nodes remain', () => {
      let state = createGame(42, stubGameData)
      state = expandNode(state, state.graph.nodes[0].id)

      // Submit reversed ranking — all candidates likely wrong
      const sorted = [...state.currentRound!.candidates].sort(
        (a, b) => b.similarity - a.similarity
      )
      const reversed = [...sorted].reverse().map((c) => c.word)
      const { state: evaluated } = submitRanking(state, reversed)
      const continued = continueFromEvaluation(evaluated)

      // If no unexpanded nodes remain, game should be over
      const hasUnexpanded = continued.graph.nodes.some((n) => !n.expanded)
      if (!hasUnexpanded) {
        expect(continued.phase).toBe('GAME_OVER')
        expect(continued.won).toBe(false)
        expect(isGameOver(continued)).toBe(true)
      }
    })

    it('exports TARGET_NODES constant', () => {
      expect(TARGET_NODES).toBe(100)
    })
  })

  describe('getRunSummary', () => {
    it('computes correct summary (excludes candidate nodes)', () => {
      const state = createGame(42, stubGameData)
      const summary = getRunSummary(state)

      expect(summary.totalNodes).toBe(1)
      expect(summary.maxDepth).toBe(0)
      expect(summary.roundsPlayed).toBe(0)
      expect(summary.averageAccuracy).toBe(0)
    })
  })
})
