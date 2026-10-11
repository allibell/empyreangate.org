# empyreangate.org — the site

## Goal

A high-quality public website for The Empyrean Gate at `empyreangate.org`,
first-class on phones and desktops, that ranks for the piece's name, tells its
story, links the open-source software, shows photos, and carries a live,
interactive, locally rendered version of the gate's light patterns.

## Environment / context

| What                | Where / value                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Repo                | `github.com/cinderblock/empyreangate.org`, branch `master`                                                            |
| Checkout            | `C:\Users\camer\git\Personal Projects\empyreangate.org`                                                               |
| Template            | `cinderblock/ssg-base` (first commit is the pristine template)                                                        |
| Deploy              | Cloudflare Workers Builds (Cloudflare's CI), static assets, no Worker script                                          |
| Domains / redirects | `github.com/cinderblock/ops`, `cloudflare/config/projects/empyreangate.yaml`, plan `plans/empyreangate-site.md` there |
| Gate software       | `github.com/TomSawyerLabs/empyrean-gate`, local `C:\Users\camer\git\Personal Projects\Empyrean`                       |
| Worker name         | `empyreangate-org` (must match ops)                                                                                   |

## Decisions already made (don't re-ask)

- **Start from ssg-base; Workers static assets, not Pages; Workers Builds
  deploys, GitHub only checks.** No Cloudflare secret in GitHub.
- **Redirects live in ops, not in a worker script.** The site is assets-only.
- **Dark only.** The piece exists at night; a light theme would be a second
  design for no one. `color-scheme: dark`.
- **Single page + a real `/404`.** Content is thin until the photos and
  confirmed years arrive; sections with anchors beat five sparse pages.
- **Prose is data** (`app/content/*.ts`), as in hyparhuts.org, so copy can be
  edited without touching layout.
- **The live render is a WebGL2 port of the engine's own layer shader**, not a
  wasm build and not a stream from a real backend. See "The render" below.
- **Original-design credit is one line of names.** Nothing else about it
  anywhere on the site or in this repo.
- **No third-party embed services** for Instagram (Behold, Elfsight, etc.).
  Anything that pulls from Instagram is our own code against Meta's API.
- **Instagram integration is deferred** (Cameron, 2026-10-11). The page links
  `@entheosrising` and names no hashtag until one is chosen.
- **Photo originals are committed** in `photos/` (Cameron: "we won't have too
  many"). Web renditions are generated at build time, not committed.
- **People:** a names-only "The gate today" list (The Entheos Community, James
  Tramel, Cameron Tacklind, Allison Bellows, Theodore Wahrburg) and an
  "Earlier contributors" list with roles, where Eric Vicenti is credited for
  the unSCruz 2024 light software.

## The render

The engine (`src-tauri/src/engine/shaders/gate.wgsl` in the gate repo) is a
compute shader: `layer_color(L, ctx)` is a pure function of the LED's polar
position and a per-layer phase, blended across the stack, soft-clipped, then
written out over sACN. The browser UI there only displays streamed frames.

So the port is: the same per-pixel function as a **vertex shader**, one
invocation per drawn LED, positions derived from `gl_VertexID` (no attribute
buffers), drawing `gl.POINTS` with the operator UI's soft-dot fragment shader
and additive premultiplied blending on a transparent canvas.

Ported: Solid, GradientRadial, NoiseField, NoiseColor, RadialWaves, Spiral,
Plasma, SpokeChase, Sparkle, BeatRings, Breathe, Rainbow, Wedges,
Interference, Fire, Warp (15 kinds, numbered as the WGSL cases). Not ported:
Meteors, Waveform, Spectrum, Video, EntheosWeave, BrcMap, BrcPlan, GoldenRose,
the node-graph patches, game mode, effects and dabs.

CPU side (`app/gate/engine.ts`) mirrors `layers.rs`: phase is the integral of
`phase_rate * speed * master_speed`, Sparkle and Warp get `split_phase`,
parameters wander within `walk_amount` (standing in for the autopilot), and a
synthetic 122 BPM "audio" feature set feeds the audio terms. Scene changes
crossfade the way the engine does (outgoing stack / incoming stack / mix).

Interaction: pointer position tilts the noise/plasma fields (`tilt_amount`);
a tap drops an expanding ring at that polar position (the public floor's
ripple, re-done on the same geometry); chips switch scenes; Pause/Play.

Decimation: the strip is far denser than a screen, so draw
`round(span_px / 1.3)` of the 378 LEDs per spoke (min 32), dot size about
twice the spacing. DPR capped at 2. Pauses when off-screen, hidden tab, or
reduced motion. Falls back to a still SVG of 64 spokes without WebGL2.

## Plan / steps

1. [x] Clone ssg-base fresh; CI-only workflow; wrangler.jsonc; real `/404` +
       `404.html`; sitemap; robots.
2. [x] Port the shader + engine; unit tests for the engine.
3. [x] Content: hero, the piece, the light, timeline, photo slots, credits,
       footer, structured data (VisualArtwork + Event), OG/Twitter meta.
4. [x] Design: dark, Cormorant display + Inter body, sticky section heads on
       desktop, single column on phones.
5. [x] Tests: content, render states, responsive (no horizontal overflow at
       six widths), reduced motion, 404.
6. [x] Green locally (fmt, typecheck, 9 unit tests, 43 Playwright tests in
       chromium); visual pass at 393 px and 1440 px; `public/og.png` generated.
7. [ ] **← current, waiting on Cameron:** create `cinderblock/empyreangate.org`
       on GitHub, commit, push `master`, confirm CI is green there. Not done:
       no git operations without an explicit go-ahead.
8. [ ] ops: Cameron approves + pushes the domain config; connects Workers
       Builds (dashboard → the worker → Settings → Builds), build
       `bun run build`, deploy `bunx wrangler deploy`.
9. [ ] Verify live: `/`, `/nope`, both `www.` hosts and the `.com` apex.
10. [x] Photo pipeline: `photos/` originals → `bun run photos` (sharp) →
        `public/photos/` renditions + generated manifest; exercised with a
        synthetic rotated original, then removed.
11. [ ] Cameron drops the originals into `photos/`; point each slot's `asset`
        at a slug in `gallery.ts`.
12. [x] Regional years (unSCruz 2023–2025) and the crew list, from Cameron.
13. [ ] Love Burn years beyond 2024, if any.

## Later

- Instagram hashtag feed. Meta's `ig_hashtag_search` / `recent_media` need an
  Instagram Business or Creator account linked to a Facebook Page, a Meta app,
  and App Review for _Instagram Public Content Access_ (+ `instagram_basic`);
  30 unique hashtags per rolling week per account; top/recent media only.
  Shape when wanted: a cron Worker in ops pulling the tag hourly into KV,
  served as JSON the page fetches, degrading to the curated gallery when
  empty. Needs a decision on which account owns the token and which hashtag.
- A separate interactive site running the full engine (`SITE.interactiveUrl`).

## Findings / gotchas

- `#version 300 es` vertex shaders can use `gl_VertexID`, `uint` and dynamic
  uniform-array indexing, which is all the port needs; no attribute buffers at
  all. A VAO must still be bound to draw.
- The engine's `hsv2rgb` uses `fract(h)`, so hue can be any real; the presets
  rely on that for hue wander.
- `vite preview` serves `/404` from the emitted `404.html`, so the Playwright
  404 test exercises the same file Cloudflare's `not_found_handling` will.
- TypeScript needs `@types/bun` and `"types": ["vite/client", "bun"]` for
  `bun:test` imports under `react-router typegen && tsc`.
- **Line endings are LF on disk**, not CRLF, despite `core.autocrlf=true`:
  oxfmt enforces LF and `bun run fmt` rewrites CRLF files. hyparhuts.org and
  ssg-base are the same. Don't "fix" this to CRLF; `fmt:check` would fail.
- Port 4173 (ssg-base's preview default) was already taken on this machine by
  another project, so this repo previews and tests on **4180**.
- Headless Chromium renders the WebGL dots noticeably dimmer than a real GPU
  (SwiftShader, no MSAA); brightness was tuned with that in mind (`u_master`
  1.25, dot size 3x spacing) and the soft clip keeps real GPUs from blowing out.

## Open questions for the user

1. Which years did the gate go to Love Burn besides 2024? (unSCruz is settled:
   2023, 2024, 2025.)
2. Photos: drop the originals in `photos/` whenever ready; nothing else is
   needed from you for the gallery.

## Things not to do

- Don't add a deploy step with Cloudflare credentials to GitHub Actions.
- Don't rename `master`.
- Don't reference the original architect anywhere but the one credits line.
- Don't pull Instagram through a third-party widget/relay service.
- Don't use `title=` for tooltips; the chips use `aria-description`.
