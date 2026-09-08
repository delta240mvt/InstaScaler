import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { automationAnalytics } from "@/lib/core/automation-analytics";

it("aggregates exact campaign counts and returns only the five strongest keywords in PostgreSQL", async () => {
  const postgres = new PGlite();
  try {
    await postgres.exec(`CREATE TABLE "DmLog" ("automationId" text, status text, "matchedKeyword" text);
      INSERT INTO "DmLog" SELECT 'campaign', 'SENT', 'go' FROM generate_series(1,10);
      INSERT INTO "DmLog" SELECT 'campaign', 'SKIPPED', NULL FROM generate_series(1,3);
      INSERT INTO "DmLog" SELECT 'campaign', 'FAILED', 'help' FROM generate_series(1,2);
      INSERT INTO "DmLog" SELECT 'campaign', 'SENT', 'keyword-' || value FROM generate_series(1,6) value;
      INSERT INTO "DmLog" VALUES ('other', 'SENT', 'excluded');`);
    const result = await automationAnalytics({
      $queryRawUnsafe: async <T,>(query: string, ...values: unknown[]): Promise<T> => (await postgres.query(query, values)).rows as T,
    }, ["campaign"]);
    expect([...result.keys()]).toEqual(["campaign"]);
    expect(result.get("campaign")).toEqual({ sent: 16, skipped: 3, failed: 2, topKeywords: [
      { keyword: "go", count: 10 }, { keyword: "help", count: 2 },
      { keyword: "keyword-1", count: 1 }, { keyword: "keyword-2", count: 1 }, { keyword: "keyword-3", count: 1 },
    ] });
  } finally { await postgres.close(); }
// Allow the embedded PostgreSQL WASM engine to start on slower Windows hosts.
}, 60_000);
