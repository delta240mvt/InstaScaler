import { afterEach, expect, it, vi } from "vitest";
import { getFollowerCountSeries, getUserFollowStatus, subscribeInstagramAccountToWebhooks, TokenExpiredError } from "@/lib/meta/client";
import { subscribeInstagramWebhooks } from "@/lib/core/meta-client";

afterEach(() => vi.restoreAllMocks());

it("propagates an expired follow-check token so delivery can require reconnection", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Expired", code: 190 } }), { status: 400 }));
  await expect(getUserFollowStatus("token", "123")).rejects.toBeInstanceOf(TokenExpiredError);
});

it("treats a missing follow relationship as unknown rather than granting the freebie", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "123" }), { status: 200 }));
  await expect(getUserFollowStatus("token", "123")).resolves.toBeNull();
});

it("does not log token-bearing request errors when follower insights are unavailable", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("request failed access_token=secret-value"));
  await expect(getFollowerCountSeries("token", "123")).resolves.toBeNull();
  expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-value");
});

it("subscribes both Meta clients to button postbacks required by opening and follow-gate DMs", async () => {
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ success: true })));
  await subscribeInstagramWebhooks("123", "token");
  await subscribeInstagramAccountToWebhooks("123", "token");
  expect(new URL(String(request.mock.calls[0][0])).searchParams.get("subscribed_fields")?.split(",")).toContain("messaging_postbacks");
  expect(JSON.parse(String(request.mock.calls[1][1]?.body)).subscribed_fields).toContain("messaging_postbacks");
});
