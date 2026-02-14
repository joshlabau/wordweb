import { useReducer, useCallback } from 'react'
import type { GameData, GameState, RoundResult } from '@/types/game'
import {
  createGame,
  expandNode,
  toggleCandidateRank,
  resetRanking,
  submitRanking,
  continueFromEvaluation,
} from '@/lib/game-engine'

type GameAction =
  | { type: 'START_GAME'; seed: number; gameData: GameData }
  | { type: 'EXPAND_NODE'; nodeId: string }
  | { type: 'TOGGLE_RANK'; word: string }
  | { type: 'RESET_RANKING' }
  | { type: 'SUBMIT_RANKING' }
  | { type: 'CONTINUE_FROM_EVALUATION' }

interface GameReducerState {
  gameState: GameState | null
  lastResult: RoundResult | null
}

function gameReducer(state: GameReducerState, action: GameAction): GameReducerState {
  switch (action.type) {
    case 'START_GAME':
      return {
        gameState: createGame(action.seed, action.gameData),
        lastResult: null,
      }

    case 'EXPAND_NODE':
      if (!state.gameState) return state
      return {
        ...state,
        gameState: expandNode(state.gameState, action.nodeId),
      }

    case 'TOGGLE_RANK':
      if (!state.gameState) return state
      return {
        ...state,
        gameState: toggleCandidateRank(state.gameState, action.word),
      }

    case 'RESET_RANKING':
      if (!state.gameState) return state
      return {
        ...state,
        gameState: resetRanking(state.gameState),
      }

    case 'SUBMIT_RANKING': {
      if (!state.gameState?.currentRound) return state
      const { state: newState, result } = submitRanking(
        state.gameState,
        state.gameState.currentRound.playerRanking
      )
      return {
        gameState: newState,
        lastResult: result,
      }
    }

    case 'CONTINUE_FROM_EVALUATION':
      if (!state.gameState) return state
      return {
        gameState: continueFromEvaluation(state.gameState),
        lastResult: null,
      }

    default:
      return state
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, {
    gameState: null,
    lastResult: null,
  })

  return {
    gameState: state.gameState,
    lastResult: state.lastResult,
    startGame: useCallback(
      (seed: number, gameData: GameData) =>
        dispatch({ type: 'START_GAME', seed, gameData }),
      []
    ),
    expandNode: useCallback(
      (nodeId: string) => dispatch({ type: 'EXPAND_NODE', nodeId }),
      []
    ),
    toggleRank: useCallback(
      (word: string) => dispatch({ type: 'TOGGLE_RANK', word }),
      []
    ),
    resetRanking: useCallback(() => dispatch({ type: 'RESET_RANKING' }), []),
    submitRanking: useCallback(() => dispatch({ type: 'SUBMIT_RANKING' }), []),
    continueFromEvaluation: useCallback(
      () => dispatch({ type: 'CONTINUE_FROM_EVALUATION' }),
      []
    ),
  }
}
