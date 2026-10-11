/**
 * The physical array, as the engine models it
 * (TomSawyerLabs/empyrean-gate, `src-tauri/src/config.rs` + `geometry.rs`).
 *
 * Pixel index convention everywhere: `idx = spoke * PIXELS + i`, where `i = 0`
 * is the OUTER end of the spoke (strings are fed from the outside) and the
 * last pixel sits at the inner radius.
 */
export const SPOKES = 64;
export const PIXELS = 378;
export const OUTER_RADIUS_FT = 25;
export const INNER_RADIUS_FT = 8;
/** Inner radius as a fraction of the outer one: the hole in the ring. */
export const INNER_OVER_OUTER = INNER_RADIUS_FT / OUTER_RADIUS_FT;
export const TOTAL_PIXELS = SPOKES * PIXELS;

export const TAU = Math.PI * 2;

/**
 * A unit-circle screen point (spoke 0 straight up, spokes numbered clockwise,
 * the way the operator UI draws the array) back to pattern-space polar
 * coordinates, where spoke 0 lies along +x and angles run counter-clockwise.
 */
export function fromScreen(
  x: number,
  y: number,
): { theta: number; rn: number } {
  return { theta: Math.atan2(x, y), rn: Math.hypot(x, y) };
}
