/**
 * The CPU half of the renderer: what the gate's Rust engine does between
 * frames, reduced to what a web page needs.
 *
 * - Integrates each layer's phase (`LayerCfg::phase_rate` in `layers.rs`:
 *   the shader wants the integral of rate over time, not rate times time, or
 *   every speed change would jump the pattern).
 * - Splits the phase for the kinds that key a hash on its whole part
 *   (`split_phase`).
 * - Wanders parameters slowly, standing in for the engine's autopilot random
 *   walk, so nothing sits still.
 * - Synthesises an audio feature set (level, bands, beat clock), because the
 *   layers are written to breathe with music and a page has none.
 * - Crossfades scenes and tracks the visitor's taps as ripples.
 */

import { MAX_LAYERS, MAX_RIPPLES } from "./shaders";
import { blendId, kindId, type LayerSpec, type Scene } from "./presets";

interface LiveLayer {
  spec: LayerSpec;
  phase: number;
  /** Per-layer wander offset so layers don't move in lockstep. */
  seed: number;
}

export interface Ripple {
  theta: number;
  rn: number;
  born: number;
  hue: number;
}

export const BPM = 122;
export const CROSSFADE_SECONDS = 1.8;
export const RIPPLE_SECONDS = 1.8;

/** Mirrors `LayerCfg::phase_rate` in the engine. */
export function phaseRate(spec: LayerSpec, audioLevel: number): number {
  const aud = spec.audio_amount * audioLevel;
  switch (spec.kind) {
    case "spoke_chase": {
      const dir = spec.param_b > 0.5 ? -1 : 1;
      return (0.2 + spec.param_a * 1.5 + aud * 0.8) * 0.2 * dir;
    }
    case "sparkle":
      return 4 + spec.param_b * 20;
    case "warp":
      return (0.5 + spec.param_b * 2) * (1 + aud);
    default:
      return 1;
  }
}

/** Kinds whose shader keys a hash on the whole part of the phase. */
function splitsPhase(spec: LayerSpec): boolean {
  return spec.kind === "sparkle" || spec.kind === "warp";
}

export interface Audio {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beatPhase: number;
  onset: number;
}

