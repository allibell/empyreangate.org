/**
 * Which kind of build this is, from the environment Workers Builds injects.
 *
 * Workers Builds sets `WORKERS_CI=1` and `WORKERS_CI_BRANCH` on every build.
 * Pushes to `master` are production builds; every other branch becomes a
 * Worker Preview (`<branch>.empyreangate.org` / `<branch>-empyreangate-org.
 * isozilla.workers.dev`). Previews must never be indexed: Cloudflare adds
 * `X-Robots-Tag: noindex` on workers.dev but not on custom-domain Previews.
 *
 * Anywhere else (local builds, GitHub Actions) the build is treated as
 * production, which is what gets tested.
 */

export const PRODUCTION_BRANCH = "master";

export type BuildKind = "production" | "preview";

export function buildKind(env: Record<string, string | undefined>): BuildKind {
  if (env.WORKERS_CI !== "1") return "production";
  const branch = env.WORKERS_CI_BRANCH;
  if (!branch) {
    throw new Error(
      "WORKERS_CI is set but WORKERS_CI_BRANCH is empty; can't tell a preview from production",
    );
  }
  return branch === PRODUCTION_BRANCH ? "production" : "preview";
}

/** `_headers` for a preview: every response says noindex. */
export const PREVIEW_HEADERS = `/*
  X-Robots-Tag: noindex
`;

/** robots.txt for a preview: crawl nothing. */
export const PREVIEW_ROBOTS = `User-agent: *
Disallow: /
`;
