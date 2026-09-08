import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendManualMessage } from "@/lib/delivery/manual-message";
import type { JobsEnv } from "@/lib/cloudflare/env";
import { TokenExpiredError } from "@/lib/meta/client";

vi.mock("@/lib/core/meta-oauth", () => ({ decryptToken: async () => "test-token" }));
const { send, reserve } = vi.hoisted(() => ({ send: vi.fn(), reserve: vi.fn() }));
vi.mock("@/lib/meta/client", async (original) => ({ ...await original<object>(), sendDirectMessage: send }));
const account = { instagramId: "123", accessToken: "encrypted", requiresReconnect: false, webhookSubscribed: true };
const db = { instagramAccount: { findUnique: vi.fn(), update: vi.fn() } };
const env = { ENCRYPTION_KEY: "test", ACCOUNT_RATE_LIMITER: { idFromName: (name: string) => name, get: () => ({ reserve }) } } as unknown as JobsEnv;
const input = { instagramAccountId: "acc", recipientId: "456", text: "Cześć!" };

describe("manual inbox delivery through Jobs", () => {
  beforeEach(() => { vi.clearAllMocks(); db.instagramAccount.findUnique.mockResolvedValue(account); reserve.mockResolvedValue({ allowed: true }); send.mockResolvedValue({ message_id: "mid" }); });
  it("reserves account capacity before sending", async () => {
    expect(await sendManualMessage(db, env, input)).toEqual({ ok: true, data: { message_id: "mid" } });
    expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0]);
  });
  it("does not send when rate limited", async () => {
    reserve.mockResolvedValue({ allowed: false });
    expect(await sendManualMessage(db, env, input)).toMatchObject({ ok: false, status: 429, error: "rate_limited" });
    expect(send).not.toHaveBeenCalled();
  });
  it("does not send for an account requiring reconnection", async () => {
    db.instagramAccount.findUnique.mockResolvedValue({ ...account, requiresReconnect: true });
    expect(await sendManualMessage(db, env, input)).toMatchObject({ ok: false, status: 409, error: "account_paused" });
    expect(reserve).not.toHaveBeenCalled();
  });
  it("rejects malformed input before loading credentials", async () => {
    expect(await sendManualMessage(db, env, { ...input, text: " " })).toMatchObject({ ok: false, status: 400 });
    expect(db.instagramAccount.findUnique).not.toHaveBeenCalled();
  });
  it("returns a safe failure without leaking upstream messages", async () => {
    send.mockRejectedValue(new Error("access_token=secret"));
    expect(await sendManualMessage(db, env, input)).toEqual({ ok: false, status: 502, error: "meta_send_failed" });
  });
  it("pauses an expired-token account and returns an actionable safe error", async () => {
    send.mockRejectedValue(new TokenExpiredError("access_token=secret"));
    expect(await sendManualMessage(db, env, input)).toEqual({ ok: false, status: 409, error: "account_paused" });
    expect(db.instagramAccount.update).toHaveBeenCalledWith({ where: { id: "acc" }, data: { requiresReconnect: true, webhookSubscribed: false, lastErrorCode: "META_TOKEN_EXPIRED" } });
  });
});
