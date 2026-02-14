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
              <strong>Earn</strong>
              <p>
                Score tokens based on how close your ranking is to the ideal.
                Good rankings earn tokens; bad ones cost you.
              </p>
            </div>
          </div>

          <div className="how-to-play__step">
            <span className="how-to-play__step-num">4</span>
            <div>
              <strong>Unlock</strong>
              <p>
                Spend tokens to add a word to your graph. Each unlock costs 3
                tokens.
              </p>
            </div>
          </div>

          <div className="how-to-play__step">
            <span className="how-to-play__step-num">5</span>
            <div>
              <strong>Grow</strong>
              <p>
                Keep expanding and unlocking to grow your graph. The game ends
                when you run out of tokens!
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
