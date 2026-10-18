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

void main() {
  vec2 world = vUv * uWorld;
  vec2 uv = world / uTile;
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 A = texture(uA, vUv);
  vec4 B = texture(uB, vUv);
  vec4 C = texture(uC, vUv);
  vec2 nxy = A.xy * 2.0 - 1.0;
  vec3 n = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));
  float slope = 1.0 - n.z;
  float h = mix(uHeight.x, uHeight.y, A.z);
  float m = A.w;
  float water = B.x, depth = B.y * 4.0, sed = B.w;
  float jag = fbm(world * 0.02) - 0.5;          // ragged borders
  float mo = B.z + jag * 0.16;

  // rules: how much each ground wants to be here
  float w[8];
  w[0] = smoothstep(0.42, 0.68, mo);                                   // lush grass
  w[1] = smoothstep(0.52, 0.34, mo) * smoothstep(0.12, 0.3, mo);       // dry grass
  w[2] = (1.0 - abs(mo - 0.46) * 4.0) * 0.8 + smoothstep(0.08, 0.2, slope) * 0.4; // patchy grass and dirt
  w[3] = smoothstep(0.26, 0.1, mo);                                    // sand
  // mountains like seen from above: vegetation on the lower slopes, scree down the gullies, bare rock
  // on steep and high ground, snow on the tops; the blocked cells are always at least half rock
  float mountain = smoothstep(0.38, 0.6, m + jag * 0.15);
  float hf = clamp((h - uHeight.x) / (uHeight.y - uHeight.x), 0.0, 1.0);
  float high = smoothstep(0.22, 0.5, hf + jag * 0.12);
  float steep = smoothstep(0.3, 0.55, slope);
  w[4] = sed * 1.3 + smoothstep(0.12, 0.3, slope) * 0.6 * (1.0 - high);   // gravel: fans, gullies, foothills
  float bank = smoothstep(0.22, 0.42, water) * (1.0 - smoothstep(0.5, 0.56, water));
  w[5] = bank * 1.6 + smoothstep(0.75, 0.95, mo) * 0.35;               // mud
  w[6] = max(mountain * 1.0, max(high, steep) * (0.6 + 0.8 * mountain)); // rock
  // vegetation stays on the buildable foothills: whatever blocks reads as rock at a glance
  for (int i = 0; i < 4; i++) w[i] *= 1.0 - 0.7 * mountain;
  float snowline = 0.62 + jag * 0.1;
  w[7] = smoothstep(snowline, snowline + 0.16, hf) * smoothstep(0.45, 0.15, slope) * 1.5; // snow

  // height blending: each texture's own relief (luminance) decides who wins along the border
  vec3 col[8];
  float best = -1e9;
  float score[8];
  for (int i = 0; i < 8; i++) {
    col[i] = vec3(0.0);
    if (w[i] <= 0.01) { score[i] = -1e9; continue; }
    float s = i == 6 ? 0.7 : 1.0;
    vec3 a = noTile(i, uv * s, dx * s, dy * s);
    if (i == 6) a = mix(vec3(lum(a)) * vec3(1.02, 0.98, 0.93), a, 0.7) * 0.6 + 0.16; // rock: flatter, so the relief reads
    if (uDetail > 0.5 && i < 4) a = mix(a, noTile(i, uv * 0.37 + 11.0, dx * 0.37, dy * 0.37), 0.35); // a second, larger scale
    col[i] = a;
    // (snow is bright everywhere: its brightness says nothing about relief, so it doesn't count)
    score[i] = clamp(w[i], 0.0, 1.5) + lum(a) * (i == 7 ? 0.08 : 0.45);
    best = max(best, score[i]);
  }
  vec3 albedo = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 8; i++) {
    float b = max(score[i] - best + (i == 7 ? 0.35 : 0.18), 0.0);
    albedo += col[i] * b;
    total += b;
  }
  albedo /= max(total, 1e-4);
  // large-scale tone variation so wide fields aren't uniform
  albedo *= 0.88 + 0.24 * fbm(world * 0.004 + 31.0);

  // light: direct sun (with cast shadows) relative to flat ground, ambient occlusion
  float diff = max(dot(n, uSun), 0.0) / uSun.z;
  float light = C.y * (0.3 + 0.7 * diff * mix(0.3, 1.0, C.x));
  vec3 colr = albedo * light;

  // water over its bed: murky green-brown in the shallows to deep blue-green, sky glints, foam line
  float wet = smoothstep(0.46, 0.54, water);
  if (wet > 0.0) {
    float d = clamp(depth / 2.5, 0.0, 1.0);
    vec3 wc = mix(vec3(0.24, 0.33, 0.27), vec3(0.08, 0.2, 0.25), d);
    float ripple = fbm(vec2(world.x * 0.09, world.y * 0.03)) - 0.5;
    wc += ripple * 0.06 + vec3(0.55, 0.62, 0.6) * pow(max(0.0, ripple + 0.25), 3.0) * 1.2;
    float foam = (1.0 - smoothstep(0.5, 0.6, water)) * 0.35 * (0.6 + fbm(world * 0.15));
    wc = mix(wc, vec3(0.75, 0.78, 0.72), foam);
    colr = mix(colr, wc * mix(0.75, 1.0, C.x), wet * mix(0.8, 0.95, d));
  }

  // grade towards the game's palette: a little less saturated, warm, gentle contrast
  float g = lum(colr);
  colr = mix(vec3(g), colr, 0.8);
  colr *= vec3(1.0, 0.97, 0.9);
  colr = (colr - 0.5) * 1.05 + 0.5;
  outColor = vec4(clamp(colr, 0.0, 1.0), 1.0);
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
