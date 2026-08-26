import { describe, expect, it, vi } from "vitest";
import { databaseStorageLevel, normalizePagination } from "@/lib/core/reports";
import { createReportShareSlug, getPublicReport } from "@/lib/core/report-share";
import { resolveTrackedRedirect } from "@/lib/core/tracked-redirect";
import { reportRoutes } from "@/workers/core/routes/reports";
import { logRoutes } from "@/workers/core/routes/logs";
import { diagnosticRoutes } from "@/workers/core/routes/diagnostics";
import { redirectRoutes } from "@/workers/core/routes/redirects";

describe("Core read models", () => {
  it("clamps pagination and classifies Neon Free storage", () => {
    expect(normalizePagination({ page: "0", pageSize: "999" })).toEqual({ page: 1, pageSize: 100, skip: 0 });
    expect(databaseStorageLevel(375_809_638)).toBe("normal");
    expect(databaseStorageLevel(375_809_639)).toBe("warning");
    expect(databaseStorageLevel(456_340_276)).toBe("critical");
  });

  it("creates unguessable report slugs and refuses disabled reports", async () => {
    expect(createReportShareSlug()).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const findFirst = vi.fn(async () => null);
    await expect(getPublicReport({ automation: { findFirst } }, "slug")).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { reportShareSlug: "slug", reportShareEnabled: true } }));
  });

  it("records a tracked click before returning its destination", async () => {
    const create = vi.fn(async () => ({}));
    const db = { trackedLink: { findUnique: async () => ({ id: "link", automationId: "automation", destinationUrl: "https://example.com", automation: { instagramAccountId: "account" } }) }, linkClick: { create } };
    await expect(resolveTrackedRedirect(db, "slug", { ipHash: "hash", userAgent: "ua", referrer: null })).resolves.toBe("https://example.com");
    expect(create).toHaveBeenCalledOnce();
  });

  it("redirects when recording a tracked click fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const db = {
        trackedLink: { findUnique: async () => ({ id: "link", automationId: "automation", destinationUrl: "https://example.com", automation: { instagramAccountId: "account" } }) },
        linkClick: { create: vi.fn(async () => { throw new Error("Neon unavailable"); }) },
      };
      const response = await redirectRoutes(() => db).request("https://app.example.com/r/slug", {}, { IP_HASH_SALT: "salt" } as never);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://example.com");
      expect(consoleError).toHaveBeenCalledWith("Failed to record tracked link click", expect.objectContaining({ trackedLinkId: "link", error: expect.any(Error) }));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("mounts public reports and redirects plus private logs and diagnostics", () => {
    expect(reportRoutes(() => ({}) as never).routes.some((route) => route.path === "/reports/:shareSlug")).toBe(true);
    expect(redirectRoutes(() => ({}) as never).routes.some((route) => route.path === "/r/:slug")).toBe(true);
    expect(logRoutes(() => ({}) as never).routes.some((route) => route.path === "/logs")).toBe(true);
    expect(diagnosticRoutes(() => ({}) as never).routes.some((route) => route.path === "/diagnostics")).toBe(true);
  });
});
