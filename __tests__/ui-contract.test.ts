import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("premium light UI foundation", () => {
  it("defines semantic surface, action, field, heading and skeleton primitives", () => {
    const css = source("app/globals.css");
    for (const className of [
      ".app-card",
      ".app-card-interactive",
      ".app-button",
      ".app-button-primary",
      ".app-button-secondary",
      ".app-button-danger",
      ".app-field",
      ".app-label",
      ".app-kicker",
      ".app-page-title",
      ".app-page-description",
      ".app-skeleton",
    ]) expect(css).toContain(className);
  });

  it("keeps mobile form controls readable and honors reduced motion", () => {
    const css = source("app/globals.css");
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*font-size:\s*16px/);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("provides a dependency-free closed icon set", () => {
    const path = resolve("components/ui-icons.tsx");
    expect(existsSync(path)).toBe(true);
    const icons = existsSync(path) ? readFileSync(path, "utf8") : "";
    expect(icons).toContain("export type IconName");
    for (const name of ["dashboard", "campaigns", "inbox", "settings", "menu", "eye", "logout"]) {
      expect(icons).toContain(`${name}:`);
    }
  });
});
