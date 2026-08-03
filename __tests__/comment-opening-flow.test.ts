import { describe, expect, it } from "vitest";
import { initialCommentDmPlan } from "@/lib/delivery/comment-opening-flow";

describe("comment opening DM flow", () => {
  it("sends the configured opening before checking follow status", () => {
    expect(initialCommentDmPlan({ openingDmEnabled: true, requireFollowBeforeFreebie: true })).toEqual({ mode: "opening", postbackKind: "reveal" });
  });

  it("uses the follow prompt first only when no opening DM is configured", () => {
    expect(initialCommentDmPlan({ openingDmEnabled: false, requireFollowBeforeFreebie: true })).toEqual({ mode: "followPrompt", postbackKind: "followcheck" });
  });

  it("sends the freebie directly when neither gate nor opening is enabled", () => {
    expect(initialCommentDmPlan({ openingDmEnabled: false, requireFollowBeforeFreebie: false })).toEqual({ mode: "freebie", postbackKind: null });
  });
});
