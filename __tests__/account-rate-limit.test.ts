import { describe, expect, it } from "vitest";
import { reserveAccountCapacity } from "@/lib/jobs/account-rate-limit";

describe("per-account capacity", () => {
  it("allows the exact hourly boundary and returns a retry timestamp", () => {
    expect(reserveAccountCapacity({ used: 9, limit: 10, amount: 1, now: Date.UTC(2026, 7, 2, 10, 1) })).toEqual({ allowed: true, remaining: 0, retryAt: null });
    expect(reserveAccountCapacity({ used: 10, limit: 10, amount: 1, now: Date.UTC(2026, 7, 2, 10, 1) })).toEqual({ allowed: false, remaining: 0, retryAt: Date.UTC(2026, 7, 2, 11) });
  });
});
