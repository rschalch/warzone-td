// Ground renderer: one WebGL2 fragment-shader pass that paints the whole landscape into a canvas.
// Photo textures (CC0, public/terrain) are sampled without visible tiling (Quilez's offset trick),
// mixed by rules on moisture, slope, height, sediment and the gameplay masks, blended by their own
// relief (height blending) so borders follow cracks and clumps, then lit by the landscape's normals,
// cast shadows and ambient occlusion, and colour-graded. Rendered once per map.

import { MAP_H, MAP_W } from '../game/defs';
import { SUN, type Landscape } from './landscape';

export const GROUND = ['grass', 'drygrass', 'patchy', 'sand', 'gravel', 'mud', 'rock', 'snow'] as const;
export type GroundName = (typeof GROUND)[number];

/** World px covered by one texture tile (and a second, larger scale mixed in for variety). */
const TEX_WORLD = 180;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uA; // normal.xy, height (0-1 of range), mountain mask
uniform sampler2D uB; // water mask, water depth/4, moisture, sediment
uniform sampler2D uC; // sun (cast shadow), ambient occlusion
uniform sampler2D uT[8];
uniform vec2 uWorld;   // map size in world px
uniform vec2 uHeight;  // height range (world px)
uniform vec3 uSun;
uniform float uTile;   // world px per texture tile
uniform float uDetail; // 1 at full size, 0 for small overviews (no high-frequency detail)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.07 + 13.1) * 0.3 + vnoise(p * 4.13 - 7.7) * 0.15; }

// texture without visible repetition: blend two copies at offsets picked by a slow noise
// (derivatives come from the caller: they're undefined inside non-uniform control flow)
vec3 noTile(int i, vec2 uv, vec2 dx, vec2 dy) {
  float k = vnoise(uv * 0.35 + float(i) * 3.7) * 7.0;
  float ia = floor(k), f = fract(k);
  vec2 oa = sin(vec2(3.0, 7.0) * ia), ob = sin(vec2(3.0, 7.0) * (ia + 1.0));
  vec3 a, b;
  // sampler arrays need constant indices
  if (i == 0) { a = textureGrad(uT[0], uv + oa, dx, dy).rgb; b = textureGrad(uT[0], uv + ob, dx, dy).rgb; }
  else if (i == 1) { a = textureGrad(uT[1], uv + oa, dx, dy).rgb; b = textureGrad(uT[1], uv + ob, dx, dy).rgb; }
  else if (i == 2) { a = textureGrad(uT[2], uv + oa, dx, dy).rgb; b = textureGrad(uT[2], uv + ob, dx, dy).rgb; }
  else if (i == 3) { a = textureGrad(uT[3], uv + oa, dx, dy).rgb; b = textureGrad(uT[3], uv + ob, dx, dy).rgb; }
  else if (i == 4) { a = textureGrad(uT[4], uv + oa, dx, dy).rgb; b = textureGrad(uT[4], uv + ob, dx, dy).rgb; }
  else if (i == 5) { a = textureGrad(uT[5], uv + oa, dx, dy).rgb; b = textureGrad(uT[5], uv + ob, dx, dy).rgb; }
  else if (i == 6) { a = textureGrad(uT[6], uv + oa, dx, dy).rgb; b = textureGrad(uT[6], uv + ob, dx, dy).rgb; }
  else { a = textureGrad(uT[7], uv + oa, dx, dy).rgb; b = textureGrad(uT[7], uv + ob, dx, dy).rgb; }
  return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * dot(a - b, vec3(1.0))));
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 rgb(int r, int g, int b) { return vec3(r, g, b) / 255.0; }
// soft-edged step, for painted bands with a little anti-aliasing
float band(float x, float t, float w) { return smoothstep(t - w, t + w, x); }
// thin line where a field crosses a level (screen-space width)
float isoline(float f, float level, float px) { float d = abs(f - level) / max(fwidth(f), 1e-4); return 1.0 - smoothstep(px * 0.5, px, d); }

