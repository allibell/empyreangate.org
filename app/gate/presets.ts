import { BLEND, KIND, type BlendMode, type LayerKind } from "./shaders";

/**
 * One layer of a scene, with the same fields the engine's `LayerCfg` carries
 * (TomSawyerLabs/empyrean-gate, `src/types.ts`). Phase is not here: it is
 * integrated per frame by the renderer, mirroring `LayerCfg::phase_rate`.
 */
export interface LayerSpec {
  kind: LayerKind;
  blend: BlendMode;
  opacity: number;
  speed: number;
  scale: number;
  audio_amount: number;
  hue: number;
  hue_range: number;
  saturation: number;
  brightness: number;
  tilt_amount: number;
  walk_amount: number;
  param_a: number;
  param_b: number;
  param_c: number;
  param_d: number;
}

export interface Scene {
  id: string;
  name: string;
  /** One line for the chip's accessible description. */
  blurb: string;
  masterSpeed: number;
  layers: LayerSpec[];
}

/** The engine's `defaultLayer`, so a preset only states what it changes. */
export function layer(
  kind: LayerKind,
  values: Partial<Omit<LayerSpec, "kind">> = {},
): LayerSpec {
  return {
    kind,
    blend: "add",
    opacity: 1,
    speed: 1,
    scale: 1,
    audio_amount: 0.5,
    hue: 0.6,
    hue_range: 0.2,
    saturation: 0.9,
    brightness: 1,
    tilt_amount: 0,
    walk_amount: 0.25,
    param_a: 0.5,
    param_b: 0.5,
    param_c: 0.5,
    param_d: 0.5,
    ...values,
  };
}

/**
 * Scenes the site can show. The first is the gate's own house stack, the
 * default config a fresh install ships with, so what loads is what the piece
 * actually looks like on an ordinary night.
 */
export const SCENES: Scene[] = [
  {
    id: "house",
    name: "House",
    blurb:
      "The default stack: a nebula, harmonic rings, treble glitter and a ring on every beat.",
    masterSpeed: 1,
    layers: [
      layer("noise_color", {
        blend: "alpha_over",
        speed: 0.25,
        scale: 1.2,
        audio_amount: 0.3,
        hue: 0.65,
        hue_range: 0.25,
        saturation: 0.9,
        brightness: 0.5,
        tilt_amount: 0.6,
      }),
      layer("radial_waves", {
        opacity: 0.6,
        audio_amount: 0.8,
        hue: 0.55,
        hue_range: 0.1,
        param_a: 0.3,
        param_b: 0.4,
      }),
      layer("sparkle", {
        opacity: 0.7,
        audio_amount: 0.9,
        hue: 0.12,
        hue_range: 0.05,
        saturation: 0.3,
        param_a: 0.15,
      }),
      layer("beat_rings", {
        opacity: 0.8,
        audio_amount: 1,
        hue: 0.85,
        hue_range: 0,
        param_a: 0.08,
      }),
    ],
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Flames climbing in from the rim toward the cauldron.",
    masterSpeed: 1,
    layers: [
      layer("solid", {
        blend: "alpha_over",
        hue: 0.02,
        saturation: 0.9,
        brightness: 0.05,
        audio_amount: 0,
      }),
      layer("fire", {
        speed: 1.4,
        scale: 0.9,
        audio_amount: 0.6,
        hue: 0.0,
        saturation: 1,
        brightness: 1.1,
        param_a: 0.55,
        param_b: 0.5,
      }),
      layer("sparkle", {
        opacity: 0.5,
        audio_amount: 0.6,
        hue: 0.09,
        hue_range: 0.04,
        saturation: 0.5,
        brightness: 0.9,
        param_a: 0.08,
      }),
    ],
  },
  {
    id: "spiral",
    name: "Spiral",
    blurb: "Four arms, twisting tighter toward the centre, over a slow plasma.",
    masterSpeed: 0.9,
    layers: [
      layer("plasma", {
        blend: "alpha_over",
        speed: 0.3,
        scale: 0.6,
        audio_amount: 0.2,
        hue: 0.72,
        hue_range: 0.18,
        saturation: 0.85,
        brightness: 0.28,
        tilt_amount: 0.4,
      }),
      layer("spiral", {
        speed: 1.2,
        audio_amount: 0.5,
        hue: 0.78,
        hue_range: 0.22,
        saturation: 0.8,
        brightness: 1,
        param_a: 0.34,
        param_b: 0.75,
        param_c: 0.35,
      }),
    ],
  },
  {
    id: "moire",
    name: "Moiré",
    blurb:
      "Two orbiting wave sources interfering, with stars streaming out behind them.",
    masterSpeed: 0.8,
    layers: [
      layer("interference", {
        speed: 1,
        scale: 0.8,
        audio_amount: 0.4,
        hue: 0.5,
        hue_range: 0.35,
        saturation: 0.85,
        brightness: 0.9,
        param_a: 0.25,
        param_b: 0.4,
        param_c: 0.3,
      }),
      layer("warp", {
        opacity: 0.8,
        audio_amount: 0.5,
        hue: 0.1,
        hue_range: 0.1,
        saturation: 0.4,
        brightness: 0.9,
        param_a: 0.35,
        param_b: 0.45,
      }),
    ],
  },
  {
    id: "chase",
    name: "Chase",
    blurb:
      "Comets running the spokes through rotating wedges, breathing with the beat.",
    masterSpeed: 1,
    layers: [
      layer("wedges", {
        blend: "alpha_over",
        speed: 0.8,
        audio_amount: 0.5,
        hue: 0.58,
        hue_range: 0.3,
        saturation: 0.8,
        brightness: 0.35,
        param_a: 0.3,
        param_b: 0.4,
        param_c: 0.2,
      }),
      layer("spoke_chase", {
        speed: 1,
        audio_amount: 0.6,
        hue: 0.12,
        hue_range: 0.5,
        saturation: 0.7,
        brightness: 1,
        param_a: 0.6,
        param_b: 0.3,
        param_c: 0.35,
      }),
      layer("breathe", {
        blend: "multiply",
        speed: 0.6,
        audio_amount: 0.8,
        param_a: 0.55,
      }),
    ],
  },
];

/** Numeric kind/blend ids for the shader. */
export function kindId(kind: LayerKind): number {
  return KIND[kind];
}
export function blendId(blend: BlendMode): number {
  return BLEND[blend];
}
