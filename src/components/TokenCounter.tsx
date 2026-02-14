import { useEffect, useState } from 'react'

interface TokenCounterProps {
  tokens: number
  delta?: number | null
}

export function TokenCounter({ tokens, delta }: TokenCounterProps) {
  const [showDelta, setShowDelta] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (delta != null && delta !== 0) {
      setShowDelta(true)
      setAnimating(true)
      const timer = setTimeout(() => {
        setShowDelta(false)
        setAnimating(false)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [delta])

  return (
    <div className={`token-counter ${animating ? 'token-counter--animating' : ''}`}>
      <span className="token-counter__icon">&#9670;</span>
      <span className="token-counter__value">{tokens}</span>
      {showDelta && delta != null && (
        <span
          className={`token-counter__delta ${
            delta > 0 ? 'token-counter__delta--positive' : 'token-counter__delta--negative'
          }`}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </div>
  )
}
