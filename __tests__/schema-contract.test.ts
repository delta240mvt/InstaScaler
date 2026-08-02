import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");

describe("CF-native database schema", () => {
  it("keeps only the single-owner domain and its required models", async () => {
    const schema = await readFile(schemaPath, "utf8");

    for (const removedModel of [
      "User",
      "Account",
      "Session",
      "Workspace",
      "WorkspaceMember",
      "WorkspaceInvitation",
    ]) {
      expect(schema).not.toMatch(new RegExp(`model ${removedModel}\\b`));
    }

    expect(schema).not.toContain("workspaceId");
    expect(schema).toMatch(
      /requireFollowBeforeFreebie\s+Boolean\s+@default\(false\)/,
    );

    for (const model of [
      "InstagramAccount",
      "Automation",
      "ProcessedEvent",
      "DmLog",
      "TrackedLink",
      "LinkClick",
      "FollowerSnapshot",
      "DailyAggregate",
      "OperationalEvent",
      "JobRun",
    ]) {
      expect(schema).toMatch(new RegExp(`model ${model}\\b`));
    }
  });
});
