import { useEffect } from 'react'
import {
  VERT_NODE,
  FRAG_NODE,
  VERT_EDGE,
  FRAG_EDGE,
  createShader,
  createProgram,
} from '@/lib/network-shaders'

interface NetworkNode {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
}

const NODE_COUNT = 60
const CONNECTION_RADIUS = 200
const EDGE_WIDTH = 1.5
const SPEED = 0.3
const MIN_SIZE = 10
const MAX_SIZE = 30
const MAX_EDGES = (NODE_COUNT * (NODE_COUNT - 1)) / 2

function initNodes(w: number, h: number): NetworkNode[] {
  const nodes: NetworkNode[] = []
  for (let i = 0; i < NODE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = (0.15 + Math.random() * 0.35) * SPEED
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE),
      alpha: 0.5 + Math.random() * 0.5,
    })
  }
  return nodes
}

function updatePhysics(nodes: NetworkNode[], w: number, h: number) {
  for (const node of nodes) {
    node.vx += (Math.random() - 0.5) * 0.02
    node.vy += (Math.random() - 0.5) * 0.02

    const maxV = SPEED * 1.5
    const v = Math.sqrt(node.vx * node.vx + node.vy * node.vy)
    if (v > maxV) {
      node.vx = (node.vx / v) * maxV
      node.vy = (node.vy / v) * maxV
    }

    node.x += node.vx
    node.y += node.vy

    const margin = 20
    if (node.x < margin) {
      node.x = margin
      node.vx = Math.abs(node.vx)
    } else if (node.x > w - margin) {
      node.x = w - margin
      node.vx = -Math.abs(node.vx)
    }
    if (node.y < margin) {
      node.y = margin
      node.vy = Math.abs(node.vy)
    } else if (node.y > h - margin) {
      node.y = h - margin
      node.vy = -Math.abs(node.vy)
    }
  }
}

