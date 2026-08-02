import { describe, expect, it, vi } from "vitest";
import { deliverFollowProtectedFreebie } from "@/lib/delivery/follow-gate";

describe("follow-before-freebie gate", () => {
  it("sends a prompt from a comment without delivering the freebie", async () => {
    const sendFreebie = vi.fn();
    const sendPrompt = vi.fn();
    const result = await deliverFollowProtectedFreebie({ checkFollowStatus: vi.fn(), reserveDelivery: vi.fn(), sendPrompt, sendFreebie }, { requireFollowBeforeFreebie: true, isPostback: false, instagramAccountId: "account", userId: "user" });
    expect(result).toEqual({ status: "skipped", code: "FOLLOW_PROMPT_SENT" });
    expect(sendPrompt).toHaveBeenCalledOnce();
    expect(sendFreebie).not.toHaveBeenCalled();
  });

  it("checks Meta on every postback and sends the freebie exactly once after a positive result", async () => {
    const sendFreebie = vi.fn(async () => undefined);
    const reserveDelivery = vi.fn(async () => true);
    const ctx = { checkFollowStatus: vi.fn(async () => true), reserveDelivery, sendPrompt: vi.fn(), sendFreebie };
    await expect(deliverFollowProtectedFreebie(ctx, { requireFollowBeforeFreebie: true, isPostback: true, instagramAccountId: "account", userId: "user" })).resolves.toEqual({ status: "sent", code: "FREEBIE_SENT" });
    expect(ctx.checkFollowStatus).toHaveBeenCalledWith("account", "user");
    expect(sendFreebie).toHaveBeenCalledOnce();
    reserveDelivery.mockResolvedValue(false);
    await expect(deliverFollowProtectedFreebie(ctx, { requireFollowBeforeFreebie: true, isPostback: true, instagramAccountId: "account", userId: "user" })).resolves.toEqual({ status: "skipped", code: "DELIVERY_ALREADY_RESERVED" });
    expect(sendFreebie).toHaveBeenCalledOnce();
  });
});
