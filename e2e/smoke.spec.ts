import { expect, test } from "@playwright/test";

/**
 * Launch smoke test (SPEC Section 15): log in → set up the business if needed → record a
 * sale → see it on the dashboard. It needs a real, confirmed account, so it runs only when
 * E2E_SMOKE_EMAIL and E2E_SMOKE_PASSWORD are set, e.g. against the live site after deploy:
 *
 *   E2E_BASE_URL=https://daloyra.vercel.app E2E_SMOKE_EMAIL=… E2E_SMOKE_PASSWORD=… \
 *     npx playwright test e2e/smoke.spec.ts
 *
 * Use a dedicated test account: the test records a real ₱1.00 sale (cancel it afterwards).
 */
const email = process.env.E2E_SMOKE_EMAIL;
const password = process.env.E2E_SMOKE_PASSWORD;

test.skip(!email || !password, "Set E2E_SMOKE_EMAIL and E2E_SMOKE_PASSWORD to run the smoke test.");

function peso(text: string | null): number {
  // Display text only: "₱1,234.50" → 123450 centavos, compared as whole numbers.
  const digits = (text ?? "").replace(/[^\d-]/g, "");
  return Number.parseInt(digits || "0", 10);
}

test("log in, record a sale, see it on the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/onboarding|dashboard/, { timeout: 30_000 });
  // A new account is sent on to business setup; wait until the app has settled.
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  if (page.url().includes("onboarding")) {
    await page.getByLabel("Business name").fill("Smoke Test Shop");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL(/dashboard/, { timeout: 30_000 });
  }

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const salesToday = page.getByTestId("sales-today");
  const before = (await salesToday.count()) > 0 ? peso(await salesToday.textContent()) : 0;

  await page.goto("/sales/new");
  await page.getByLabel("Amount").fill("1");
  await page.getByRole("button", { name: "Save sale" }).click();
  await page.waitForURL(/sales\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /^Sale S-\d+/ })).toBeVisible();

  await page.goto("/dashboard");
  await expect(salesToday).toBeVisible();
  expect(peso(await salesToday.textContent())).toBe(before + 100);
});
