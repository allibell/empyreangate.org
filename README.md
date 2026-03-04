# SSG Base

A boilerplate for static sites built with React Router 7, Vite, and TypeScript.

## Stack

- **React 19** + **React Router 7** — UI and routing
- **Vite** — build tool and dev server
- **TypeScript** — strict mode
- **Bun** — package manager and runtime
- **Playwright** — end-to-end testing
- **Cloudflare Pages** — deployment (via GitHub Actions)

## Getting Started

```sh
bun install
bun run dev
```

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start dev server |
| `bun run build` | Build static site |
| `bun run preview` | Preview built site |
| `bun run test` | Run Playwright tests |
| `bun run test:ui` | Run tests with Playwright UI |
| `bun run typecheck` | Type check |

## Project Structure

```
app/
  root.tsx          — HTML shell and layout
  routes.ts         — Route definitions
  routes/
    home.tsx        — Index page
    404.tsx         — Not found page
  styles/
    global.css      — Global styles (light/dark mode)
tests/
  home.spec.ts      — E2E tests
```

## Deployment

The included GitHub Actions workflow deploys to Cloudflare Pages on push to `master`.

Set up these secrets/variables in your repo:
- **Secret**: `CLOUDFLARE_API_TOKEN`
- **Variable**: `CLOUDFLARE_ACCOUNT_ID`

Update the `--project-name` in `.github/workflows/deploy.yml` to match your Cloudflare Pages project.

## Adding Routes

1. Create a new file in `app/routes/`
2. Add it to `app/routes.ts`
3. Add the path to the `prerender()` array in `react-router.config.ts`
