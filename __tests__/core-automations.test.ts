import { describe, expect, it, vi } from "vitest";
import { createAutomation, importAutomations, normalizeAutomationInput } from "@/lib/automations/service";
import { automationRoutes } from "@/workers/core/routes/automations";
import { dashboardRoutes } from "@/workers/core/routes/dashboard";

describe("single-owner automation service", () => {
  it("normalizes the follow gate and caps a delayed follow-up at 24 hours", () => {
    expect(() => normalizeAutomationInput({ name: "A", dmMessage: "Hi", instagramAccountId: "ig", keywords: ["go"], postId: "post", followUpDelayMinutes: 1441 })).toThrow();
    expect(normalizeAutomationInput({ name: "A", dmMessage: "Hi", instagramAccountId: "ig", keywords: ["go"], postId: "post", requireFollowBeforeFreebie: true, followUpEnabled: true, followUpDelayMinutes: 60 })).toMatchObject({ requireFollowBeforeFreebie: true, followUpDelayMinutes: 60 });
  });

  it("creates an automation without a workspace identifier", async () => {
    const created: unknown[] = [];
    const db = { automation: { create: async ({ data }: { data: unknown }) => { created.push(data); return data; } } };
    await createAutomation(db, { name: "A", dmMessage: "Hi", instagramAccountId: "ig", keywords: ["go"], postId: "post" });
    expect(created[0]).not.toHaveProperty("workspaceId");
  });

  it("mounts CRUD and import on the documented paths", () => {
    const routes = automationRoutes(() => ({}) as never).routes.map((route) => `${route.method} ${route.path}`);
    expect(routes).toEqual(expect.arrayContaining([
      "GET /automations",
      "POST /automations",
      "PATCH /automations",
      "DELETE /automations",
      "POST /automations/import",
    ]));
  });

  it("mounts dashboard statistics", () => {
    expect(dashboardRoutes(() => ({}) as never).routes.some((route) => route.method === "GET" && route.path === "/dashboard/stats")).toBe(true);
  });

  it("skips imported rows for posts that already have a campaign", async () => {
    const create = vi.fn(async ({ data }: { data: unknown }) => data);
    const db = { automation: { findMany: async () => [{ postId: "used" }], create } };
    const result = await importAutomations(db, [
      { name: "Used", dmMessage: "Hi", instagramAccountId: "ig", keywords: ["go"], postId: "used" },
      { name: "New", dmMessage: "Hi", instagramAccountId: "ig", keywords: ["go"], postId: "new" },
    ]);
    expect(result).toMatchObject({ created: [{ name: "New", postId: "new" }], skipped: [{ row: 1 }] });
    expect(create).toHaveBeenCalledOnce();
  });
});
