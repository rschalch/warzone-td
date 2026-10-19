// Ground renderer: one WebGL2 fragment-shader pass that paints the whole landscape into a canvas, in a
// cartoon style (Kingdom Rush-like): painted greens and dry patches with brush grain, mountains as
// terraced cliffs with ink at every tier edge, a dark forest floor under the woods, cel-banded light
// from the landscape's normals and cast shadows, bright water with foam lines. Rendered once per map.

import { MAP_H, MAP_W } from '../game/defs';
import { SUN, type Landscape } from './landscape';

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
uniform sampler2D uC; // sun (cast shadow), ambient occlusion, forest mask
uniform vec2 uWorld;   // map size in world px
uniform vec2 uHeight;  // height range (world px)
uniform vec3 uSun;
uniform vec3 uGrass[3]; // dark, mid, light ground (the theme: summer grass, snow, desert sand…)
uniform vec3 uDry[2];
uniform vec3 uWood[2];
uniform vec3 uBank;
uniform vec3 uRock[2]; // rock tops, cliff faces
uniform float uCaps;   // snow on the peaks (1) or not

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.07 + 13.1) * 0.3 + vnoise(p * 4.13 - 7.7) * 0.15; }

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
  vec3 grassDark = uGrass[0], grassMid = uGrass[1], grassLight = uGrass[2];
  vec3 col = mix(grassDark, grassMid, band(p1 + stroke * 0.05, 0.45, 0.03));
  col = mix(col, grassLight, band(p2 + p1 * 0.4 + stroke * 0.06, 0.78, 0.03) * 0.85);
  vec3 dry = mix(uDry[0], uDry[1], band(p2, 0.5, 0.05));
  float dryness = band(mo + (p2 - 0.5) * 0.15, 0.3, 0.03);
  col = mix(dry, col, dryness);
  col *= 1.0 + stroke * 0.06;

  // ---- mountains: terraced tiers with cliff faces, ink at every tier edge, grassy low tiers and rock above
  float steps = 7.0;
  float hs = hf * steps + (fbm(world * 0.02) - 0.5) * 0.6;
  float tier = floor(hs);
  float f = fract(hs);
  float face = smoothstep(0.78, 0.9, f) * band(m, 0.42, 0.05);   // the riser of each step
  vec3 rockTop = mix(uRock[0], uRock[0] * 1.17, band(p2, 0.5, 0.1));
  vec3 rockFace = mix(uRock[1], uRock[1] * 0.83, stroke + 0.5);
  float rocky = smoothstep(1.5, 3.0, tier);
  vec3 top = mix(mix(col, uGrass[1], 0.5), rockTop, rocky);
  top = mix(top, rgb(236, 240, 244), smoothstep(5.0, 5.6, hs) * band(m, 0.6, 0.05) * uCaps); // snow caps
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

  // ---- forest floor: deep shaded green under the trees, a dark rim where the wood starts
  float wood = band(C.z, 0.4, 0.06);
  col = mix(col, mix(uWood[0], uWood[1], band(p2, 0.5, 0.1)), wood);
  col = mix(col, grassDark * 0.8, band(C.z, 0.18, 0.06) * (1.0 - wood) * 0.5);

  // ---- light: flat-banded (cel) sun, soft cool shadows
  float diff = max(dot(n, uSun), 0.0) / uSun.z;
  float light = 0.84 + 0.14 * band(diff, 0.8, 0.06) + 0.1 * band(diff, 1.25, 0.06);
  float shade = mix(0.72, 1.0, band(C.x, 0.5, 0.15));
  col *= light;
  col = mix(col * vec3(0.78, 0.82, 0.95), col, shade);

  // ---- water: sandy bank, white foam line, bright teal that deepens, painted wave strokes
  float bank = band(water, 0.36, 0.04) * (1.0 - band(water, 0.5, 0.01));
  col = mix(col, uBank, bank);
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
    return (shared = { canvas, gl, prog, data });
  } catch (e) {
    console.warn(e);
    return (shared = null);
  }
}

/**
 * Paints the landscape at `res` canvas px per world px into a new 2D canvas, or returns null when
 * WebGL2 isn't available.
 */
