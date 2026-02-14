import { useCallback } from 'react'
import type { GameState, RoundResult } from '@/types/game'
import { TARGET_NODES } from '@/lib/game-engine'
import { GraphCanvas } from './GraphCanvas'
import { EvaluationOverlay } from './EvaluationOverlay'

interface GameScreenProps {
  gameState: GameState
  lastResult: RoundResult | null
  onExpandNode: (nodeId: string) => void
  onToggleRank: (word: string) => void
  onResetRanking: () => void
  onSubmitRanking: () => void
  onContinueFromEvaluation: () => void
}

export function GameScreen({
  gameState,
  lastResult,
  onExpandNode,
  onToggleRank,
  onResetRanking,
  onSubmitRanking,
  onContinueFromEvaluation,
}: GameScreenProps) {
  const handleNodeClick = useCallback(
    (_nodeId: string, word: string, isCandidate: boolean) => {
      if (gameState.phase === 'IDLE' && !isCandidate) {
        const node = gameState.graph.nodes.find(
          (n) => n.word === word && !n.expanded && !n.isCandidate
        )
        if (node) onExpandNode(node.id)
      } else if (gameState.phase === 'RANKING' && isCandidate) {
        onToggleRank(word)
      }
    },
    [gameState.phase, gameState.graph.nodes, onExpandNode, onToggleRank]
  )

  const rankingCount = gameState.currentRound?.playerRanking.length ?? 0
  const canSubmit = rankingCount >= 2
  const permanentNodes = gameState.graph.nodes.filter((n) => !n.isCandidate).length

  return (
    <div className="game-screen">
      <div className="game-screen__header">
        <div className="node-progress">
          <span className="node-progress__count">{permanentNodes}</span>
          <span className="node-progress__target">/{TARGET_NODES}</span>
          <span className="node-progress__label">nodes</span>
        </div>
        <div className="game-screen__info">
          Round {gameState.roundsPlayed + 1}
        </div>
      </div>

      <div className="game-screen__graph">
        <GraphCanvas
          nodes={gameState.graph.nodes}
          edges={gameState.graph.edges}
          onNodeClick={handleNodeClick}
          centerOnNodeId={gameState.currentRound?.parentNodeId}
        />
      </div>

      {gameState.phase === 'IDLE' && (
        <div className="game-screen__prompt">
          Click an unexpanded node to continue
        </div>
      )}

      {gameState.phase === 'RANKING' && gameState.currentRound && (
        <div className="game-screen__controls">
          <span className="game-screen__controls-hint">
            Click words most similar to <strong>"{gameState.currentRound.parentWord}"</strong> first
          </span>
          <div className="game-screen__controls-buttons">
            <button
              className="btn btn-ghost"
              onClick={onResetRanking}
              disabled={rankingCount === 0}
            >
              Reset
            </button>
            <button
              className="btn btn-primary"
              onClick={onSubmitRanking}
              disabled={!canSubmit}
            >
              Submit{canSubmit ? ` (${rankingCount})` : ''}
            </button>
          </div>
        </div>
      )}

      {gameState.phase === 'EVALUATING' && lastResult && (
        <EvaluationOverlay
          result={lastResult}
          onContinue={onContinueFromEvaluation}
        />
      )}
    </div>
  )
}
