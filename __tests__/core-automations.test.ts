import { describe, expect, it } from "vitest";
import { createAutomation, normalizeAutomationInput } from "@/lib/automations/service";

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
});
