import type { RunSummary } from '@/types/game'

interface GameOverScreenProps {
  summary: RunSummary
  onPlayAgain: () => void
  onHome: () => void
}

export function GameOverScreen({ summary, onPlayAgain, onHome }: GameOverScreenProps) {
  return (
    <div className="game-over-screen">
      <div className="game-over-screen__card">
        <h2 className="game-over-screen__title">Game Over</h2>

        <div className="game-over-screen__stats">
          <div className="stat">
            <span className="stat__value">{summary.totalNodes}</span>
            <span className="stat__label">Nodes</span>
          </div>
          <div className="stat">
            <span className="stat__value">{summary.maxDepth}</span>
            <span className="stat__label">Max Depth</span>
          </div>
          <div className="stat">
            <span className="stat__value">{summary.roundsPlayed}</span>
            <span className="stat__label">Rounds</span>
          </div>
          <div className="stat">
            <span className="stat__value">{summary.averageAccuracy}%</span>
            <span className="stat__label">Avg Accuracy</span>
          </div>
          <div className="stat">
            <span className="stat__value">{summary.bestRoundAccuracy}%</span>
            <span className="stat__label">Best Round</span>
          </div>
          <div className="stat stat--highlight">
            <span className="stat__value">{summary.score}</span>
            <span className="stat__label">Score</span>
          </div>
        </div>

        <div className="game-over-screen__actions">
          <button className="btn btn-primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="btn btn-ghost" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  )
}
