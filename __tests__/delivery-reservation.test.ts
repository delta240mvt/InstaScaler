import { describe, expect, it, vi } from "vitest";
import { reserveDelivery } from "@/lib/delivery/runtime";

describe("delivery reservation", () => {
  it("does not allow concurrent retries to both reserve the same delivery", async () => {
    let status = "RETRYING";
    const db = { dmLog: {
      findUnique: async () => ({ status }), create: vi.fn(),
      update: async () => { status = "PROCESSING"; },
      updateMany: async () => { if (status !== "RETRYING") return { count: 0 }; status = "PROCESSING"; return { count: 1 }; },
    } };
    const input = { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" };
    expect((await Promise.all([reserveDelivery(db, input), reserveDelivery(db, input)])).filter(Boolean)).toHaveLength(1);
  });
  it("creates a processing record before a new Meta side effect", async () => {
    const create = vi.fn(async () => ({}));
    const db = { dmLog: { findUnique: vi.fn(async () => null), create, updateMany: vi.fn() } };
    await expect(reserveDelivery(db, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ externalId: "x", status: "PROCESSING" }) });
  });

  it("reclaims a failed delivery when its event is explicitly replayed", async () => {
    const db = { dmLog: { findUnique: async () => ({ status: "FAILED" }), create: vi.fn(), updateMany: async ({ where }: { where: { status: string } }) => ({ count: where.status === "FAILED" ? 1 : 0 }) } };
    await expect(reserveDelivery(db, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(true);
  });

  it("does not repeat a completed side effect but permits an explicit retry", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const completed = { dmLog: { findUnique: vi.fn(async () => ({ status: "SENT" })), create: vi.fn(), updateMany } };
    await expect(reserveDelivery(completed, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(false);
    const retrying = { dmLog: { findUnique: vi.fn(async () => ({ status: "RETRYING" })), create: vi.fn(), updateMany } };
    await expect(reserveDelivery(retrying, { externalId: "x", automationId: "a", instagramAccountId: "i", commenterId: "u" })).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { externalId: "x", status: "RETRYING" }, data: expect.objectContaining({ status: "PROCESSING" }) }));
  });
});
