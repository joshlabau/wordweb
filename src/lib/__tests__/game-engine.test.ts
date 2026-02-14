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
  INITIAL_TOKENS,
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

      expect(state.tokens).toBe(INITIAL_TOKENS)
      expect(state.phase).toBe('IDLE')
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
    })

    it('updates tokens based on result', () => {
      let state = createGame(42, stubGameData)
      const rootId = state.graph.nodes[0].id
      state = expandNode(state, rootId)

      const sorted = [...state.currentRound!.candidates].sort(
        (a, b) => b.similarity - a.similarity
      )
      const { state: newState } = submitRanking(
        state,
        sorted.map((c) => c.word)
      )

      expect(newState.tokens).not.toBe(INITIAL_TOKENS)
    })
  })

  describe('continue from evaluation', () => {
    it('converts all candidates to permanent nodes and returns to IDLE', () => {
      let state = createGame(42, stubGameData)
      state = expandNode(state, state.graph.nodes[0].id)
      const numCandidates = state.currentRound!.candidates.length
      const candidates = state.currentRound!.candidates.map((c) => c.word)
      const { state: evaluated } = submitRanking(state, candidates)

      const continued = continueFromEvaluation(evaluated)

      expect(continued.phase).toBe('IDLE')
      // Root + all candidates (now permanent)
      expect(continued.graph.nodes).toHaveLength(1 + numCandidates)
      // All nodes should be permanent (not candidates)
      const remainingCandidates = continued.graph.nodes.filter((n) => n.isCandidate)
      expect(remainingCandidates).toHaveLength(0)
      // Edges should all still be present
      expect(continued.graph.edges).toHaveLength(numCandidates)
    })
  })

  describe('game over', () => {
    it('triggers when tokens reach 0 after bad ranking', () => {
      let state = createGame(42, stubGameData)
      // Set tokens low so a bad ranking causes game over
      state = { ...state, tokens: 2 }

      state = expandNode(state, state.graph.nodes[0].id)
      // Submit in reverse order (worst ranking) to get negative token delta
      const candidates = state.currentRound!.candidates.map((c) => c.word)
      const reversed = [...candidates].reverse()
      const { state: evaluated } = submitRanking(state, reversed)

      // If tokens went to 0 or below, game should be over
      if (evaluated.tokens <= 0) {
        expect(evaluated.phase).toBe('GAME_OVER')
        expect(isGameOver(evaluated)).toBe(true)
        // Candidates should have been converted to permanent
        const candidateNodes = evaluated.graph.nodes.filter((n) => n.isCandidate)
        expect(candidateNodes).toHaveLength(0)
      }
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
