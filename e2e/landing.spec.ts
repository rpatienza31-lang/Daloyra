import { expect, test } from "@playwright/test";

// Placeholder until the full smoke test (sign up → onboarding → sale → dashboard) in Phase 7.
test("landing page shows log in and start free trial", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free trial" })).toBeVisible();
});

test("signed-out visitors are sent from the app to log in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("sign-up form explains what to fix", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
});
