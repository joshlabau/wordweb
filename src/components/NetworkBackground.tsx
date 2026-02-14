import { useRef } from 'react'
import { useNetworkBackground } from '@/hooks/useNetworkBackground'

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useNetworkBackground(canvasRef)

  return (
    <canvas
      ref={canvasRef}
      className="network-background"
      aria-hidden="true"
    />
  )
}
