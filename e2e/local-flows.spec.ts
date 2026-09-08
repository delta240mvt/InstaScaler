import { expect, test } from "@playwright/test";
import { fixtureApi } from "./local-fixtures";

test("Polish login validates fields, toggles password and respects Retry-After", async ({ page }) => {
  await fixtureApi(page);
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 429, headers: { "retry-after": "125" }, contentType: "application/json", body: '{"error":"rate_limited"}' }));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `test-results/login-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText("Wpisz login i hasło.");
  await page.getByLabel("Login", { exact: true }).fill("tester");
  await page.getByLabel("Hasło", { exact: true }).fill("browser-only-password");
  await page.getByRole("button", { name: "Pokaż hasło" }).click();
  await expect(page.getByLabel("Hasło", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText("3 min.");
  await expect(page.getByRole("button", { name: "Zaloguj się", exact: true })).toBeEnabled();
});

test("real Core response shape populates dashboard and each main screen", async ({ page }) => {
  const state = await fixtureApi(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Cześć, Tester" })).toBeVisible();
  await page.screenshot({ path: `test-results/dashboard-${test.info().project.name}.png`, fullPage: true });
  for (const [path, title] of [["/overview", "Przegląd konta"], ["/campaigns", "Kampanie"], ["/campaigns/campaign1", "Poradnik testowy"], ["/campaigns/campaign1/edit", "Edytuj kampanię"], ["/campaigns/import", "Import kampanii"], ["/logs", "Dziennik aktywności"], ["/diagnostics", "Diagnostyka"], ["/settings", "Ustawienia"]]) {
    await page.goto(path);
    if (path.endsWith("/edit")) await expect(page.getByLabel(/Nazwa kampanii/)).toHaveValue("Poradnik testowy");
    else await expect(page.getByRole("main").getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText("Sprawdzanie sesji", { exact: true })).toHaveCount(0);
    if (path === "/diagnostics") await expect(page.getByText("Brak nierozwiązanych incydentów.", { exact: true })).toBeVisible();
    if (path === "/settings") await expect(page.getByRole("button", { name: "Odłącz", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path).toBe(true);
  }
  expect(errors).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test("successful login returns to a local destination and malformed callback stays usable", async ({ page }) => {
  await fixtureApi(page);
  await page.goto("/login?callbackUrl=/campaigns&callbackUrl=/settings");
  await expect(page.getByLabel("Login", { exact: true })).toBeVisible();
  await page.goto("/login?callbackUrl=/campaigns");
  await page.getByLabel("Login", { exact: true }).fill("tester");
  await page.getByLabel("Hasło", { exact: true }).fill("browser-only-password");
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByRole("heading", { name: "Poradnik testowy", exact: true })).toBeVisible();
});

test("campaign pause and delete keep data unchanged after API rejection", async ({ page }) => {
  const state = await fixtureApi(page, { rejectMutations: true });
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Wstrzymaj Poradnik testowy" }).click();
  await expect(page.locator('main [role="alert"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Wstrzymaj Poradnik testowy" })).toBeEnabled();
  await page.getByRole("button", { name: "Więcej działań" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Usuń", exact: true }).click();
  await expect.poll(() => state.mutations.filter((m) => m.method === "DELETE").length).toBe(1);
  await expect(page.getByRole("button", { name: "Wstrzymaj Poradnik testowy" })).toBeVisible();
  expect(state.campaigns).toHaveLength(1);
});

test("campaign edit persists Polish content through the existing API", async ({ page }) => {
  const state = await fixtureApi(page);
  await page.goto("/campaigns/campaign1/edit");
  await page.getByLabel(/Nazwa kampanii/).fill("Zażółć gęślą jaźń");
  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect.poll(() => state.mutations.length).toBe(1);
  expect(state.mutations[0].body.name).toBe("Zażółć gęślą jaźń");
  expect(state.mutations[0].body.dmMessage).toContain("Oto Twój poradnik");
  await expect(page).toHaveURL(/\/campaigns(?:\/campaign1)?$/);
});

test("CSV import prefills the campaign and allows skipping the row", async ({ page }) => {
  await fixtureApi(page);
  await page.goto("/campaigns/import");
  await page.locator("textarea").fill('keywords,dm_message,name\nPORADNIK,Zażółć gęślą jaźń,Kampania z CSV');
  await page.getByRole("button", { name: "Sprawdź i importuj", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/new$/);
  await expect(page.getByLabel(/Nazwa kampanii/)).toHaveValue("Kampania z CSV");
  await expect(page.getByPlaceholder("Napisz wiadomość", { exact: true })).toHaveValue("Zażółć gęślą jaźń");
  await page.getByRole("button", { name: "Pomiń i zakończ" }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
});

test("inbox displays received messages and sends a reply", async ({ page }) => {
  const state = await fixtureApi(page);
  await page.goto("/inbox");
  await page.getByRole("button", { name: /@ania_test/ }).click();
  await expect(page.getByText("Wiadomość Ani", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Treść odpowiedzi" }).fill("Dziękuję za wiadomość!");
  await page.getByRole("textbox", { name: "Treść odpowiedzi" }).press("Enter");
  await expect.poll(() => state.messages).toEqual(["Dziękuję za wiadomość!"]);
  await expect(page.getByRole("textbox", { name: "Treść odpowiedzi" })).toHaveValue("");
});

test("inbox with no accounts reaches an actionable empty state", async ({ page }) => {
  await fixtureApi(page, { noAccounts: true });
  await page.goto("/inbox");
  await expect(page.getByRole("banner").getByRole("button", { name: /Połącz/ })).toBeVisible();
  await expect(page.getByRole("main").getByText("Nie ma jeszcze rozmów.", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText("Ładowanie…", { exact: true })).toHaveCount(0);
});

test("public report uses aggregate totals and local number formatting", async ({ page }) => {
  await fixtureApi(page);
  await page.context().clearCookies();
  await page.goto("/reports/demo");
  await expect(page.getByRole("heading", { name: "Poradnik testowy" })).toBeVisible();
  await expect(page.getByText("Publiczny raport kampanii")).toBeVisible();
  await expect(page.getByText("40%", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu główne" })).toHaveCount(0);
});

test("public report distinguishes outage from a missing share", async ({ page }) => {
  await fixtureApi(page, { reportFailure: 503 });
  await page.goto("/reports/demo");
  await expect(page.getByRole("heading", { name: "Raport jest chwilowo niedostępny" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Spróbuj ponownie" })).toBeVisible();
});

test("public Polish pages render without authentication", async ({ page }) => {
  for (const path of ["/privacy", "/terms", "/data-deletion", "/meta-review"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zaloguj się" })).toBeVisible();
  }
});

test("mobile navigation opens and closes using keyboard", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile navigation only");
  await fixtureApi(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Otwórz nawigację" }).click();
  await expect(page.getByRole("dialog", { name: "Nawigacja główna" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
