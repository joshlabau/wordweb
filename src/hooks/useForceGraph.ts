import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '@/types/game'

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  word: string
  depth: number
  expanded: boolean
  isCandidate: boolean
  rank?: number
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
}

interface UseForceGraphOptions {
  width: number
  height: number
  onNodeClick: (nodeId: string, word: string, isCandidate: boolean) => void
}

/** Get the ID from a link endpoint (handles both string and object form) */
function linkNodeId(endpoint: string | SimNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

export function useForceGraph(
  svgRef: React.RefObject<SVGSVGElement | null>,
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: UseForceGraphOptions
) {
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  // Positions shared between simulation ticks and React renders
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const prevNodeIdsRef = useRef<string>('')
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const onNodeClickRef = useRef(options.onNodeClick)
  onNodeClickRef.current = options.onNodeClick

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    const { width, height } = options

    // --- Container setup ---
    let containerIsNew = false
    if (!containerRef.current) {
      svg.selectAll('g.graph-container').remove()
      containerRef.current = svg.append('g').attr('class', 'graph-container')
      containerIsNew = true

      zoomRef.current = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          containerRef.current?.attr('transform', event.transform)
        })
      svg.call(zoomRef.current as any)
    }
    const container = containerRef.current

    // Detect structural changes (new/removed nodes)
    const nodeIdStr = nodes.map((n) => n.id).join(',')
    const structureChanged = containerIsNew || nodeIdStr !== prevNodeIdsRef.current
    prevNodeIdsRef.current = nodeIdStr

    // --- Build sim data ---
    const simNodes: SimNode[] = nodes.map((n) => {
      const cached = positionsRef.current.get(n.id)
      if (cached) {
        return {
          id: n.id, word: n.word, depth: n.depth, expanded: n.expanded,
          isCandidate: !!n.isCandidate, rank: n.rank,
          x: cached.x, y: cached.y,
        }
      }
      // Place new nodes in a ring around their parent (or center if root)
      const parentPos = n.parentId ? positionsRef.current.get(n.parentId) : null
      const cx = parentPos?.x ?? width / 2
      const cy = parentPos?.y ?? height / 2
      const angle = Math.random() * Math.PI * 2
      const spread = 60 + nodes.length * 2
      return {
        id: n.id, word: n.word, depth: n.depth, expanded: n.expanded,
        isCandidate: !!n.isCandidate, rank: n.rank,
        x: cx + Math.cos(angle) * spread,
        y: cy + Math.sin(angle) * spread,
      }
    })

    const simLinks: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }))

    // --- Edge data join (always, for DOM lifecycle) ---
    container
      .selectAll<SVGLineElement, SimLink>('line.graph-edge')
      .data(simLinks, (d: SimLink) => `${linkNodeId(d.source)}-${linkNodeId(d.target)}`)
      .join(
        (enter) => enter.append('line'),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr('class', (d) => {
        const targetId = linkNodeId(d.target)
        const targetNode = simNodes.find((n) => n.id === targetId)
        return `graph-edge${targetNode?.isCandidate ? ' graph-edge--candidate' : ''}`
      })

    // --- Node data join (always, for DOM lifecycle) ---
    const nodeGroup = container
      .selectAll<SVGGElement, SimNode>('g.graph-node')
      .data(simNodes, (d: SimNode) => d.id)
      .join(
        (enter) => {
          const g = enter.append('g')
          g.append('circle').attr('class', 'graph-node__circle')
          g.append('text')
            .attr('class', 'graph-node__label')
            .attr('text-anchor', 'middle')
          return g
        },
        (update) => update,
        (exit) => exit.remove()
      )

    // --- Update visual attributes (always) ---
    nodeGroup
      .attr('class', (d) => {
        const classes = ['graph-node']
        if (d.isCandidate) {
          classes.push('graph-node--candidate')
          if (d.rank != null) classes.push('graph-node--ranked')
        } else if (d.expanded) {
          classes.push('graph-node--expanded')
        } else {
          classes.push('graph-node--unexpanded')
        }
        return classes.join(' ')
      })
      .style('cursor', (d) => (d.isCandidate || !d.expanded ? 'pointer' : 'default'))
      .on('click', (_event, d) => {
        if (d.isCandidate || !d.expanded) {
          onNodeClickRef.current(d.id, d.word, d.isCandidate)
        }
      })

    nodeGroup
      .select<SVGCircleElement>('circle.graph-node__circle')
      .attr('r', (d) => {
        if (d.depth === 0) return 28
        if (d.isCandidate) return 24
        return 22
      })

    nodeGroup
      .select<SVGTextElement>('text.graph-node__label')
      .attr('dy', (d) => (d.rank != null ? '-0.1em' : '0.35em'))
      .text((d) => d.word)

    // Rank badges
    nodeGroup.each(function (d) {
      const g = d3.select(this)
      if (d.rank == null) {
        g.selectAll('g.graph-node__badge').remove()
      } else {
        let badge = g.select<SVGGElement>('g.graph-node__badge')
        if (badge.empty()) {
          const bg = g.append('g').attr('class', 'graph-node__badge')
          bg.append('circle')
            .attr('class', 'graph-node__badge-circle')
            .attr('r', 9)
            .attr('cy', 12)
          bg.append('text')
            .attr('class', 'graph-node__badge-text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('y', 12)
          badge = bg
        }
        badge.select('text').text(String(d.rank))
      }
    })

    // --- Position elements using the shared positionsRef ---
    // This works regardless of whether d.source is a string or SimNode
    function positionElements() {
      const pos = positionsRef.current
      container
        .selectAll<SVGLineElement, SimLink>('line.graph-edge')
        .attr('x1', (d) => pos.get(linkNodeId(d.source))?.x ?? 0)
        .attr('y1', (d) => pos.get(linkNodeId(d.source))?.y ?? 0)
        .attr('x2', (d) => pos.get(linkNodeId(d.target))?.x ?? 0)
        .attr('y2', (d) => pos.get(linkNodeId(d.target))?.y ?? 0)

      nodeGroup.attr('transform', (d) => {
        const p = pos.get(d.id)
        return `translate(${p?.x ?? d.x ?? 0},${p?.y ?? d.y ?? 0})`
      })
    }

    // --- Simulation (only rebuild on structural changes) ---
    if (structureChanged) {
      simulationRef.current?.stop()

      // Scale forces so the graph unfurls as it grows
      const n = simNodes.length
      const linkDist = 80 + n * 3
      const chargeStrength = -200 - n * 8
      const centerStrength = Math.max(0.005, 0.04 - n * 0.001)
      const collisionRadius = 35 + n * 0.5

      const simulation = d3
        .forceSimulation<SimNode>(simNodes)
        .force(
          'link',
          d3
            .forceLink<SimNode, SimLink>(simLinks)
            .id((d) => d.id)
            .distance(linkDist)
        )
        .force('charge', d3.forceManyBody().strength(chargeStrength))
        .force('center', d3.forceCenter(width / 2, height / 2).strength(centerStrength))
        .force('collision', d3.forceCollide().radius(collisionRadius))
        .alphaDecay(0.03)

      const hasExistingNodes = positionsRef.current.size > 0
      if (hasExistingNodes && !containerIsNew) {
        simulation.alpha(0.4)
      }

      simulation.on('tick', () => {
        // Update shared positions from simulation
        for (const n of simulation.nodes()) {
          if (n.x != null && n.y != null) {
            positionsRef.current.set(n.id, { x: n.x, y: n.y })
          }
        }
        positionElements()
      })

      // Drag behavior — clickDistance(5) lets clicks through
      const drag = d3
        .drag<SVGGElement, SimNode>()
        .clickDistance(5)
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })

      nodeGroup.call(drag)
      simulationRef.current = simulation
    } else {
      // Visual-only update — just reposition from cached positions
      positionElements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, options.width, options.height])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      simulationRef.current?.stop()
      simulationRef.current = null
      containerRef.current = null
      prevNodeIdsRef.current = ''
    }
  }, [])

  const centerOnNode = useCallback(
    (nodeId: string) => {
      if (!svgRef.current || !zoomRef.current) return

      const pos = positionsRef.current.get(nodeId)
      if (!pos) return

      const svg = d3.select(svgRef.current)
      const { width, height } = options

      svg
        .transition()
        .duration(500)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(1)
            .translate(-pos.x, -pos.y)
        )
    },
    [svgRef, options]
  )

  return { centerOnNode }
}
