/**
 * A browser port of a slice of the gate's renderer.
 *
 * The real thing (TomSawyerLabs/empyrean-gate, `engine/shaders/gate.wgsl`) is a
 * WGSL compute shader that evaluates every layer for every LED each frame and
 * pushes the result out over sACN. Each layer is a pure function of the LED's
 * polar position and a per-layer phase, which is what makes this port cheap:
 * the vertex shader below is that same function, one invocation per drawn
 * LED, and the fragment shader just draws the soft dot. Case numbers, maths
 * and helper names follow the WGSL so the two stay comparable.
 *
 * What is NOT here: audio analysis (a synthetic beat clock stands in), the
 * video / waveform / spectrum / node-graph layers, and the geometry layers
 * drawn from the camp sigil. See `presets.ts` for which layers the site uses.
 */

export const MAX_LAYERS = 8;
export const MAX_RIPPLES = 8;

/** Layer kinds, numbered as the WGSL `switch L.kind` cases. */
export const KIND = {
  solid: 0,
  gradient_radial: 1,
  noise_field: 2,
  noise_color: 3,
  radial_waves: 4,
  spiral: 5,
  plasma: 6,
  spoke_chase: 7,
  sparkle: 8,
  beat_rings: 9,
  breathe: 10,
  rainbow: 11,
  wedges: 12,
  interference: 13,
  fire: 14,
  warp: 16,
} as const;
export type LayerKind = keyof typeof KIND;

/** Blend modes, numbered as `apply_blend` in the WGSL. */
export const BLEND = {
  add: 0,
  multiply: 1,
  screen: 2,
  alpha_over: 3,
  max: 4,
} as const;
export type BlendMode = keyof typeof BLEND;

export const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

#define MAX_LAYERS ${MAX_LAYERS}
#define MAX_RIPPLES ${MAX_RIPPLES}

const float TAU = 6.28318530718;

uniform float u_spokes;
uniform float u_pixels;
uniform int u_drawn;          // LEDs drawn per spoke (decimated)
uniform float u_inner;        // inner radius / outer radius
uniform float u_point_size;   // device pixels
uniform vec4 u_layer[MAX_LAYERS * 4];
uniform int u_layer_count;
uniform int u_split;          // layers before this index are the outgoing stack
uniform float u_mix;          // 0 = outgoing stack, 1 = incoming stack
uniform vec2 u_tilt;
uniform vec4 u_audio;         // level, bass, mid, treble (synthetic)
uniform vec2 u_beat;          // beat_phase, onset (synthetic)
uniform vec4 u_ripple[MAX_RIPPLES]; // theta, rn, age (s), hue
uniform int u_ripple_count;
uniform float u_master;

out vec3 v_color;