/** Ground palettes: [grass dark, mid, light], [dry, dry light], [forest floor ×2], river bank (0-255). */
type Rgb = [number, number, number];
export type GroundTheme = 'summer' | 'temperate' | 'snow' | 'desert' | 'volcanic' | 'jungle' | 'steppe' | 'ruins';
const THEMES: Record<GroundTheme, { grass: Rgb[]; dry: Rgb[]; wood: Rgb[]; bank: Rgb; rock?: Rgb[]; caps?: number }> = {
  summer: { grass: [[86, 128, 40], [118, 162, 52], [156, 190, 70]], dry: [[182, 160, 92], [204, 182, 112]], wood: [[52, 88, 30], [66, 104, 36]], bank: [214, 196, 140] },
  // summer without the snow-capped peaks: low hills and bluffs
  temperate: { grass: [[86, 128, 40], [118, 162, 52], [156, 190, 70]], dry: [[182, 160, 92], [204, 182, 112]], wood: [[52, 88, 30], [66, 104, 36]], bank: [214, 196, 140], caps: 0 },
  snow: { grass: [[196, 206, 214], [222, 230, 236], [244, 248, 250]], dry: [[206, 210, 206], [226, 228, 224]], wood: [[64, 84, 70], [86, 104, 92]], bank: [206, 212, 216] },
  desert: { grass: [[196, 164, 104], [216, 188, 126], [232, 210, 152]], dry: [[206, 176, 116], [226, 198, 140]], wood: [[110, 112, 64], [132, 132, 76]], bank: [228, 210, 160], rock: [[188, 152, 104], [140, 104, 70]], caps: 0 },
  volcanic: { grass: [[56, 54, 52], [78, 74, 70], [102, 96, 88]], dry: [[88, 80, 72], [112, 102, 90]], wood: [[60, 82, 44], [76, 98, 52]], bank: [96, 90, 84], rock: [[96, 88, 82], [64, 56, 52]], caps: 0 },
  jungle: { grass: [[56, 104, 34], [76, 132, 42], [104, 158, 56]], dry: [[150, 146, 86], [170, 164, 100]], wood: [[30, 66, 24], [42, 80, 30]], bank: [190, 176, 126], caps: 0 },
  steppe: { grass: [[150, 150, 76], [176, 170, 92], [204, 194, 118]], dry: [[196, 174, 104], [214, 194, 124]], wood: [[64, 92, 40], [80, 108, 48]], bank: [210, 194, 140] },
  ruins: { grass: [[110, 104, 92], [134, 126, 112], [158, 150, 134]], dry: [[150, 136, 114], [170, 156, 132]], wood: [[66, 74, 52], [82, 90, 64]], bank: [170, 160, 140] },
};

export function renderGround(L: Landscape, res: number, theme: GroundTheme = 'summer'): HTMLCanvasElement | null {
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
      c[k * 4 + 2] = L.forest[k] * 255;
      c[k * 4 + 3] = 255;
    }
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  [a, b, c].forEach((d, unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, ctx.data[unit]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  });

  gl.useProgram(prog);
  gl.uniform2f(gl.getUniformLocation(prog, 'uWorld'), MAP_W, MAP_H);
  gl.uniform2f(gl.getUniformLocation(prog, 'uHeight'), hMin, hMax);
  gl.uniform3f(gl.getUniformLocation(prog, 'uSun'), ...SUN);
  const T = THEMES[theme] ?? THEMES.summer;
  const v = (cs: Rgb[]) => new Float32Array(cs.flatMap((c) => c.map((x) => x / 255)));
  gl.uniform3fv(gl.getUniformLocation(prog, 'uGrass'), v(T.grass));
  gl.uniform3fv(gl.getUniformLocation(prog, 'uDry'), v(T.dry));
  gl.uniform3fv(gl.getUniformLocation(prog, 'uWood'), v(T.wood));
  gl.uniform3fv(gl.getUniformLocation(prog, 'uBank'), v([T.bank]));
  gl.uniform3fv(gl.getUniformLocation(prog, 'uRock'), v(T.rock ?? [[150, 138, 118], [112, 96, 80]]));
  gl.uniform1f(gl.getUniformLocation(prog, 'uCaps'), T.caps ?? 1);
  gl.viewport(0, 0, w, h);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return out;
}
