import { expect, test } from "@playwright/test";
import { quizFixtureApi } from "./quiz-fixtures";

for (const failure of ["saveFailure", "revisionConflict"] as const) test(`keeps local edits after ${failure}`, async ({ page }) => {
  await quizFixtureApi(page, { [failure]: true }); await page.goto("/paths/demo");
  await page.getByLabel("Nazwa ścieżki", { exact: true }).fill("Mój quiz");
  await page.getByRole("button", { name: "Zapisz szkic", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: failure === "saveFailure" ? "Usługa jest chwilowo niedostępna" : "Dane zmieniły się" })).toBeVisible();
  await expect(page.getByLabel("Nazwa ścieżki", { exact: true })).toHaveValue("Mój quiz");
});
test("persists branching and renders connections without overflowing mobile", async ({ page }, info) => {
  const state = await quizFixtureApi(page); await page.goto("/paths/demo");
  await page.getByRole("button", { name: "Potrzeba", exact: true }).click();
  await page.getByRole("combobox", { name: "Po odpowiedzi 1", exact: true }).selectOption("email");
  await page.getByRole("button", { name: "Zapisz szkic", exact: true }).click();
  await expect(page.getByText("Szkic zapisany", { exact: false })).toBeVisible();
  const node = state.path.draft.graph.nodes.find(n => n.id === "wybor");
  expect(node?.type === "question" && node.choices[0].next).toBe("email");
  await page.reload(); await page.getByRole("button", { name: "Potrzeba", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Po odpowiedzi 1", exact: true })).toHaveValue("email");
  await expect(page.locator('svg path[data-source="wybor"][data-target="email"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("quiz-editor.png"), fullPage: true });
});
test("caps add and duplicate at ten steps and frees a place on delete", async ({ page }) => {
  await quizFixtureApi(page, { fullGraph: true }); await page.goto("/paths/demo");
  await expect(page.getByText("Kroki: 10/10", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Dodaj krok", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Potrzeba", exact: true }).click();
  await expect(page.getByRole("button", { name: "Duplikuj krok", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Usuń krok", exact: true }).click();
  await expect(page.getByLabel("Dodaj krok", { exact: true })).toBeEnabled();
  await expect(page.getByText("Kroki: 9/10", { exact: true })).toBeVisible();
});
test("previews help and email using AND qualification without calling Meta", async ({ page }) => {
  await quizFixtureApi(page); await page.goto("/paths/demo");
  await page.getByRole("button", { name: "Kwalifikacja", exact: true }).click();
  await page.getByLabel("Sposób łączenia warunków").selectOption("all");
  await page.getByRole("button", { name: "Podgląd", exact: true }).click();
  await page.getByRole("button", { name: "Twoja pomoc", exact: true }).click();
  await expect(page.getByTestId("preview-qualified")).toContainText("jeszcze niespełniona");
  await page.getByLabel("Testowy adres e-mail").fill("osoba@example.com");
  await page.getByRole("button", { name: "Wyślij odpowiedź testową", exact: true }).click();
  await expect(page.getByTestId("preview-qualified")).toContainText("wartościowy lead");
  await expect(page.getByText("Stan: zakończony", { exact: true })).toBeVisible();
});
test("filters qualified contacts by email and explicit interest", async ({ page }) => {
  await quizFixtureApi(page); await page.goto("/paths/contacts");
  await page.getByLabel("Tylko wartościowe leady").check();
  await expect(page.getByRole("heading", { name: "@anna", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "@bartek", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "@celina", exact: true })).toHaveCount(0);
  await page.getByLabel("Z adresem e-mail").check();
  await expect(page.getByRole("heading", { name: "@bartek", exact: true })).toHaveCount(0);
  await page.getByLabel("Z adresem e-mail").uncheck(); await page.getByLabel("Zainteresowani pomocą").check();
  await expect(page.getByRole("heading", { name: "@bartek", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "@anna", exact: true })).toHaveCount(0);
});
test("edits tags, pauses and resumes a conversation, then deletes the contact", async ({ page }) => {
  const state = await quizFixtureApi(page); await page.goto("/paths/contacts/c2");
  await expect(page.getByText("Powody kwalifikacji: zainteresowanie pomocą / ofertą", { exact: true })).toBeVisible();
  await expect(page.getByText("Źródłowy post: 1789000123", { exact: true })).toBeVisible();
  await page.getByLabel("Tagi kontaktu (oddzielone przecinkami)").fill("pomoc, wartościowy");
  await page.getByRole("button", { name: "Zapisz kontakt", exact: true }).click();
  await expect.poll(() => state.contacts[1].tags).toContain("wartościowy");
  await page.getByRole("button", { name: "Wstrzymaj quiz", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wznów quiz", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wznów quiz", exact: true }).click();
  await expect(page.getByRole("button", { name: "Wstrzymaj quiz", exact: true })).toBeVisible();
  page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "Usuń kontakt", exact: true }).click();
  await expect(page).toHaveURL(/\/paths\/contacts$/);
  expect(state.contacts.some(c => c.id === "c2")).toBe(false);
});
