interface RankingPanelProps {
  parentWord: string
  candidates: string[]
  ranking: string[]
  onToggleRank: (word: string) => void
  onReset: () => void
  onSubmit: () => void
}

export function RankingPanel({
  parentWord,
  candidates,
  ranking,
  onToggleRank,
  onReset,
  onSubmit,
}: RankingPanelProps) {
  const canSubmit = ranking.length >= 2

  return (
    <div className="ranking-panel">
      <div className="ranking-panel__header">
        <p className="ranking-panel__instruction">
          Tap most similar to <strong>"{parentWord}"</strong> first
        </p>
      </div>

      <div className="ranking-panel__candidates">
        {candidates.map((word) => {
          const rankIndex = ranking.indexOf(word)
          const isRanked = rankIndex !== -1

          return (
            <button
              key={word}
              className={`candidate-bubble ${isRanked ? 'candidate-bubble--ranked' : ''}`}
              onClick={() => onToggleRank(word)}
            >
              {isRanked && <span className="candidate-bubble__rank">{rankIndex + 1}</span>}
              <span className="candidate-bubble__word">{word}</span>
            </button>
          )
        })}
      </div>

      <div className="ranking-panel__actions">
        <button
          className="btn btn-ghost"
          onClick={onReset}
          disabled={ranking.length === 0}
        >
          Reset
        </button>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          Submit{canSubmit ? ` (${ranking.length})` : ''}
        </button>
      </div>
    </div>
  )
}
