// GLSL shader sources and WebGL compile/link helpers for the network background

export const VERT_NODE = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in float a_size;
layout(location = 2) in float a_alpha;

uniform vec2 u_resolution;

out float v_alpha;

void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = a_size;
    v_alpha = a_alpha;
}
`

export const FRAG_NODE = `#version 300 es
precision mediump float;

in float v_alpha;
out vec4 fragColor;

uniform vec3 u_coreColor;
uniform vec3 u_glowColor;

void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float dist = length(uv);

    float core = smoothstep(0.5, 0.3, dist);
    float glow = smoothstep(1.0, 0.0, dist);

    vec3 color = mix(u_glowColor, u_coreColor, core);
    float alpha = glow * v_alpha;

    // Premultiply for correct canvas compositing
    fragColor = vec4(color * alpha, alpha);
}
`

export const VERT_EDGE = `#version 300 es
layout(location = 0) in vec2 a_position;
layout(location = 1) in float a_alpha;

uniform vec2 u_resolution;

out float v_alpha;

void main() {
    vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);
    v_alpha = a_alpha;
}
`

export const FRAG_EDGE = `#version 300 es
precision mediump float;

in float v_alpha;
out vec4 fragColor;

uniform vec3 u_edgeColor;

void main() {
    float a = v_alpha * 0.6;
    fragColor = vec4(u_edgeColor * a, a);
}
`

export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertShader: WebGLShader,
  fragShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram()!
  gl.attachShader(program, vertShader)
  gl.attachShader(program, fragShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}
