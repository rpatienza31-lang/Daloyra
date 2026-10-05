import { expect, test } from "@playwright/test";

// Placeholder until the full smoke test (sign up → onboarding → sale → dashboard) in Phase 7.
test("landing page shows log in and start free trial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free trial" })).toBeVisible();
});
