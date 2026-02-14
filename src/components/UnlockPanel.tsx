import { UNLOCK_COST } from '@/lib/game-engine'
import type { RoundCandidate } from '@/types/game'

interface UnlockPanelProps {
  candidates: RoundCandidate[]
  tokens: number
  onUnlock: (word: string) => void
  onSkip: () => void
}

export function UnlockPanel({ candidates, tokens, onUnlock, onSkip }: UnlockPanelProps) {
  const canAfford = tokens >= UNLOCK_COST

  return (
    <div className="unlock-panel">
      <div className="unlock-panel__header">
        <p className="unlock-panel__instruction">
          Choose a word to unlock and add to your graph
        </p>
        <p className="unlock-panel__cost">
          Cost: {UNLOCK_COST} tokens (you have {tokens})
        </p>
      </div>

      <div className="unlock-panel__candidates">
        {candidates.map(({ word }) => (
          <button
            key={word}
            className="candidate-bubble candidate-bubble--unlock"
            onClick={() => onUnlock(word)}
            disabled={!canAfford}
          >
            <span className="candidate-bubble__word">{word}</span>
          </button>
        ))}
      </div>

      <div className="unlock-panel__actions">
        <button className="btn btn-ghost" onClick={onSkip}>
          Skip (save tokens)
        </button>
      </div>
    </div>
  )
}