void main() {
  vec2 world = vUv * uWorld;
  vec4 A = texture(uA, vUv);
  vec4 B = texture(uB, vUv);
  vec4 C = texture(uC, vUv);
  vec2 nxy = A.xy * 2.0 - 1.0;
  vec3 n = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));
  float hf = A.z;                       // 0-1 of the map's height range
  float m = A.w;                        // mountain cells (soft)
  float water = B.x, depth = B.y * 4.0, mo = B.z, sed = B.w;

  // ---- painted grass: three greens in soft blobs, a warmer dry tone where it's dry, brush grain
  float p1 = fbm(world * 0.006);
  float p2 = fbm(world * 0.018 + 7.0);
  float stroke = vnoise(vec2(world.x * 0.09 + world.y * 0.03, world.y * 0.35)) - 0.5;
  vec3 grassDark = rgb(86, 128, 40), grassMid = rgb(118, 162, 52), grassLight = rgb(156, 190, 70);
  vec3 col = mix(grassDark, grassMid, band(p1 + stroke * 0.05, 0.45, 0.03));
  col = mix(col, grassLight, band(p2 + p1 * 0.4 + stroke * 0.06, 0.78, 0.03) * 0.85);
  vec3 dry = mix(rgb(182, 160, 92), rgb(204, 182, 112), band(p2, 0.5, 0.05));
  float dryness = band(mo + (p2 - 0.5) * 0.15, 0.3, 0.03);
  col = mix(dry, col, dryness);
  col *= 1.0 + stroke * 0.06;

  // ---- mountains: terraced tiers with cliff faces, ink at every tier edge, grassy low tiers and rock above
  float steps = 7.0;
  float hs = hf * steps + (fbm(world * 0.02) - 0.5) * 0.6;
  float tier = floor(hs);
  float f = fract(hs);
  float face = smoothstep(0.78, 0.9, f) * band(m, 0.42, 0.05);   // the riser of each step
  vec3 rockTop = mix(rgb(150, 138, 118), rgb(176, 166, 146), band(p2, 0.5, 0.1));
  vec3 rockFace = mix(rgb(112, 96, 80), rgb(92, 78, 66), stroke + 0.5);
  float rocky = smoothstep(1.5, 3.0, tier);
  vec3 top = mix(mix(col, rgb(124, 150, 64), 0.5), rockTop, rocky);
  top = mix(top, rgb(236, 240, 244), smoothstep(5.0, 5.6, hs) * band(m, 0.6, 0.05)); // snow caps
  float inM = band(m, 0.42, 0.04);
  col = mix(col, top, inM);
  // the cliff face, lit by which way it faces
  float faceLit = clamp(0.75 + 0.6 * dot(n.xy, normalize(vec2(-0.55, -0.62))), 0.45, 1.25);
  col = mix(col, rockFace * faceLit, face);
  // ink: the foot of the massif and the top edge of every tier
  float ink = max(isoline(m, 0.42, 2.2), inM * isoline(hs, tier + 0.79, 1.6) * step(0.5, tier));
  // foliage rim: a darker green band at the foot, like bushes along the cliffs
  float foot = band(m, 0.2, 0.08) * (1.0 - inM);
  col = mix(col, grassDark * 0.85, foot * 0.45);

  // ---- light: flat-banded (cel) sun, soft cool shadows
  float diff = max(dot(n, uSun), 0.0) / uSun.z;
  float light = 0.84 + 0.14 * band(diff, 0.8, 0.06) + 0.1 * band(diff, 1.25, 0.06);
  float shade = mix(0.72, 1.0, band(C.x, 0.5, 0.15));
  col *= light;
  col = mix(col * vec3(0.78, 0.82, 0.95), col, shade);

  // ---- water: sandy bank, white foam line, bright teal that deepens, painted wave strokes
  float bank = band(water, 0.36, 0.04) * (1.0 - band(water, 0.5, 0.01));
  col = mix(col, rgb(214, 196, 140), bank);
  float wet = band(water, 0.5, 0.01);
  if (wet > 0.0) {
    float d = clamp(depth / 2.0, 0.0, 1.0);
    vec3 wc = mix(rgb(96, 190, 200), rgb(44, 128, 168), band(d + (p2 - 0.5) * 0.3, 0.45, 0.08));
    float wave = band(vnoise(vec2(world.x * 0.05, world.y * 0.25)) , 0.8, 0.02) * (1.0 - band(water, 0.62, 0.02) * 0.0);
    wc = mix(wc, rgb(186, 234, 236), wave * 0.55);
    float foam = isoline(water, 0.56, 3.0) + (1.0 - band(water, 0.54, 0.015)) * 0.8;
    wc = mix(wc, rgb(240, 250, 250), clamp(foam, 0.0, 1.0));
    col = mix(col, wc, wet);
  }
  ink = max(ink, isoline(water, 0.5, 2.0) * 0.7);
  col = mix(col, rgb(46, 34, 24), ink * 0.85);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`terrain shader: ${gl.getShaderInfoLog(s)}`);
  return s;
}

