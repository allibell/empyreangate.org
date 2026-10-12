# empyreangate.org

The website for [The Empyrean Gate](https://empyreangate.org), the Entheos
community's ring of light over a dance floor: sixty-four spokes of LEDs, a
gateway, and a fire beneath it. The gate's own software lives at
[TomSawyerLabs/empyrean-gate](https://github.com/TomSawyerLabs/empyrean-gate).

## Stack

Built from [cinderblock/ssg-base](https://github.com/cinderblock/ssg-base):
React 19 + React Router 8, Vite, TypeScript, Bun, Playwright, oxfmt + lefthook.
Fully prerendered; there is no server at runtime. The one piece of live code is
the WebGL render of the array on the home page.

## Getting started

```sh
bun install
bun run dev
```

| Script              | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `bun run dev`       | Dev server on :5173                                       |
| `bun run build`     | Prerender to `build/client`, then emit 404.html + sitemap |
| `bun run preview`   | Serve the built site on :4180                             |
| `bun run test`      | Playwright, against a fresh build (not the dev server)    |
| `bun run test:unit` | Bun unit tests for the render engine                      |
| `bun run typecheck` | `react-router typegen && tsc`                             |
| `bun run fmt`       | Format with oxfmt                                         |
| `bun run photos`    | Web renditions of `photos/` + the photo manifest          |
| `bun run og`        | Regenerate `public/og.png` from the built hero            |

## Structure

```
app/
  root.tsx                HTML shell
  routes.ts               Route table: / and a real /404
  routes/home.tsx         The single page
  routes/404.tsx          Not found
  content/                Everything editable without touching layout:
    site.ts                 names, URLs, the next event, the array in numbers
    story.ts                prose, the timeline of appearances
    credits.ts              who made it
    gallery.ts              photo slots, each naming an original in photos/
    photo-manifest.ts       generated: sizes of the web renditions
  components/GateRender.tsx  The live render: WebGL2 canvas, scene chips, pause
  gate/
    geometry.ts             64 spokes x 378 px, inner/outer radius
    shaders.ts              GLSL port of a slice of the gate's WGSL layer shader
    presets.ts              Scenes: stacks of layers, starting with the house stack
    engine.ts               Phase integration, parameter wander, synthetic beat,
                            crossfades, ripples; the CPU half of the renderer
  styles/global.css       Everything visual
photos/                   High-resolution originals, committed (see its README)
scripts/photos.ts         Resizes photos/ into public/photos/ (gitignored) + manifest
scripts/postbuild.ts      404.html + sitemap.xml from the prerendered routes
scripts/og.ts             Screenshots the hero into public/og.png
tests/                    Playwright: content, render states, responsiveness
plans/                    Working notes; start with empyreangate-site.md
wrangler.jsonc            Cloudflare Workers static-assets config
```

## The render

The gate's engine evaluates every light as a pure function of its polar
position and a per-layer phase, on the GPU, every frame. That makes a browser
port straightforward: `app/gate/shaders.ts` is a vertex shader that runs the
same maths once per drawn LED (one `gl.POINTS` draw, positions derived from
`gl_VertexID`), and `engine.ts` mirrors the CPU-side bookkeeping. Fifteen of
the engine's layer kinds are ported; audio-reactive terms are fed by a
synthetic beat clock. Pointer movement tilts the fields; a tap drops a ripple.

It pauses when off-screen, when the tab is hidden, and under
`prefers-reduced-motion` (with a Play button to override), and falls back to a
still SVG of the ring where WebGL2 isn't available.

## Photos

Originals are committed in `photos/`; there won't be many. `bun run build`
runs `bun run photos` first, which writes WebP renditions at 800/1600/2400 px
and a JPEG fallback into `public/photos/` (gitignored, so Cloudflare rebuilds
them from the originals) and regenerates `app/content/photo-manifest.ts` with
their dimensions. EXIF, GPS included, is stripped. A slot in
`app/content/gallery.ts` points at an original by its slug.

## Deployment

**Cloudflare Workers Builds** builds this repo with `bun run build` and ships
it as Workers static assets, using `wrangler.jsonc`. GitHub Actions runs the
checks (format, typecheck, build, Playwright) on pushes and pull requests but
never deploys and holds no Cloudflare credential.

| Push to                | Workers Builds runs             | Result                                                                          |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| any branch but master  | `npx wrangler preview`          | A Preview at `https://<branch>-empyreangate-org.isozilla.workers.dev` (noindex) |
| `master`, pre-launch   | `bunx wrangler versions upload` | A new version, **not** made live; empyreangate.org is unchanged                 |
| `master`, after launch | `bunx wrangler deploy`          | Live at https://empyreangate.org                                                |

Day to day, work on a branch (`dev`, or one per change) and open the Preview
URL Cloudflare reports on the build. Going live is a dashboard change: set the
deploy command to `bunx wrangler deploy` and push (or retry) a master build.

Workers Builds settings, for reference: production branch `master`, build
command `bun run build`, build variable `BUN_VERSION` matching the Bun that
wrote `bun.lock` (the image's default Bun is older), preview builds enabled.

The worker, the custom domain, and the redirects (`www.`, and both
`empyreangate.com` hostnames, all to `https://empyreangate.org/`) are managed
in [cinderblock/ops](https://github.com/cinderblock/ops).

## Contributing

Pull requests are welcome, especially photos and corrections to the timeline in
`app/content/story.ts`. CI runs the same checks as `bun run fmt:check`,
`bun run typecheck`, `bun run test:unit` and `bun run test`.
