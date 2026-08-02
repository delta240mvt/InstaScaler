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

describe("responsive shell and login", () => {
  it("uses an accessible mobile navigation dialog with touch-safe controls", () => {
    const sidebar = source("components/sidebar.tsx");
    expect(sidebar).toContain('role={isOpen ? "dialog" : undefined}');
    expect(sidebar).toContain("aria-modal={isOpen ? true : undefined}");
    expect(sidebar).toContain('aria-label="Close navigation"');
    expect(sidebar).toContain("min-h-11");
  });

  it("keeps the shell viewport-safe with compact phone gutters", () => {
    const shell = source("components/dashboard-shell.tsx");
    expect(shell).toContain("h-dvh");
    expect(shell).toContain("px-3");
    expect(shell).toContain("sm:px-6");
  });

  it("gives login a premium private-workspace treatment and password visibility", () => {
    const page = source("app/login/page.tsx");
    const form = source("components/admin-login-form.tsx");
    expect(page).toContain("Your private creator workspace");
    expect(page).toContain("lg:grid-cols-2");
    expect(form).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
    expect(form).toContain('name="eye"');
  });
});

describe("analytics hierarchy", () => {
  it("gives the dashboard a semantic heading and primary campaign action", () => {
    const dashboard = source("app/(dashboard)/dashboard/page.tsx");
    expect(dashboard).toContain("app-page-title");
    expect(dashboard).toContain("Create campaign");
    expect(dashboard).toContain('name="plus"');
  });

  it("uses the canonical follower chart on overview", () => {
    const overview = source("app/(dashboard)/overview/page.tsx");
    expect(overview).toContain('import FollowerChart');
    expect(overview).toContain("<FollowerChart");
  });

  it("brands public reports without private navigation", () => {
    const report = source("app/reports/[shareSlug]/page.tsx");
    expect(report).toContain("OpenReply");
    expect(report).toContain("Public campaign report");
    expect(report).toContain("app-page-title");
  });
});

describe("campaign workflow UIX", () => {
  it("gives campaign discovery a semantic header and touch-safe primary actions", () => {
    const campaigns = source("app/(dashboard)/campaigns/page.tsx");
    expect(campaigns).toContain("app-page-title");
    expect(campaigns).toContain("app-button-primary");
    expect(campaigns).toContain('aria-label={`');
  });

  it("keeps builder actions available on mobile and fields semantic", () => {
    const builder = source("components/campaign-builder.tsx");
    expect(builder).toContain("sticky bottom-0");
    expect(builder).toContain("app-field");
    expect(builder).toContain("app-card");
  });

  it("presents import and detail pages as premium responsive surfaces", () => {
    expect(source("app/(dashboard)/campaigns/import/page.tsx")).toContain("app-page-title");
    expect(source("app/(dashboard)/campaigns/[id]/page.tsx")).toContain("app-card");
  });
});