/** A steady synthetic groove. Not music, but the layers were written for one. */
export function syntheticAudio(t: number): Audio {
  const beatPhase = ((t * BPM) / 60) % 1;
  const bar = ((t * BPM) / 240) % 1;
  const kick = Math.exp(-beatPhase * 7);
  const swell = 0.5 + 0.5 * Math.sin(t * 0.21);
  const bass = 0.18 + 0.75 * kick * (0.7 + 0.3 * swell);
  const mid = 0.35 + 0.25 * Math.sin(t * 1.7 + 1.0) + 0.15 * Math.sin(t * 4.3);
  const treble =
    0.25 +
    0.3 * Math.abs(Math.sin(t * 9.1)) * (bar > 0.5 ? 1 : 0.6) +
    0.2 * kick;
  const level = 0.3 + 0.3 * bass + 0.2 * mid + 0.1 * treble;
  return {
    level: Math.min(1, level),
    bass: Math.min(1, bass),
    mid: Math.min(1, Math.max(0, mid)),
    treble: Math.min(1, treble),
    beatPhase,
    onset: Math.exp(-beatPhase * 24),
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export class GateEngine {
  private outgoing: LiveLayer[] = [];
  private incoming: LiveLayer[] = [];
  private fadeStart = -Infinity;
  private masterSpeed = 1;
  private ripples: Ripple[] = [];
  private tiltTarget: [number, number] = [0, 0];

  /** Packed layers: four vec4 per layer, see `get_layer` in the shader. */
  readonly uniforms = new Float32Array(MAX_LAYERS * 4 * 4);
  readonly rippleUniforms = new Float32Array(MAX_RIPPLES * 4);
  layerCount = 0;
  split = 0;
  mix = 1;
  rippleCount = 0;
  audio: Audio = syntheticAudio(0);
  readonly tilt: [number, number] = [0, 0];

  constructor(scene: Scene) {
    this.incoming = scene.layers.map((spec, i) => ({
      spec,
      phase: i * 1.37,
      seed: i * 7.3,
    }));
    this.masterSpeed = scene.masterSpeed;
  }

  /** Crossfade to a new scene. The current stack fades out underneath. */
  setScene(scene: Scene, now: number): void {
    // Finish any fade in progress by dropping its outgoing stack.
    this.outgoing = this.incoming;
    this.incoming = scene.layers.map((spec, i) => ({
      spec,
      phase: i * 1.37 + now * 0.1,
      seed: i * 7.3 + now,
    }));
    // Both stacks must fit the uniform array.
    if (this.outgoing.length + this.incoming.length > MAX_LAYERS) {
      this.outgoing = this.outgoing.slice(0, MAX_LAYERS - this.incoming.length);
    }
    this.fadeStart = now;
    this.masterSpeed = scene.masterSpeed;
  }

  setTilt(x: number, y: number): void {
    this.tiltTarget = [x, y];
  }

  tap(theta: number, rn: number, now: number): void {
    const hue = (now * 0.07 + rn) % 1;
    this.ripples.push({ theta, rn, born: now, hue });
    if (this.ripples.length > MAX_RIPPLES) this.ripples.shift();
  }

  /** Advance by `dt` seconds to wall-clock `now`, then pack the uniforms. */
  step(now: number, dt: number): void {
    this.audio = syntheticAudio(now);
    const level = this.audio.level;

    // Tilt eases toward the pointer; a flick should sweep, not snap.
    const ease = 1 - Math.exp(-dt * 4);
    this.tilt[0] += (this.tiltTarget[0] - this.tilt[0]) * ease;
    this.tilt[1] += (this.tiltTarget[1] - this.tilt[1]) * ease;

    const fade = clamp01((now - this.fadeStart) / CROSSFADE_SECONDS);
    if (fade >= 1 && this.outgoing.length > 0) this.outgoing = [];
    this.mix = this.outgoing.length > 0 ? fade : 1;
    this.split = this.outgoing.length;

    const layers = [...this.outgoing, ...this.incoming];
    this.layerCount = layers.length;
    const u = this.uniforms;
    for (let l = 0; l < layers.length; l++) {
      const live = layers[l];
      const s = live.spec;
      live.phase += phaseRate(s, level) * s.speed * this.masterSpeed * dt;

      // The autopilot: parameters drift within walk_amount of where the
      // scene set them. Slow, incommensurate periods so it never repeats.
      const w = s.walk_amount * 0.35;
      const pa = clamp01(s.param_a + w * Math.sin(now * 0.071 + live.seed));
      const pb = clamp01(
        s.param_b + w * Math.sin(now * 0.053 + live.seed * 1.9),
      );
      const pc = clamp01(
        s.param_c + w * Math.sin(now * 0.043 + live.seed * 0.7),
      );
      const hue =
        s.hue + s.walk_amount * 0.08 * Math.sin(now * 0.031 + live.seed);

      let phase = live.phase;
      let epoch = 0;
      if (splitsPhase(s)) {
        epoch = Math.floor(phase);
        phase -= epoch;
      } else if (phase > 1e4) {
        // Keep phase bounded so float32 never loses the per-frame step.
        live.phase = phase = phase % 1e4;
      }

      const o = l * 16;
      u[o] = kindId(s.kind);
      u[o + 1] = blendId(s.blend);
      u[o + 2] = s.opacity;
      u[o + 3] = phase;
      u[o + 4] = s.scale;
      u[o + 5] = hue;
      u[o + 6] = s.hue_range;
      u[o + 7] = s.saturation;
      u[o + 8] = s.brightness;
      u[o + 9] = pa;
      u[o + 10] = pb;
      u[o + 11] = pc;
      u[o + 12] = s.param_d;
      u[o + 13] = epoch;
      u[o + 14] = s.audio_amount;
      u[o + 15] = s.tilt_amount;
    }

    this.ripples = this.ripples.filter((r) => now - r.born < RIPPLE_SECONDS);
    this.rippleCount = this.ripples.length;
    const r = this.rippleUniforms;
    for (let i = 0; i < this.ripples.length; i++) {
      const rp = this.ripples[i];
      r[i * 4] = rp.theta;
      r[i * 4 + 1] = rp.rn;
      r[i * 4 + 2] = now - rp.born;
      r[i * 4 + 3] = rp.hue;
    }
  }
}
