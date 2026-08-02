import { describe, expect, it, vi } from "vitest";
import { reserveDelivery } from "@/lib/delivery/runtime";

describe("delivery reservation", () => {
  it("creates a processing record before a new Meta side effect", async () => {
    const create = vi.fn(async () => ({}));
    const db = { dmLog: { findUnique: vi.fn(async () => null), create, update: vi.fn() } };
    await expect(reserveDelivery(db, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalId: "x", status: "PROCESSING" }) });
  });

  it("does not repeat a completed side effect but permits an explicit retry", async () => {
    const update = vi.fn(async () => ({}));
    const completed = { dmLog: { findUnique: vi.fn(async () => ({ status: "SENT" })), create: vi.fn(), update } };
    await expect(reserveDelivery(completed, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(false);
    const retrying = { dmLog: { findUnique: vi.fn(async () => ({ status: "RETRYING" })), create: vi.fn(), update } };
    await expect(reserveDelivery(retrying, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING" }) }));
  });
});
