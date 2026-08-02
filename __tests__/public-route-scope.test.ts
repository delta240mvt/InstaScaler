import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const removed = [
  "app/comment-link-automation/page.tsx",
  "app/instagram-comment-to-dm-templates/page.tsx",
  "app/instagram-dm-automation-agencies/page.tsx",
  "app/manychat-alternative/page.tsx",
  "app/templates/page.tsx",
  "app/templates/[slug]/page.tsx",
  "app/invite/[token]/page.tsx",
];

describe("public route scope", () => {
  it("keeps only required public and legal pages", () => {
    expect(removed.filter(existsSync)).toEqual([]);
    for (const route of ["app/privacy/page.tsx", "app/terms/page.tsx", "app/data-deletion/page.tsx", "app/meta-review/page.tsx", "app/reports/[shareSlug]/page.tsx"]) {
      expect(existsSync(route), route).toBe(true);
    }
  });

  it("routes the root by the admin session cookie", () => {
    const source = readFileSync("app/page.tsx", "utf8");
    expect(source).toContain("__Host-instascaler-session");
    expect(source).toContain('redirect("/dashboard")');
    expect(source).toContain('redirect("/login")');
  });
});
