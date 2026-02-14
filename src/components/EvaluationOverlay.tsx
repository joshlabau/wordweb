import { useState } from 'react'
import type { RoundResult } from '@/types/game'

interface EvaluationOverlayProps {
  result: RoundResult
  onContinue: () => void
}

export function EvaluationOverlay({ result, onContinue }: EvaluationOverlayProps) {
  const [showIdeal, setShowIdeal] = useState(false)

  const correctSet = new Set(result.correctWords)
  const total = result.idealRanking.length
  const correct = result.correctWords.length

  return (
    <div className="evaluation-overlay">
      <div className="evaluation-overlay__card">
        <div className={`evaluation-overlay__grade evaluation-overlay__grade--${correct > 0 ? 'positive' : 'negative'}`}>
          {correct}/{total} correct
        </div>

        {correct < total && (
          <div className="evaluation-overlay__stats">
            <div className="evaluation-overlay__removed">
              {total - correct} word{total - correct !== 1 ? 's' : ''} will disappear
            </div>
          </div>
        )}

        <button
          className="btn btn-ghost evaluation-overlay__reveal"
          onClick={() => setShowIdeal(!showIdeal)}
        >
          {showIdeal ? 'Hide' : 'See'} ideal ranking
        </button>

        {showIdeal && (
          <div className="evaluation-overlay__ideal">
            <div className="evaluation-overlay__ranking-compare">
              <div>
                <strong>Your ranking:</strong>
                <ol>
                  {result.playerRanking.map((word) => (
                    <li
                      key={word}
                      className={correctSet.has(word) ? 'ranking-correct' : 'ranking-wrong'}
                    >
                      {word} {correctSet.has(word) ? '\u2713' : '\u2717'}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <strong>Ideal ranking:</strong>
                <ol>
                  {result.idealRanking.map(({ word, similarity }) => (
                    <li key={word}>
                      {word}{' '}
                      <span className="similarity-score">({(similarity * 100).toFixed(0)}%)</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  )
}