interface Shared {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  data: WebGLTexture[];
  images: (ImageBitmap | null)[] | null; // the ground textures last uploaded
}
let shared: Shared | null | undefined;

/** One WebGL2 context for every terrain render (browsers cap live contexts); null without WebGL2. */
function context(): Shared | null {
  if (shared !== undefined) return shared;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  if (!gl) return (shared = null);
  try {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`terrain program: ${gl.getProgramInfoLog(prog)}`);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const data = [0, 1, 2].map((unit) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    gl.uniform1i(gl.getUniformLocation(prog, 'uA'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uB'), 1);
    gl.uniform1i(gl.getUniformLocation(prog, 'uC'), 2);
    gl.uniform1iv(gl.getUniformLocation(prog, 'uT'), GROUND.map((_, i) => 3 + i));
    return (shared = { canvas, gl, prog, data, images: null });
  } catch (e) {
    console.warn(e);
    return (shared = null);
  }
}

/**
 * Paints the landscape at `res` canvas px per world px into a new 2D canvas, or returns null when
 * WebGL2 isn't available. `images` are the ground textures in GROUND order (null ones render grey).
 */
export function renderGround(L: Landscape, images: (ImageBitmap | null)[], res: number): HTMLCanvasElement | null {
  const ctx = context();
  if (!ctx) return null;
  const { gl, prog, canvas } = ctx;
  const w = Math.max(1, Math.ceil(MAP_W * res));
  const h = Math.max(1, Math.ceil(MAP_H * res));
  canvas.width = w;
  canvas.height = h;

  // data textures from the landscape
  const { W, H } = L;
  let hMin = Infinity;
  let hMax = -Infinity;
  for (const v of L.height) {
    hMin = Math.min(hMin, v);
    hMax = Math.max(hMax, v);
  }
  const span = Math.max(1, hMax - hMin);
  const step = 20 / L.sub;
  const a = new Uint8Array(W * H * 4);
  const b = new Uint8Array(W * H * 4);
  const c = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const hx = (L.height[y * W + Math.min(W - 1, x + 1)] - L.height[y * W + Math.max(0, x - 1)]) / (2 * step);
      const hy = (L.height[Math.min(H - 1, y + 1) * W + x] - L.height[Math.max(0, y - 1) * W + x]) / (2 * step);
      const inv = 1 / Math.hypot(hx, hy, 1);
      a[k * 4] = (0.5 - 0.5 * hx * inv) * 255;
      a[k * 4 + 1] = (0.5 - 0.5 * hy * inv) * 255;
      a[k * 4 + 2] = ((L.height[k] - hMin) / span) * 255;
      a[k * 4 + 3] = L.mount[k] * 255;
      b[k * 4] = L.water[k] * 255;
      b[k * 4 + 1] = Math.min(1, L.depth[k] / 4) * 255;
      b[k * 4 + 2] = L.moist[k] * 255;
      b[k * 4 + 3] = L.sediment[k] * 255;
      c[k * 4] = L.sun[k] * 255;
      c[k * 4 + 1] = L.ao[k] * 255;
      c[k * 4 + 3] = 255;
    }
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  [a, b, c].forEach((d, unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, ctx.data[unit]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  });

  // ground textures: repeating, mipmapped; uploaded once
  if (ctx.images !== images) {
    ctx.images = images;
    images.forEach((img, i) => {
      gl.activeTexture(gl.TEXTURE3 + i);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([110, 110, 100, 255]));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    });
  }
  gl.useProgram(prog);
  gl.uniform2f(gl.getUniformLocation(prog, 'uWorld'), MAP_W, MAP_H);
  gl.uniform2f(gl.getUniformLocation(prog, 'uHeight'), hMin, hMax);
  gl.uniform3f(gl.getUniformLocation(prog, 'uSun'), ...SUN);
  gl.uniform1f(gl.getUniformLocation(prog, 'uTile'), TEX_WORLD);
  gl.uniform1f(gl.getUniformLocation(prog, 'uDetail'), res >= 0.5 ? 1 : 0);
  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return out;
}
