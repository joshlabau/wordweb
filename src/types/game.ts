// Static game data loaded from game-data.json
export interface GameData {
  version: number
  vocabulary: string[]
  parents: ParentEntry[]
}

export interface ParentEntry {
  word: number // index into vocabulary
  candidates: CandidateEntry[]
}

export interface CandidateEntry {
  word: number // index into vocabulary
  similarity: number // 0.0 to 1.0
}

// Graph representation
export interface GraphNode {
  id: string // unique node ID
  word: string
  depth: number // distance from root
  parentId: string | null
  expanded: boolean // has been clicked to generate candidates
  isCandidate?: boolean // true for sprouted candidate nodes (not yet unlocked)
  rank?: number // 1-based rank assigned during ranking phase
  x?: number
  y?: number
}

export interface GraphEdge {
  source: string // node ID
  target: string // node ID
}

// Game phases
export type GamePhase =
  | 'IDLE' // waiting for player to click a node
  | 'RANKING' // player is ranking candidates
  | 'EVALUATING' // showing round result
  | 'GAME_OVER'

// Round state (active expansion + ranking)
export interface RoundState {
  parentNodeId: string
  parentWord: string
  candidates: RoundCandidate[]
  playerRanking: string[] // words in player-chosen order
}

export interface RoundCandidate {
  word: string
  similarity: number // hidden from player during ranking
}

// Round result after evaluation
export interface RoundResult {
  accuracy: number // 0-100 (percentage of exact position matches)
  correctWords: string[] // words the player ranked in the exact correct position
  playerRanking: string[]
  idealRanking: { word: string; similarity: number }[]
}

// Full game state
export interface GameState {
  seed: number
  phase: GamePhase
  won: boolean // true if player reached target node count
  roundsPlayed: number
  totalAccuracy: number // sum of all round accuracies (for averaging)
  bestRoundAccuracy: number
  graph: {
    nodes: GraphNode[]
    edges: GraphEdge[]
  }
  currentRound: RoundState | null
  lastResult: RoundResult | null
  gameData: GameData
  rngState: number // current PRNG state for determinism
}

// End-of-run summary
export interface RunSummary {
  won: boolean
  totalNodes: number
  maxDepth: number
  roundsPlayed: number
  averageAccuracy: number
  bestRoundAccuracy: number
}

// App-level screen state
export type AppScreen = 'HOME' | 'PLAYING' | 'GAME_OVER' | 'HOW_TO_PLAY'
