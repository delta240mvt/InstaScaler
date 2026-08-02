import { expect, test } from "@playwright/test";

test("administrator smoke flow", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_LOGIN || !process.env.E2E_ADMIN_PASSWORD, "E2E credentials are required");
  await page.goto("/login");
  await page.getByLabel("Login").fill(process.env.E2E_ADMIN_LOGIN!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
  await page.goto("/campaigns/new");
  await expect(page.getByText(/follow/i).first()).toBeVisible();
  await page.goto("/diagnostics");
  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("shared campaign report remains public", async ({ page }) => {
  test.skip(!process.env.E2E_REPORT_SLUG, "A public report slug is required");
  await page.goto(`/reports/${process.env.E2E_REPORT_SLUG}`);
  await expect(page.getByText("Public campaign report")).toBeVisible();
});
