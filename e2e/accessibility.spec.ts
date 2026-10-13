import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Public pages: no serious accessibility problems (WCAG 2.1 AA rules) and no sideways
 * scrolling at phone width. Signed-in pages are checked the same way in the
 * end-to-end run against the dev database.
 */
const PAGES = ["/", "/login", "/signup", "/forgot-password", "/privacy", "/terms"];

for (const path of PAGES) {
  test(`${path} is accessible and fits a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(360);
  });
}

test("an unknown address asks a signed-out visitor to log in first", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page).toHaveURL(/\/login\?next=%2Fno-such-page/);
});
