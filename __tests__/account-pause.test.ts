import { describe, expect, it, vi } from "vitest";
import { handleDeliveryFailure } from "@/lib/delivery/runtime";
import { PermissionError, RateLimitError, TokenExpiredError } from "@/lib/meta/client";

describe("account-local delivery failures", () => {
  it("pauses only the account whose Meta token expired", async () => {
    const update = vi.fn(async () => ({}));
    const create = vi.fn(async () => ({}));
    const db = { instagramAccount: { update }, operationalEvent: { create } };
    await expect(handleDeliveryFailure(db, "ig_123", new TokenExpiredError("expired"))).resolves.toEqual({ status: "failed", code: "META_PERMANENT" });
    expect(update).toHaveBeenCalledWith({ where: { instagramId: "ig_123" }, data: { webhookSubscribed: false, requiresReconnect: true, lastErrorCode: "META_TOKEN_EXPIRED" } });
    expect(create).toHaveBeenCalledOnce();
  });

  it("does not pause an account for a transient Meta rate limit", async () => {
    const update = vi.fn();
    const db = { instagramAccount: { update }, operationalEvent: { create: vi.fn() } };
    await expect(handleDeliveryFailure(db, "ig_123", new RateLimitError("slow down"))).resolves.toEqual({ status: "retry", code: "META_RATE_LIMIT" });
    expect(update).not.toHaveBeenCalled();
  });

  it("does not pause the whole account when one recipient cannot be reached", async () => {
    const update = vi.fn();
    const db = { instagramAccount: { update }, operationalEvent: { create: vi.fn() } };

    await expect(
      handleDeliveryFailure(db, "ig_123", new PermissionError("The requested user cannot be found.")),
    ).resolves.toEqual({ status: "failed", code: "META_PERMANENT" });

    expect(update).not.toHaveBeenCalled();
  });
});
