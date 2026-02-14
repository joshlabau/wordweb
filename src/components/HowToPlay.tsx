interface HowToPlayProps {
  onClose: () => void
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="how-to-play">
      <div className="how-to-play__card">
        <h2>How to Play</h2>

        <div className="how-to-play__steps">
          <div className="how-to-play__step">
            <span className="how-to-play__step-num">1</span>
            <div>
              <strong>Expand</strong>
              <p>Click a word node to reveal connected words.</p>
            </div>
          </div>

          <div className="how-to-play__step">
            <span className="how-to-play__step-num">2</span>
            <div>
              <strong>Rank</strong>
              <p>
                Tap words in order from most similar to least similar to the
                parent word.
              </p>
            </div>
          </div>

          <div className="how-to-play__step">
            <span className="how-to-play__step-num">3</span>
            <div>
              <strong>Keep or Lose</strong>
              <p>
                Words you rank in the exact correct position stay in your graph.
                Wrong ones disappear.
              </p>
            </div>
          </div>

          <div className="how-to-play__step">
            <span className="how-to-play__step-num">4</span>
            <div>
              <strong>Grow to 100</strong>
              <p>
                Keep expanding nodes to grow your graph. Reach 100 nodes to win!
                If you run out of expandable nodes, the game is over.
              </p>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  )
}
