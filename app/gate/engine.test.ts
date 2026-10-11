import { describe, expect, test } from "bun:test";
import {
  CROSSFADE_SECONDS,
  GateEngine,
  phaseRate,
  syntheticAudio,
} from "./engine";
import { SCENES, layer } from "./presets";
import { KIND, MAX_LAYERS } from "./shaders";

describe("syntheticAudio", () => {
  test("every feature stays inside [0, 1] across a long run", () => {
    for (let t = 0; t < 600; t += 0.013) {
      const a = syntheticAudio(t);
      for (const [k, v] of Object.entries(a)) {
        expect(v, `${k} at t=${t}`).toBeGreaterThanOrEqual(0);
        expect(v, `${k} at t=${t}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("the beat clock wraps once per beat", () => {
    const a = syntheticAudio(60 / 122 - 0.001);
    const b = syntheticAudio(60 / 122 + 0.001);
    expect(a.beatPhase).toBeGreaterThan(0.9);
    expect(b.beatPhase).toBeLessThan(0.1);
  });
});

describe("phaseRate", () => {
  test("mirrors the engine's special cases and defaults to 1", () => {
    expect(phaseRate(layer("plasma"), 0.5)).toBe(1);
    expect(phaseRate(layer("sparkle", { param_b: 0.5 }), 0)).toBe(14);
    expect(phaseRate(layer("spoke_chase", { param_b: 0.9 }), 0)).toBeLessThan(
      0,
    );
    expect(phaseRate(layer("warp", { param_b: 0 }), 0)).toBeCloseTo(0.5);
  });
});

describe("GateEngine", () => {
  test("packs the house stack into the uniform layout the shader reads", () => {
    const engine = new GateEngine(SCENES[0]);
    engine.step(0.5, 1 / 60);
    expect(engine.layerCount).toBe(SCENES[0].layers.length);
    expect(engine.split).toBe(0);
    expect(engine.mix).toBe(1);
    // First layer is the nebula: kind, blend, opacity in the first vec4.
    expect(engine.uniforms[0]).toBe(KIND.noise_color);
    expect(engine.uniforms[1]).toBe(3); // alpha_over
    expect(engine.uniforms[2]).toBe(1);
  });

  test("phase integrates with dt rather than jumping with rate", () => {
    const engine = new GateEngine({
      id: "t",
      name: "t",
      blurb: "",
      masterSpeed: 2,
      layers: [layer("plasma", { speed: 1.5, walk_amount: 0 })],
    });
    engine.step(1, 0.5);
    const first = engine.uniforms[3];
    engine.step(1.5, 0.5);
    const second = engine.uniforms[3];
    // rate 1 * speed 1.5 * master 2 * dt 0.5 = 1.5 per step
    expect(second - first).toBeCloseTo(1.5);
  });

  test("sparkle splits its phase into an epoch and a fraction", () => {
    const engine = new GateEngine({
      id: "t",
      name: "t",
      blurb: "",
      masterSpeed: 1,
      layers: [layer("sparkle", { param_b: 0.5, walk_amount: 0 })],
    });
    engine.step(0, 1); // rate 14 * 1 s = 14.0 of phase
    expect(engine.uniforms[3]).toBeGreaterThanOrEqual(0);
    expect(engine.uniforms[3]).toBeLessThan(1);
    expect(engine.uniforms[13]).toBeGreaterThanOrEqual(14);
  });

  test("a scene change crossfades and then drops the outgoing stack", () => {
    const engine = new GateEngine(SCENES[0]);
    engine.step(0, 1 / 60);
    engine.setScene(SCENES[1], 10);
    engine.step(10 + CROSSFADE_SECONDS / 2, 1 / 60);
    expect(engine.split).toBe(SCENES[0].layers.length);
    expect(engine.layerCount).toBe(
      SCENES[0].layers.length + SCENES[1].layers.length,
    );
    expect(engine.mix).toBeCloseTo(0.5, 1);
    engine.step(10 + CROSSFADE_SECONDS + 0.1, 1 / 60);
    expect(engine.split).toBe(0);
    expect(engine.layerCount).toBe(SCENES[1].layers.length);
    expect(engine.mix).toBe(1);
  });

  test("every pair of scenes fits the uniform array mid-crossfade", () => {
    for (const a of SCENES) {
      for (const b of SCENES) {
        expect(a.layers.length + b.layers.length).toBeLessThanOrEqual(
          MAX_LAYERS,
        );
      }
    }
  });

  test("taps become ripples that expire", () => {
    const engine = new GateEngine(SCENES[0]);
    engine.tap(1, 0.5, 0);
    engine.step(0.1, 0.1);
    expect(engine.rippleCount).toBe(1);
    expect(engine.rippleUniforms[2]).toBeCloseTo(0.1);
    engine.step(5, 0.1);
    expect(engine.rippleCount).toBe(0);
  });
});
