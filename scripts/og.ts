/**
 * Regenerate `public/og.png`, the social card, from the real hero.
 *
 * Builds nothing itself: expects the preview server to be up
 * (`bun run preview`) or starts one. Captures the ring mid-animation at
 * 1200x630, which is the one size every network accepts.
 *
 *   bun run og
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const URL = "http://localhost:4180/";
const OUT = "public/og.png";

async function reachable(): Promise<boolean> {
  try {
    const r = await fetch(URL, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

let preview: ReturnType<typeof spawn> | undefined;
if (!(await reachable())) {
  preview = spawn("bun", ["run", "preview"], { stdio: "ignore", shell: true });
  for (let i = 0; i < 50 && !(await reachable()); i++) {
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!(await reachable())) throw new Error(`preview never came up at ${URL}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  // 1x on purpose: the dots are sized in device pixels, and at 2x they thin
  // out to hairlines once the card is scaled down in a feed.
  deviceScaleFactor: 1,
});
await page.goto(URL);
await page.waitForSelector('.gate-render[data-render-state="running"]', {
  timeout: 10_000,
});
// Let the house stack settle past its first beat so the ring is lit.
await page.waitForTimeout(1800);
await page.addStyleTag({
  content: `
    .site-header { display: none !important; }
    .hero { min-height: 0 !important; padding: 2rem 3rem !important; gap: 2rem !important; }
    .hero-actions, .hero-next { display: none !important; }
    .gate-controls { display: none !important; }
    .gate-stage { width: 34rem !important; }
  `,
});
await page.screenshot({
  path: OUT,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
preview?.kill();
console.log(`Wrote ${OUT}`);
