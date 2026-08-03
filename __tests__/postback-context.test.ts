import { describe, expect, it } from "vitest";
import {
  deliveryExternalId,
  parsePostbackPayload,
  postbackPayload,
} from "@/lib/delivery/postback-context";

describe("postback delivery context", () => {
  it("keeps a comment-specific key through reveal and follow-check clicks", () => {
    const payload = postbackPayload("reveal", "campaign_1", "comment_123");

    expect(payload).toBe("reveal:campaign_1:comment_123");
    expect(parsePostbackPayload(payload)).toEqual({
      kind: "reveal",
      automationId: "campaign_1",
      deliveryKey: "comment_123",
    });
  });

  it("allows the same user to receive a new freebie for a new comment", () => {
    expect(deliveryExternalId("campaign_1", "comment_123", "user_1")).not.toBe(
      deliveryExternalId("campaign_1", "comment_456", "user_1"),
    );
  });
});
