import { expect, test, type Page } from "@playwright/test";
import { fixtureApi } from "./local-fixtures";

test("follower history draws a visible line and switches between chart and table", async ({ page }, testInfo) => {
  await fixtureApi(page);
  const history = Array.from({ length: 36 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 7, 4 + index)).toISOString(),
    followersCount: 8895 + Math.round((445 * index) / 35),
    backfilled: false,
  }));
  await page.route("**/api/instagram/follower-history?**", (route) => route.fulfill({
    contentType: "application/json", body: JSON.stringify({ data: history }),
  }));
  await page.goto("/overview");
  const chart = page.locator(".app-card").filter({ has: page.getByRole("heading", { name: "Historia liczby obserwujących" }) });
  await expect(chart).toContainText("9340 obecnie");
  await expect(chart).toContainText("+445");
  const line = chart.locator(".recharts-line-curve");
  await expect(line).toBeVisible();
  await expect(line).not.toHaveCSS("stroke", "none");
  await expect(line).not.toHaveCSS("stroke", "rgba(0, 0, 0, 0)");
  const bounds = await line.evaluate((element) => {
    const { width, height } = (element as SVGGraphicsElement).getBBox();
    return { width, height };
  });
  expect(bounds.width).toBeGreaterThan(100);
  expect(bounds.height).toBeGreaterThan(50);
  await chart.screenshot({ path: testInfo.outputPath("follower-chart.png") });
  await page.getByRole("button", { name: "Pokaż tabelę", exact: true }).click();
  await expect(chart.locator("tbody tr")).toHaveCount(36);
  await expect(chart.locator("tbody tr").first()).toContainText("9340");
  await page.getByRole("button", { name: "Pokaż wykres", exact: true }).click();
  await expect(line).toBeVisible();
  await expect(line).not.toHaveCSS("stroke", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

async function fillNewCampaign(page: Page, name: string, message: string) {
  await expect(page.getByRole("main").getByText("konto_testowe", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "dowolny post lub rolkę", exact: true }).click();
  await page.getByLabel(/Nazwa kampanii/).fill(name);
  await page.getByRole("textbox", { name: "Słowa kluczowe", exact: true }).fill("PORADNIK, ZAŻÓŁĆ");
  await page.getByRole("textbox", { name: "Treść wiadomości z linkiem", exact: true }).fill(message);
}

test("new campaign validates required fields and creates the reviewed Polish draft", async ({ page }) => {
  const state = await fixtureApi(page);
  await page.goto("/campaigns/new");
  await expect(page.getByRole("main").getByText("konto_testowe", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "dowolny post lub rolkę", exact: true }).click();
  await page.getByRole("button", { name: "Uruchom", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText("Dodaj co najmniej jedno słowo kluczowe lub wybierz dowolne słowo.");
  expect(state.mutations).toEqual([]);

  await fillNewCampaign(page, "Nowy poradnik zażółć", "Cześć {username}, oto bezpłatny poradnik.");
  await page.getByRole("button", { name: "Uruchom", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns$/);
  await expect(page.getByRole("heading", { name: "Nowy poradnik zażółć", exact: true })).toBeVisible();
  expect(state.mutations).toHaveLength(1);
  expect(state.mutations[0]).toMatchObject({ method: "POST", path: "/api/automations", body: {
    name: "Nowy poradnik zażółć", instagramAccountId: "acc1", matchAnyPost: true,
    postId: null, pendingNextReel: false, matchAnyWord: false, keywords: ["PORADNIK", "ZAŻÓŁĆ"],
    dmMessage: "Cześć {username}, oto bezpłatny poradnik.", isActive: true,
  } });
  expect(state.campaigns).toHaveLength(2);
  expect(state.unexpected).toEqual([]);
});

test("failed campaign creation retains the form and allows retry", async ({ page }) => {
  const state = await fixtureApi(page, { rejectMutations: true });
  await page.goto("/campaigns/new");
  await fillNewCampaign(page, "Szkic po awarii", "Nie zgub tej wiadomości: żółć i źdźbło.");
  await page.getByRole("button", { name: "Uruchom", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText("Usługa jest chwilowo niedostępna. Spróbuj ponownie później.");
  await expect(page).toHaveURL(/\/campaigns\/new$/);
  await expect(page.getByLabel(/Nazwa kampanii/)).toHaveValue("Szkic po awarii");
  await expect(page.getByRole("textbox", { name: "Słowa kluczowe", exact: true })).toHaveValue("PORADNIK, ZAŻÓŁĆ");
  await expect(page.getByRole("textbox", { name: "Treść wiadomości z linkiem", exact: true })).toHaveValue("Nie zgub tej wiadomości: żółć i źdźbło.");
  await expect(page.getByRole("button", { name: "dowolny post lub rolkę", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Uruchom", exact: true })).toBeEnabled();
  expect(state.mutations).toHaveLength(1);
  expect(state.campaigns).toHaveLength(1);
});

test("a delayed previous thread cannot replace the selected conversation", async ({ page }) => {
  await fixtureApi(page);
  let releaseFirst: () => void = () => {};
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let markFirstRequested: () => void = () => {};
  const firstRequested = new Promise<void>((resolve) => { markFirstRequested = resolve; });
  await page.route("**/api/instagram/conversations/thread1?**", async (route) => {
    markFirstRequested();
    await firstGate;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { messages: [
      { id: "late-ania", text: "Spóźniona wiadomość Ani", fromMe: false, createdTime: "2026-09-08T08:00:00Z" },
    ] } }) });
  });

  try {
    await page.goto("/inbox");
    await page.getByRole("button", { name: /@ania_test/ }).click();
    await firstRequested;
    const back = page.getByRole("button", { name: "Wróć do rozmów", exact: true });
    if (await back.isVisible()) await back.click();
    await page.getByRole("button", { name: /@jan_test/ }).click();
    await expect(page.getByText("Wiadomość Jana", { exact: true })).toBeVisible();
    const lateResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/instagram/conversations/thread1");
    releaseFirst();
    await (await lateResponse).finished();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[aria-label="Treść rozmowy"]')).toContainText("@jan_test");
    await expect(page.getByText("Wiadomość Jana", { exact: true })).toBeVisible();
    await expect(page.getByText("Spóźniona wiadomość Ani", { exact: true })).toHaveCount(0);
  } finally {
    releaseFirst();
  }
});

test("signing out clears private Instagram caches and preserves unrelated preferences", async ({ page }) => {
  await fixtureApi(page);
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Wyloguj się", exact: true })).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem("inbox:msgs:thread1", JSON.stringify({ data: [{ text: "Prywatna wiadomość" }], ts: Date.now() }));
    sessionStorage.setItem("inbox:convs:acc1", JSON.stringify({ data: [{ id: "thread1" }], ts: Date.now() }));
    sessionStorage.setItem("ig-posts:acc1", JSON.stringify({ data: [{ id: "post1" }], ts: Date.now() }));
    sessionStorage.setItem("inbox:selectedAccount", "acc1");
    sessionStorage.setItem("extra-test-preference", "zachowaj");
  });
  const logoutRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/logout" && request.method() === "POST");
  await page.getByRole("button", { name: "Wyloguj się", exact: true }).click();
  await logoutRequest;
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  expect(await page.evaluate(() => ({
    messages: sessionStorage.getItem("inbox:msgs:thread1"), conversations: sessionStorage.getItem("inbox:convs:acc1"),
    posts: sessionStorage.getItem("ig-posts:acc1"), account: sessionStorage.getItem("inbox:selectedAccount"),
    preference: sessionStorage.getItem("extra-test-preference"),
  }))).toEqual({ messages: null, conversations: null, posts: null, account: null, preference: "zachowaj" });
});

test("a rejected disconnect leaves the account connected and the control available", async ({ page }) => {
  await fixtureApi(page);
  let requestedAccount: string | null = null;
  await page.route("**/api/instagram/disconnect?**", async (route) => {
    requestedAccount = new URL(route.request().url()).searchParams.get("id");
    expect(route.request().method()).toBe("DELETE");
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"service_unavailable"}' });
  });
  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Odłącz", exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText("Usługa jest chwilowo niedostępna. Spróbuj ponownie później.");
  await expect(page.getByRole("main").getByText("@konto_testowe", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Odłącz", exact: true })).toBeEnabled();
  await expect(page.getByRole("main").getByText("Nie połączono żadnego konta.", { exact: true })).toHaveCount(0);
  expect(requestedAccount).toBe("acc1");
});

test("closed mobile navigation stays outside the keyboard focus order", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) >= 1024, "The mobile drawer is used below 1024px.");
  await fixtureApi(page);
  await page.goto("/dashboard");
  const open = page.getByRole("button", { name: "Otwórz nawigację", exact: true });
  await open.click();
  await expect(page.getByRole("dialog", { name: "Nawigacja główna" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await expect(page.locator('aside[aria-label="Nawigacja główna"]')).not.toBeVisible();
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("aside") !== null)).toBe(false);
  }
});

test("duplicating a campaign preserves delivery options and creates a paused copy", async ({ page }) => {
  const state = await fixtureApi(page);
  Object.assign(state.campaigns[0], {
    dmTriggerEnabled: true,
    openingDmEnabled: true,
    openingDmMessage: "Keep my saved welcome — żółć",
    openingDmButtonLabel: "Odbierz poradnik",
    publicReplyEnabled: true,
    publicReplyMessages: ["Sprawdź swoją skrzynkę", "Poradnik już czeka"],
    requireFollowBeforeFreebie: true,
    followPromptMessage: "Zaobserwuj konto przed pobraniem",
    followPromptButtonLabel: "Już obserwuję",
    followUpEnabled: true,
    followUpMessage: "Czy poradnik był pomocny?",
    followUpDelayMinutes: 75,
    linkButtonLabel: "Pobierz poradnik",
    wholeWordMatch: false,
    reportShareEnabled: true,
    reportUrl: "https://example.com/reports/demo",
  });
  state.campaigns[0].trackedLinks.push({
    id: "link2", slug: "bonus", label: "Otwórz bonus", destinationUrl: "https://example.com/bonus",
    trackedUrl: "https://example.com/r/bonus", _count: { clicks: 2 },
  });
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Więcej działań", exact: true }).click();
  await page.getByRole("button", { name: "Duplikuj", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Poradnik testowy — kopia", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Uruchom Poradnik testowy — kopia", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Wstrzymaj Poradnik testowy", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(state.mutations).toHaveLength(1);
  expect(state.mutations[0]).toMatchObject({ method: "POST", path: "/api/automations", body: {
    name: "Poradnik testowy — kopia", isActive: false, dmTriggerEnabled: true,
    dmMessage: "Oto Twój poradnik: {link}", openingDmEnabled: true,
    openingDmMessage: "Keep my saved welcome — żółć", openingDmButtonLabel: "Odbierz poradnik",
    publicReplyEnabled: true, publicReplyMessages: ["Sprawdź swoją skrzynkę", "Poradnik już czeka"],
    requireFollowBeforeFreebie: true, followPromptMessage: "Zaobserwuj konto przed pobraniem",
    followPromptButtonLabel: "Już obserwuję", followUpEnabled: true,
    followUpMessage: "Czy poradnik był pomocny?", followUpDelayMinutes: 75,
    linkButtonLabel: "Pobierz poradnik", wholeWordMatch: false,
    trackedDestinationUrl: "https://example.com/poradnik", secondaryDestinationUrl: "https://example.com/bonus",
    secondaryButtonLabel: "Otwórz bonus", goal: "Pobrania poradnika",
  } });
  expect(state.mutations[0].body).not.toHaveProperty("id");
  expect(state.mutations[0].body).not.toHaveProperty("reportShareEnabled");
  expect(state.mutations[0].body).not.toHaveProperty("reportShareSlug");
  expect(state.mutations[0].body).not.toHaveProperty("trackedLinks");
  expect(state.campaigns).toHaveLength(2);
});

test("report sharing uses the campaign endpoint and removes the link when disabled", async ({ page }) => {
  const state = await fixtureApi(page);
  const requests: Array<{ method: string; enabled: boolean }> = [];
  await page.route("**/api/automations/campaign1/report", async (route) => {
    const { enabled } = route.request().postDataJSON() as { enabled: boolean };
    requests.push({ method: route.request().method(), enabled });
    const data = { reportShareEnabled: enabled, reportShareSlug: "demo", reportUrl: enabled ? "https://example.com/reports/demo" : null };
    Object.assign(state.campaigns[0], data);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.goto("/campaigns");
  const publicReport = page.getByRole("link", { name: "Otwórz raport publiczny", exact: true });
  await expect(publicReport).toHaveCount(0);
  await page.getByRole("button", { name: "Więcej działań", exact: true }).click();
  await page.getByRole("button", { name: "Włącz raport", exact: true }).click();
  await expect(publicReport).toBeVisible();
  await expect(publicReport).toHaveAttribute("href", "https://example.com/reports/demo");
  await page.getByRole("button", { name: "Więcej działań", exact: true }).click();
  await page.getByRole("button", { name: "Wyłącz raport", exact: true }).click();
  await expect(publicReport).toHaveCount(0);
  expect(requests).toEqual([{ method: "PATCH", enabled: true }, { method: "PATCH", enabled: false }]);
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
});

test("log filtering sends the real SKIPPED status and restores all results", async ({ page }) => {
  await fixtureApi(page);
  const requestedStatuses: Array<string | null> = [];
  const shared = {
    errorMessage: null, createdAt: "2026-09-08T08:00:00.000Z",
    automation: { name: "Poradnik testowy", keywords: ["PORADNIK"] }, instagramAccount: { username: "konto_testowe" },
  };
  const sent = { ...shared, id: "log-sent", commenterId: "456", commenterName: "wyslany_test", commentText: "Wysłany komentarz", status: "SENT" };
  const skipped = { ...shared, id: "log-skipped", commenterId: "789", commenterName: "pominiety_test", commentText: "Pominięty komentarz", status: "SKIPPED" };
  await page.route("**/api/logs?**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    requestedStatuses.push(status);
    const logs = status === "SKIPPED" ? [skipped] : [sent, skipped];
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: {
      logs, items: logs, page: 1, pageSize: 20, total: logs.length,
      pagination: { page: 1, limit: 20, total: logs.length, totalPages: 1 },
    } }) });
  });
  await page.goto("/logs");
  const results = page.locator("main article:visible, main tbody tr:visible");
  await expect(results).toHaveCount(2);
  await page.getByRole("button", { name: "Pominięto", exact: true }).click();
  await expect(results).toHaveCount(1);
  await expect(results).toContainText("Pominięty komentarz");
  await expect(results).toContainText("Pominięto");
  await expect(results.filter({ hasText: "Wysłany komentarz" })).toHaveCount(0);
  expect(requestedStatuses.at(-1)).toBe("SKIPPED");
  await page.getByRole("button", { name: "Wszystkie", exact: true }).click();
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: "Wysłany komentarz" })).toHaveCount(1);
  expect(requestedStatuses.at(-1)).toBeNull();
  expect(requestedStatuses.filter((status) => status !== null)).toEqual(["SKIPPED"]);
});
