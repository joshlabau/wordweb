import type {
  GameData,
  GameState,
  GraphNode,
  RoundResult,
  RunSummary,
} from '@/types/game'
import { createRng, shuffle } from './prng'
import { resolveParent, sampleCandidates } from './game-data'
import { scoreRanking } from './scoring'

const INITIAL_TOKENS = 10
const CANDIDATES_PER_ROUND = 5

let nextNodeId = 0
function genNodeId(): string {
  return `node-${nextNodeId++}`
}

/** Reset the ID counter (for testing) */
export function resetNodeIds(): void {
  nextNodeId = 0
}

/** Create a new game run */
export function createGame(seed: number, gameData: GameData): GameState {
  resetNodeIds()
  const rng = createRng(seed)

  // Pick a root word
  const parentIndex = Math.floor(rng() * gameData.parents.length)
  const parent = gameData.parents[parentIndex]
  const rootWord = gameData.vocabulary[parent.word]

  const rootNode: GraphNode = {
    id: genNodeId(),
    word: rootWord,
    depth: 0,
    parentId: null,
    expanded: false,
  }

  return {
    seed,
    phase: 'IDLE',
    tokens: INITIAL_TOKENS,
    score: 0,
    roundsPlayed: 0,
    totalAccuracy: 0,
    bestRoundAccuracy: 0,
    graph: {
      nodes: [rootNode],
      edges: [],
    },
    currentRound: null,
    lastResult: null,
    gameData,
    rngState: seed,
  }
}

/** Expand a node: generate candidates and sprout them as graph nodes */
export function expandNode(state: GameState, nodeId: string): GameState {
  const node = state.graph.nodes.find((n) => n.id === nodeId)
  if (!node || node.expanded) return state

  // Find a parent entry whose word matches this node's word
  const parentEntry = state.gameData.parents.find(
    (p) => state.gameData.vocabulary[p.word] === node.word
  )

  if (!parentEntry) return state

  // Advance RNG state deterministically based on rounds played
  const rng = createRng(state.seed + state.roundsPlayed * 7919)
  const resolved = resolveParent(state.gameData, parentEntry)
  const candidates = sampleCandidates(resolved.candidates, CANDIDATES_PER_ROUND, rng)

  // Only keep candidates that are also parent words (so they can be expanded later)
  const parentWords = new Set(
    state.gameData.parents.map((p) => state.gameData.vocabulary[p.word])
  )

  // Filter out words already permanently in the graph
  const existingWords = new Set(
    state.graph.nodes.filter((n) => !n.isCandidate).map((n) => n.word)
  )
  const filteredCandidates = candidates.filter(
    (c) => parentWords.has(c.word) && !existingWords.has(c.word)
  )

  if (filteredCandidates.length < 2) return state

  const shuffled = shuffle(filteredCandidates, rng)

  // Mark parent node as expanded
  const updatedNodes = state.graph.nodes.map((n) =>
    n.id === nodeId ? { ...n, expanded: true } : n
  )

  // Sprout candidate nodes connected to the parent
  const candidateNodes: GraphNode[] = shuffled.map((c) => ({
    id: genNodeId(),
    word: c.word,
    depth: node.depth + 1,
    parentId: node.id,
    expanded: false,
    isCandidate: true,
  }))

  const candidateEdges = candidateNodes.map((cn) => ({
    source: node.id,
    target: cn.id,
  }))

  return {
    ...state,
    phase: 'RANKING',
    graph: {
      nodes: [...updatedNodes, ...candidateNodes],
      edges: [...state.graph.edges, ...candidateEdges],
    },
    currentRound: {
      parentNodeId: nodeId,
      parentWord: node.word,
      candidates: shuffled,
      playerRanking: [],
    },
  }
}