// ---------------------------------------------------------------------------
// Simplex noise (3D), Ashima Arts / Stefan Gustavson. The WGSL is itself a
// port of this GLSL, so this is the original coming home.
// ---------------------------------------------------------------------------

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm3(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  vec3 q = p;
  for (int o = 0; o < 4; o++) {
    if (o >= octaves) break;
    value += amplitude * snoise3(q);
    q *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

vec3 hsv2rgb(float h, float s, float v) {
  float hh = fract(h) * 6.0;
  float c = v * s;
  float x = c * (1.0 - abs(fract(hh * 0.5) * 2.0 - 1.0));
  int i = int(hh) % 6;
  vec3 rgb;
  if (i == 0) rgb = vec3(c, x, 0.0);
  else if (i == 1) rgb = vec3(x, c, 0.0);
  else if (i == 2) rgb = vec3(0.0, c, x);
  else if (i == 3) rgb = vec3(0.0, x, c);
  else if (i == 4) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + vec3(v - c);
}

uint wang_hash(uint s) {
  s = (s ^ 61u) ^ (s >> 16);
  s *= 9u;
  s = s ^ (s >> 4);
  s *= 0x27d4eb2du;
  s = s ^ (s >> 15);
  return s;
}

float hash01(uint s) { return float(wang_hash(s)) / 4294967295.0; }

struct Layer {
  int kind;
  int blend;
  float opacity;
  float phase;
  float scale;
  float hue;
  float hue_range;
  float saturation;
  float brightness;
  float param_a;
  float param_b;
  float param_c;
  float param_d;
  uint phase_epoch;
  float audio_amount;
  float tilt_amount;
};

Layer get_layer(int l) {
  vec4 a = u_layer[l * 4];
  vec4 b = u_layer[l * 4 + 1];
  vec4 c = u_layer[l * 4 + 2];
  vec4 d = u_layer[l * 4 + 3];
  Layer L;
  L.kind = int(a.x);
  L.blend = int(a.y);
  L.opacity = a.z;
  L.phase = a.w;
  L.scale = b.x;
  L.hue = b.y;
  L.hue_range = b.z;
  L.saturation = b.w;
  L.brightness = c.x;
  L.param_a = c.y;
  L.param_b = c.z;
  L.param_c = c.w;
  L.param_d = d.x;
  L.phase_epoch = uint(max(d.y, 0.0));
  L.audio_amount = d.z;
  L.tilt_amount = d.w;
  return L;
}

struct Ctx {
  uint spoke;
  uint i;
  float theta;
  float r01;   // 0 at the rim, 1 at the inner end
  float rn;    // radius as a fraction of the outer radius
  vec2 pos;    // rn * (cos theta, sin theta)
};

// ---------------------------------------------------------------------------
// Layers. Each returns (rgb, alpha) to be blended. Mirrors layer_color().
// ---------------------------------------------------------------------------

vec4 layer_color(Layer L, Ctx ctx) {
  float A_level = u_audio.x;
  float A_bass = u_audio.y;
  float A_mid = u_audio.z;
  float A_treble = u_audio.w;
  float A_beat = u_beat.x;
  float A_onset = u_beat.y;
  float aud = L.audio_amount;
  vec2 tilt = u_tilt * L.tilt_amount;

  if (L.kind == 0) { // Solid
    float v = L.brightness * (1.0 + aud * (A_level - 0.5));
    return vec4(hsv2rgb(L.hue, L.saturation, max(v, 0.0)), 1.0);
  }
  if (L.kind == 1) { // GradientRadial
    float t = ctx.rn + dot(ctx.pos, tilt) + L.phase * 0.1;
    float hue = L.hue + t * L.hue_range;
    float v = L.brightness * (1.0 + aud * A_bass);
    return vec4(hsv2rgb(hue, L.saturation, max(v, 0.0)), 1.0);
  }
  if (L.kind == 2) { // NoiseField
    vec3 p = vec3(ctx.pos * (2.0 * L.scale) + tilt, L.phase * 0.3);
    float n = fbm3(p, 4);
    float cut = L.param_a;
    float v = smoothstep(cut - 0.3, cut + 0.5, n + aud * A_bass * 0.6);
    float hue = L.hue + n * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * L.brightness), v);
  }
  if (L.kind == 3) { // NoiseColor
    float s = 2.0 * L.scale;
    float z = L.phase * 0.25;
    vec3 p = vec3(ctx.pos * s + tilt, z);
    float boost = 1.0 + aud * (A_level * 1.2 - 0.3);
    float r = 0.5 + 0.5 * snoise3(p);
    float g = 0.5 + 0.5 * snoise3(p + vec3(31.4, 47.2, 12.9));
    float b = 0.5 + 0.5 * snoise3(p + vec3(-17.7, 8.3, 91.1));
    vec3 base = hsv2rgb(L.hue, L.saturation, 1.0);
    vec3 c = mix(vec3(r, g, b), vec3(r, g, b) * base, 0.6);
    return vec4(c * L.brightness * boost, 1.0);
  }
  if (L.kind == 4) { // RadialWaves
    float base_freq = 2.0 + L.param_a * 10.0;
    int harmonics = 1 + int(L.param_b * 6.0);
    float v = 0.0;
    float norm = 0.0;
    for (int h = 1; h <= 7; h++) {
      if (h > harmonics) break;
      float fh = float(h);
      float w = 1.0 / fh;
      v += w * sin((ctx.rn * base_freq * fh * L.scale) * TAU - L.phase * (1.0 + 0.2 * fh));
      norm += w;
    }
    v = v / norm * 0.5 + 0.5;
    v = v * v;
    float amp = L.brightness * mix(1.0, 0.4 + A_bass * 1.4, aud);
    float hue = L.hue + (ctx.rn - 0.5) * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * amp), v);
  }
  if (L.kind == 5) { // Spiral
    float arms = max(1.0, floor(L.param_a * 12.0));
    float twist = (L.param_b * 8.0 - 4.0) * L.scale;
    float v0 = sin(arms * ctx.theta + twist * ctx.rn * TAU - L.phase);
    float sharp = 1.0 + L.param_c * 8.0;
    float v = pow(max(v0, 0.0), sharp);
    float amp = L.brightness * mix(1.0, 0.5 + A_mid, aud);
    float hue = L.hue + ctx.rn * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * amp), v);
  }
  if (L.kind == 6) { // Plasma
    float s = 3.0 * L.scale;
    float t = L.phase;
    float v = sin(ctx.pos.x * s + t);
    v += sin((ctx.pos.y * s + t) * 0.7);
    v += sin((ctx.pos.x + ctx.pos.y) * s * 0.6 + t * 1.3);
    v += sin(ctx.rn * s * 2.0 - t);
    v = v * 0.25 + 0.5;
    float hue = L.hue + v * L.hue_range + aud * A_mid * 0.1;
    return vec4(hsv2rgb(hue, L.saturation, L.brightness * v), 1.0);
  }
  if (L.kind == 7) { // SpokeChase
    float h = hash01(ctx.spoke * 7919u);
    float head = fract(h + L.phase);
    float d = fract(ctx.r01 - head);
    float tail_len = 0.05 + L.param_c * 0.4;
    float v = exp(-d / tail_len) * step(0.0, d);
    float hue = L.hue + h * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * L.brightness), v);
  }
  if (L.kind == 8) { // Sparkle
    uint idx = ctx.spoke * uint(u_pixels) + ctx.i;
    uint cell = L.phase_epoch;
    float f = L.phase;
    float rnd0 = hash01(idx * 2654435761u + cell * 40503u);
    float rnd1 = hash01(idx * 2654435761u + (cell + 1u) * 40503u);
    float density = L.param_a * mix(1.0, 0.3 + A_treble * 1.5, aud);
    float lit0 = step(1.0 - density * 0.2, rnd0);
    float lit1 = step(1.0 - density * 0.2, rnd1);
    float v0 = lit0 * (1.0 - f) * (1.0 - f);
    float v1 = lit1 * f * f;
    float v = max(v0, v1);
    float hue = L.hue + mix(rnd0, rnd1, f) * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * L.brightness), v);
  }
  if (L.kind == 9) { // BeatRings
    float dir = L.param_b > 0.5 ? ctx.r01 : 1.0 - ctx.r01;
    float width = 0.02 + L.param_a * 0.3;
    float front = A_beat;
    float d = abs(dir - front);
    float v = exp(-(d * d) / (width * width)) * (1.0 - A_beat * 0.5);
    float strength = mix(1.0, A_onset * 0.7 + 0.5, aud);
    float hue = L.hue + front * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * L.brightness * strength), v);
  }
  if (L.kind == 10) { // Breathe
    float free = 0.5 + 0.5 * sin(L.phase);
    float beat = 1.0 - A_beat * 0.7;
    float env = mix(free, beat, aud);
    float v = mix(L.param_a, 1.0, env) * L.brightness;
    return vec4(vec3(v), 1.0);
  }
  if (L.kind == 11) { // Rainbow
    float turns = max(1.0, floor(L.param_a * 4.0 + 0.5));
    float hue = L.hue + (ctx.theta / TAU) * turns + ctx.rn * L.hue_range + L.phase * 0.03;
    float v = L.brightness * mix(1.0, 0.8 + A_level * 0.6, aud);
    return vec4(hsv2rgb(hue, L.saturation, max(v, 0.0)), 1.0);
  }
  if (L.kind == 12) { // Wedges
    float n = 2.0 + floor(L.param_a * 14.0);
    float soft = 0.05 + L.param_c * 0.3;
    float w = fract((ctx.theta / TAU + L.phase * 0.03) * n + ctx.rn * L.param_b);
    float d = abs(w - 0.5) * 2.0;
    float v = smoothstep(0.5 - soft, 0.5 + soft, d);
    v = max(v, aud * A_onset);
    float hue = L.hue + step(0.5, w) * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * L.brightness), v);
  }
  if (L.kind == 13) { // Interference
    float orbit = 0.45 + L.param_b * 0.3;
    vec2 p1 = orbit * vec2(cos(L.phase * 0.31), sin(L.phase * 0.31));
    vec2 p2 = -orbit * vec2(cos(L.phase * 0.23), sin(L.phase * 0.23));
    float freq = (4.0 + L.param_a * 20.0) * L.scale;
    float v = sin(distance(ctx.pos, p1) * freq * TAU - L.phase)
      + sin(distance(ctx.pos, p2) * freq * TAU + L.phase * 0.8);
    v = v * 0.25 + 0.5;
    v = pow(v, 1.0 + L.param_c * 4.0);
    float amp = L.brightness * mix(1.0, 0.6 + A_mid * 0.8, aud);
    float hue = L.hue + v * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation, v * amp), v);
  }
  if (L.kind == 14) { // Fire
    float stretch = 2.0 + L.param_b * 4.0;
    vec3 p = vec3(cos(ctx.theta) * 3.0 * L.scale, sin(ctx.theta) * 3.0 * L.scale, 0.0)
      + vec3(0.0, 0.0, ctx.r01 * stretch - L.phase);
    float n = fbm3(p, 4) * 0.5 + 0.5;
    float reach = 0.4 + L.param_a * 0.6 + aud * A_bass * 0.35;
    float heat = (1.0 - ctx.r01 / max(reach, 0.05)) * 1.3 - n * 0.9;
    heat = clamp(heat, 0.0, 1.0);
    float hue = L.hue + heat * 0.12;
    float sat = clamp(1.3 - heat * 0.7, 0.0, 1.0) * L.saturation;
    float v = pow(heat, 1.4) * L.brightness;
    return vec4(hsv2rgb(hue, sat, v), heat);
  }
  if (L.kind == 16) { // Warp
    float cells = 6.0 + L.param_a * 20.0;
    float u = ctx.r01 * cells + hash01(ctx.spoke * 7919u) * 13.0;
    float flow = u + L.phase;
    uint cell = L.phase_epoch + uint(flow);
    float f = fract(flow);
    float threshold = 1.0 - (0.15 + L.param_a * 0.2);
    float star0 = step(threshold, hash01(cell * 6151u + ctx.spoke * 389u));
    float star1 = step(threshold, hash01((cell + 1u) * 6151u + ctx.spoke * 389u));
    float streak = max(star0 * (1.0 - f) * (1.0 - f), star1 * f * f);
    float persp = 0.35 + (1.0 - ctx.r01) * 0.65;
    float v = streak * persp;
    float hue = L.hue + hash01(cell * 127u) * L.hue_range;
    return vec4(hsv2rgb(hue, L.saturation * 0.6, v * L.brightness), v);
  }
  return vec4(0.0);
}

