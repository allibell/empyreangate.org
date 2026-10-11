import { expect, test } from "@playwright/test";

/**
 * Narrow-viewport checks. Horizontal overflow on a phone is the specific
 * failure worth guarding: easy to introduce, invisible on a desktop.
 */

const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 15", width: 393, height: 852 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "just under the layout breakpoint", width: 959, height: 900 },
  { name: "just over the layout breakpoint", width: 961, height: 900 },
  { name: "wide desktop", width: 1600, height: 900 },
];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}px)`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
    });

    test("does not scroll horizontally", async ({ page }) => {
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `page is ${overflow.scrollWidth - overflow.clientWidth}px wider than the viewport`,
      ).toBeLessThanOrEqual(overflow.clientWidth);
    });

    test("has no element wider than the viewport", async ({ page }) => {
      const wide = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return [...document.querySelectorAll("body *")]
          .filter((el) => {
            // The header nav is allowed to scroll inside itself.
            if (el.closest(".site-header nav")) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > vw + 1 || r.left < -1);
          })
          .map((el) =>
            `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80),
          );
      });
      expect(wide).toEqual([]);
    });

    test("the ring fits inside the viewport", async ({ page }) => {
      const box = await page.locator(".gate-stage").boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(vp.width);
      expect(box!.height).toBeLessThanOrEqual(vp.height);
      expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
    });

    test("keeps body text readable", async ({ page }) => {
      const size = await page.evaluate(() => {
        const p = document.querySelector(".section-body p");
        return p ? parseFloat(getComputedStyle(p).fontSize) : 0;
      });
      expect(size).toBeGreaterThanOrEqual(16);
    });

    test("stacks the hero below the breakpoint", async ({ page }) => {
      const stacked = await page.evaluate(() => {
        const copy = document
          .querySelector(".hero-copy")
          ?.getBoundingClientRect();
        const render = document
          .querySelector(".hero-render")
          ?.getBoundingClientRect();
        if (!copy || !render) return null;
        return copy.bottom <= render.top + 1 || render.bottom <= copy.top + 1;
      });
      // 60rem = 960px at the default root size.
      expect(stacked).toBe(vp.width < 960);
    });
  });
}
