import { useState, useEffect, useCallback } from 'react'
import type { AppScreen, GameData } from '@/types/game'
import { loadGameData } from '@/lib/game-data'
import { getRunSummary } from '@/lib/game-engine'
import { useGameState } from '@/hooks/useGameState'
import { HomeScreen } from '@/components/HomeScreen'
import { GameScreen } from '@/components/GameScreen'
import { GameOverScreen } from '@/components/GameOverScreen'
import { HowToPlay } from '@/components/HowToPlay'
import './assets/styles.css'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('HOME')
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    gameState,
    lastResult,
    startGame,
    expandNode,
    toggleRank,
    resetRanking,
    submitRanking,
    continueFromEvaluation,
  } = useGameState()

  // Load game data on mount
  useEffect(() => {
    loadGameData()
      .then((data) => {
        setGameData(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load game data:', err)
        setLoading(false)
      })
  }, [])

  const handlePlay = useCallback(
    (seed: number) => {
      if (!gameData) return
      startGame(seed, gameData)
      setScreen('PLAYING')
    },
    [gameData, startGame]
  )

  // Watch for game over
  useEffect(() => {
    if (gameState?.phase === 'GAME_OVER') {
      setScreen('GAME_OVER')
    }
  }, [gameState?.phase])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!gameData) {
    return (
      <div className="loading-screen">
        <p>Failed to load game data. Please refresh.</p>
      </div>
    )
  }

  switch (screen) {
    case 'HOME':
      return (
        <HomeScreen
          onPlay={handlePlay}
          onHowToPlay={() => setScreen('HOW_TO_PLAY')}
        />
      )

    case 'HOW_TO_PLAY':
      return <HowToPlay onClose={() => setScreen('HOME')} />

    case 'PLAYING':
      if (!gameState) return null
      return (
        <GameScreen
          gameState={gameState}
          lastResult={lastResult}
          onExpandNode={expandNode}
          onToggleRank={toggleRank}
          onResetRanking={resetRanking}
          onSubmitRanking={submitRanking}
          onContinueFromEvaluation={continueFromEvaluation}
        />
      )

    case 'GAME_OVER':
      if (!gameState) return null
      return (
        <GameOverScreen
          summary={getRunSummary(gameState)}
          onPlayAgain={() => handlePlay(Math.floor(Math.random() * 2147483647))}
          onHome={() => setScreen('HOME')}
        />
      )
  }
}