export function useNetworkBackground(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
    })
    if (!gl || gl.isContextLost()) return

    let nodeProgram: WebGLProgram
    let edgeProgram: WebGLProgram
    let nodeVert: WebGLShader
    let nodeFrag: WebGLShader
    let edgeVert: WebGLShader
    let edgeFrag: WebGLShader
    try {
      nodeVert = createShader(gl, gl.VERTEX_SHADER, VERT_NODE)
      nodeFrag = createShader(gl, gl.FRAGMENT_SHADER, FRAG_NODE)
      nodeProgram = createProgram(gl, nodeVert, nodeFrag)
      edgeVert = createShader(gl, gl.VERTEX_SHADER, VERT_EDGE)
      edgeFrag = createShader(gl, gl.FRAGMENT_SHADER, FRAG_EDGE)
      edgeProgram = createProgram(gl, edgeVert, edgeFrag)
    } catch (e) {
      console.warn('NetworkBackground: WebGL init failed', e)
      return
    }

    const nodeUniforms = {
      resolution: gl.getUniformLocation(nodeProgram, 'u_resolution'),
      coreColor: gl.getUniformLocation(nodeProgram, 'u_coreColor'),
      glowColor: gl.getUniformLocation(nodeProgram, 'u_glowColor'),
    }
    const edgeUniforms = {
      resolution: gl.getUniformLocation(edgeProgram, 'u_resolution'),
      edgeColor: gl.getUniformLocation(edgeProgram, 'u_edgeColor'),
    }

    // Node buffer: [x, y, size, alpha] per node
    const nodeData = new Float32Array(NODE_COUNT * 4)
    const nodeBuffer = gl.createBuffer()!

    // Edge buffer: 6 vertices per edge (2 triangles forming a quad), 3 floats each [x, y, alpha]
    const edgeData = new Float32Array(MAX_EDGES * 18)
    const edgeBuffer = gl.createBuffer()!

    // --- VAOs ---
    const nodeVAO = gl.createVertexArray()!
    gl.bindVertexArray(nodeVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 16, 12)
    gl.bindVertexArray(null)

    const edgeVAO = gl.createVertexArray()!
    gl.bindVertexArray(edgeVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 12, 8)
    gl.bindVertexArray(null)

    let cssWidth = canvas.clientWidth
    let cssHeight = canvas.clientHeight
    const nodes = initNodes(cssWidth, cssHeight)
    let animId = 0

    function resize() {
      const dpr = window.devicePixelRatio || 1
      cssWidth = canvas!.clientWidth
      cssHeight = canvas!.clientHeight
      canvas!.width = cssWidth * dpr
      canvas!.height = cssHeight * dpr
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }

    resize()

    function frame() {
      updatePhysics(nodes, cssWidth, cssHeight)

      const dpr = window.devicePixelRatio || 1
      const halfW = EDGE_WIDTH * dpr * 0.5

      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i]
        const off = i * 4
        nodeData[off] = n.x * dpr
        nodeData[off + 1] = n.y * dpr
        nodeData[off + 2] = n.size * dpr
        nodeData[off + 3] = n.alpha
      }

      // Build edge quads: each edge is 2 triangles (6 vertices)
      let edgeVertCount = 0
      const radiusSq = CONNECTION_RADIUS * CONNECTION_RADIUS
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const distSq = dx * dx + dy * dy
          if (distSq < radiusSq) {
            const dist = Math.sqrt(distSq)
            const alpha = 1.0 - dist / CONNECTION_RADIUS

            // Perpendicular direction for quad width
            const nx = -(dy / dist) * halfW
            const ny = (dx / dist) * halfW

            const x1 = nodes[i].x * dpr
            const y1 = nodes[i].y * dpr
            const x2 = nodes[j].x * dpr
            const y2 = nodes[j].y * dpr

            const off = edgeVertCount * 3
            // Triangle 1
            edgeData[off]      = x1 + nx; edgeData[off + 1]  = y1 + ny; edgeData[off + 2]  = alpha
            edgeData[off + 3]  = x1 - nx; edgeData[off + 4]  = y1 - ny; edgeData[off + 5]  = alpha
            edgeData[off + 6]  = x2 + nx; edgeData[off + 7]  = y2 + ny; edgeData[off + 8]  = alpha
            // Triangle 2
            edgeData[off + 9]  = x2 + nx; edgeData[off + 10] = y2 + ny; edgeData[off + 11] = alpha
            edgeData[off + 12] = x1 - nx; edgeData[off + 13] = y1 - ny; edgeData[off + 14] = alpha
            edgeData[off + 15] = x2 - nx; edgeData[off + 16] = y2 - ny; edgeData[off + 17] = alpha

            edgeVertCount += 6
          }
        }
      }

      gl!.clearColor(0, 0, 0, 0)
      gl!.clear(gl!.COLOR_BUFFER_BIT)
      gl!.enable(gl!.BLEND)
      gl!.blendFuncSeparate(
        gl!.SRC_ALPHA, gl!.ONE,
        gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA
      )

      const resW = cssWidth * dpr
      const resH = cssHeight * dpr

      // Draw edges
      if (edgeVertCount > 0) {
        gl!.useProgram(edgeProgram)
        gl!.uniform2f(edgeUniforms.resolution, resW, resH)
        gl!.uniform3f(edgeUniforms.edgeColor, 0.39, 0.4, 0.95)

        gl!.bindVertexArray(edgeVAO)
        gl!.bindBuffer(gl!.ARRAY_BUFFER, edgeBuffer)
        gl!.bufferData(
          gl!.ARRAY_BUFFER,
          edgeData.subarray(0, edgeVertCount * 3),
          gl!.DYNAMIC_DRAW
        )
        gl!.drawArrays(gl!.TRIANGLES, 0, edgeVertCount)
      }

      // Draw nodes
      gl!.useProgram(nodeProgram)
      gl!.uniform2f(nodeUniforms.resolution, resW, resH)
      gl!.uniform3f(nodeUniforms.coreColor, 0.388, 0.4, 0.945)
      gl!.uniform3f(nodeUniforms.glowColor, 0.659, 0.333, 0.969)

      gl!.bindVertexArray(nodeVAO)
      gl!.bindBuffer(gl!.ARRAY_BUFFER, nodeBuffer)
      gl!.bufferData(gl!.ARRAY_BUFFER, nodeData, gl!.DYNAMIC_DRAW)
      gl!.drawArrays(gl!.POINTS, 0, NODE_COUNT)

      gl!.bindVertexArray(null)

      animId = requestAnimationFrame(frame)
    }

    animId = requestAnimationFrame(frame)

    const observer = new ResizeObserver(() => {
      resize()
      for (const node of nodes) {
        node.x = Math.min(node.x, cssWidth - 20)
        node.y = Math.min(node.y, cssHeight - 20)
      }
    })
    observer.observe(canvas.parentElement!)

    return () => {
      cancelAnimationFrame(animId)
      observer.disconnect()
      gl.deleteBuffer(nodeBuffer)
      gl.deleteBuffer(edgeBuffer)
      gl.deleteVertexArray(nodeVAO)
      gl.deleteVertexArray(edgeVAO)
      gl.deleteProgram(nodeProgram)
      gl.deleteProgram(edgeProgram)
      gl.deleteShader(nodeVert)
      gl.deleteShader(nodeFrag)
      gl.deleteShader(edgeVert)
      gl.deleteShader(edgeFrag)
    }
  }, [canvasRef])
}
