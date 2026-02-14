import { getDailySeed } from '@/lib/prng'

interface HomeScreenProps {
  onPlay: (seed: number) => void
  onHowToPlay: () => void
}

export function HomeScreen({ onPlay, onHowToPlay }: HomeScreenProps) {
  const handlePlay = () => {
    onPlay(Math.floor(Math.random() * 2147483647))
  }

  const handleDaily = () => {
    onPlay(getDailySeed())
  }

  return (
    <div className="home-screen">
      <div className="home-content">
        <h1 className="home-title">Word Web</h1>
        <p className="home-subtitle">
          Grow a graph of meaning. Rank words by similarity.
        </p>
        <div className="home-buttons">
          <button className="btn btn-primary" onClick={handlePlay}>
            Play
          </button>
          <button className="btn btn-secondary" onClick={handleDaily}>
            Daily Puzzle
          </button>
          <button className="btn btn-ghost" onClick={onHowToPlay}>
            How to Play
          </button>
        </div>
      </div>
    </div>
  )
}
