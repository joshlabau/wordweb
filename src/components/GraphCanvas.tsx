import { useRef, useEffect, useState } from 'react'
import type { GraphNode, GraphEdge } from '@/types/game'
import { useForceGraph } from '@/hooks/useForceGraph'

interface GraphCanvasProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick: (nodeId: string, word: string, isCandidate: boolean) => void
  centerOnNodeId?: string | null
}

export function GraphCanvas({ nodes, edges, onNodeClick, centerOnNodeId }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const { centerOnNode } = useForceGraph(svgRef, nodes, edges, {
    width: dimensions.width,
    height: dimensions.height,
    onNodeClick,
  })

  useEffect(() => {
    if (centerOnNodeId) {
      centerOnNode(centerOnNodeId)
    }
  }, [centerOnNodeId, centerOnNode])

  return (
    <div ref={containerRef} className="graph-canvas">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="graph-canvas__svg"
      />
    </div>
  )
}