vec3 apply_blend(vec3 acc, vec4 c, float opacity, int mode) {
  float a = clamp(c.a * opacity, 0.0, 1.0);
  vec3 rgb = c.rgb * opacity;
  if (mode == 0) return acc + rgb;
  if (mode == 1) return acc * mix(vec3(1.0), c.rgb, opacity);
  if (mode == 2) return 1.0 - (1.0 - acc) * (1.0 - clamp(rgb, 0.0, 1.0));
  if (mode == 3) return mix(acc, c.rgb, a);
  if (mode == 4) return max(acc, rgb);
  return acc;
}

// A visitor's tap: a ring that expands from where they touched and fades. The
// gate's public floor does this to the physical array; here it is the same
// idea on the same geometry.
vec3 ripple_color(vec4 R, Ctx ctx) {
  float age = R.z;
  vec2 origin = R.y * vec2(cos(R.x), sin(R.x));
  float d = distance(ctx.pos, origin);
  float front = age * 0.9;
  float width = 0.05 + age * 0.04;
  float ring = exp(-((d - front) * (d - front)) / (width * width));
  float life = max(0.0, 1.0 - age / 1.8);
  return hsv2rgb(R.w, 0.55, ring * life * life * 0.9);
}

void main() {
  int id = gl_VertexID;
  int spoke_i = id / u_drawn;
  int k = id - spoke_i * u_drawn;
  // Decimated: the k-th drawn dot on this spoke stands in for LED index i.
  float i = u_drawn > 1 ? float(k) * (u_pixels - 1.0) / float(u_drawn - 1) : 0.0;

  Ctx ctx;
  ctx.spoke = uint(spoke_i);
  ctx.i = uint(i + 0.5);
  ctx.theta = float(spoke_i) / u_spokes * TAU;
  ctx.r01 = i / max(u_pixels - 1.0, 1.0);
  ctx.rn = mix(1.0, u_inner, ctx.r01);
  ctx.pos = ctx.rn * vec2(cos(ctx.theta), sin(ctx.theta));

  vec3 outgoing = vec3(0.0);
  vec3 incoming = vec3(0.0);
  for (int l = 0; l < MAX_LAYERS; l++) {
    if (l >= u_layer_count) break;
    Layer L = get_layer(l);
    vec4 c = layer_color(L, ctx);
    if (l < u_split) outgoing = apply_blend(outgoing, c, L.opacity, L.blend);
    else incoming = apply_blend(incoming, c, L.opacity, L.blend);
  }
  vec3 acc = u_split > 0 ? mix(outgoing, incoming, clamp(u_mix, 0.0, 1.0)) : incoming;

  for (int r = 0; r < MAX_RIPPLES; r++) {
    if (r >= u_ripple_count) break;
    acc += ripple_color(u_ripple[r], ctx);
  }

  acc *= u_master;

  // Gentle soft clip: linear below 0.8, compressed knee above, hard cap at 1.
  vec3 knee = vec3(0.8);
  vec3 over = max(acc - knee, vec3(0.0));
  acc = min(acc, knee) + over / (1.0 + over * 2.5);
  v_color = clamp(acc, 0.0, 1.0);

  // On screen: spoke 0 straight up, numbered clockwise, a little margin for the halo.
  vec2 screen = ctx.rn * vec2(sin(ctx.theta), cos(ctx.theta)) * 0.96;
  gl_Position = vec4(screen, 0.0, 1.0);
  gl_PointSize = u_point_size;
}
`;

export const FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 frag;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float radius = length(d);
  float core = 1.0 - smoothstep(0.16, 0.36, radius);
  float halo = (1.0 - smoothstep(0.26, 0.5, radius)) * 0.45;
  float a = max(core, halo);
  // Premultiplied, additive: light accumulates, as it does in the air.
  frag = vec4(v_color * a, a);
}
`;