/** Toggle a candidate's rank by clicking it in the graph */
export function toggleCandidateRank(state: GameState, word: string): GameState {
  if (state.phase !== 'RANKING' || !state.currentRound) return state

  const currentRanking = state.currentRound.playerRanking
  const idx = currentRanking.indexOf(word)

  let newRanking: string[]
  if (idx !== -1) {
    newRanking = currentRanking.filter((w) => w !== word)
  } else {
    newRanking = [...currentRanking, word]
  }

  // Update rank on candidate graph nodes
  const updatedNodes = state.graph.nodes.map((n) => {
    if (!n.isCandidate) return n
    const rankIdx = newRanking.indexOf(n.word)
    return { ...n, rank: rankIdx !== -1 ? rankIdx + 1 : undefined }
  })

  return {
    ...state,
    graph: { ...state.graph, nodes: updatedNodes },
    currentRound: {
      ...state.currentRound,
      playerRanking: newRanking,
    },
  }
}

/** Reset all rankings */
export function resetRanking(state: GameState): GameState {
  if (state.phase !== 'RANKING' || !state.currentRound) return state

  const updatedNodes = state.graph.nodes.map((n) =>
    n.isCandidate ? { ...n, rank: undefined } : n
  )

  return {
    ...state,
    graph: { ...state.graph, nodes: updatedNodes },
    currentRound: {
      ...state.currentRound,
      playerRanking: [],
    },
  }
}

/** Submit the player's ranking for evaluation */
export function submitRanking(
  state: GameState,
  playerRanking: string[]
): { state: GameState; result: RoundResult } {
  if (!state.currentRound || state.phase !== 'RANKING') {
    throw new Error('Cannot submit ranking outside of RANKING phase')
  }

  const result = scoreRanking(playerRanking, state.currentRound.candidates)

  return {
    state: {
      ...state,
      phase: 'EVALUATING',
      tokens: state.tokens + result.tokenDelta,
      score: state.score + result.correctWords.length,
      roundsPlayed: state.roundsPlayed + 1,
      totalAccuracy: state.totalAccuracy + result.accuracy,
      bestRoundAccuracy: Math.max(state.bestRoundAccuracy, result.accuracy),
      currentRound: {
        ...state.currentRound,
        playerRanking,
      },
      lastResult: result,
    },
    result,
  }
}

/** Continue from evaluation — keep correctly-ranked candidates, remove wrong ones */
export function continueFromEvaluation(state: GameState): GameState {
  if (state.phase !== 'EVALUATING') return state

  const correctWords = new Set(state.lastResult?.correctWords ?? [])

  // Correctly ranked candidates become permanent; wrong ones are removed
  const keptNodes = state.graph.nodes.filter((n) => {
    if (!n.isCandidate) return true
    return correctWords.has(n.word)
  })

  const updatedNodes = keptNodes.map((n) =>
    n.isCandidate ? { ...n, isCandidate: false, rank: undefined } : n
  )

  // Remove edges pointing to removed nodes
  const keptIds = new Set(updatedNodes.map((n) => n.id))
  const updatedEdges = state.graph.edges.filter(
    (e) => keptIds.has(e.source) && keptIds.has(e.target)
  )

  return {
    ...state,
    phase: 'IDLE',
    graph: { nodes: updatedNodes, edges: updatedEdges },
    currentRound: null,
    lastResult: null,
  }
}

/** Check if the game is over */
export function isGameOver(state: GameState): boolean {
  return state.phase === 'GAME_OVER'
}

/** Compute end-of-run summary */
export function getRunSummary(state: GameState): RunSummary {
  const permanentNodes = state.graph.nodes.filter((n) => !n.isCandidate)
  const maxDepth = Math.max(...permanentNodes.map((n) => n.depth), 0)
  return {
    totalNodes: permanentNodes.length,
    maxDepth,
    roundsPlayed: state.roundsPlayed,
    averageAccuracy:
      state.roundsPlayed > 0
        ? Math.round(state.totalAccuracy / state.roundsPlayed)
        : 0,
    bestRoundAccuracy: state.bestRoundAccuracy,
    score: state.score,
  }
}

export { INITIAL_TOKENS, CANDIDATES_PER_ROUND }
