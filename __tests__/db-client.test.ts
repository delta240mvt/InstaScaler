import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  PrismaNeon: vi.fn(),
  PrismaClient: vi.fn(),
}));

vi.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: mocks.PrismaNeon,
}));

vi.mock("@/app/generated/cf-native/client", () => ({
  PrismaClient: mocks.PrismaClient,
}));

describe("createPrisma", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.PrismaNeon.mockReset();
    mocks.PrismaClient.mockReset();
  });

  it("creates one request-scoped Neon adapter and client", async () => {
    const { createPrisma } = await import("@/lib/db/neon");

    expect(mocks.PrismaNeon).not.toHaveBeenCalled();
    expect(mocks.PrismaClient).not.toHaveBeenCalled();

    const client = createPrisma("postgresql://user:pass@example.neon.tech/db");

    expect(mocks.PrismaNeon).toHaveBeenCalledWith({
      connectionString: "postgresql://user:pass@example.neon.tech/db",
    });
    expect(mocks.PrismaClient).toHaveBeenCalledWith({
      adapter: expect.anything(),
    });
    expect(client).toBe(mocks.PrismaClient.mock.results[0]?.value);
  });
});
