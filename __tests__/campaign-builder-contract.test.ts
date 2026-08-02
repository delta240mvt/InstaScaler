import { describe, expect, it } from "vitest";
import { restoreCampaignDraft, serializeCampaignDraft } from "@/lib/campaign-form";

const completeDraft = {
  name: "Free guide",
  instagramAccountId: "ig_1",
  postId: null,
  postUrl: null,
  matchAnyPost: false,
  pendingNextReel: true,
  matchAnyWord: false,
  keywords: ["guide", "freebie"],
  dmTriggerEnabled: true,
  dmMessage: "Here it is {link}",
  openingDmEnabled: true,
  openingDmMessage: "Want the guide?",
  openingDmButtonLabel: "Send it",
  publicReplyEnabled: true,
  publicReplyMessages: ["Sent!", "Check your DMs"],
  trackedDestinationUrl: "https://example.com/guide",
  linkButtonLabel: "Open guide",
  secondaryDestinationUrl: "https://example.com/bonus",
  secondaryButtonLabel: "Open bonus",
  requireFollowBeforeFreebie: true,
  followPromptMessage: "Follow me first",
  followPromptButtonLabel: "I'm following",
  followUpEnabled: true,
  followUpMessage: "Did it help?",
  followUpDelayMinutes: 60,
  isActive: true,
};

describe("campaign builder API contract", () => {
  it("serializes all trigger, message, button, follow-gate, and follow-up fields", () => {
    expect(serializeCampaignDraft(completeDraft)).toEqual(completeDraft);
    expect(serializeCampaignDraft(completeDraft)).not.toHaveProperty("requireFollow");
  });

  it("restores the follow gate and clamps delay to 0..1440 minutes", () => {
    expect(restoreCampaignDraft({ ...completeDraft, followUpDelayMinutes: 9_999 })).toMatchObject({
      requireFollowBeforeFreebie: true,
      followPromptMessage: "Follow me first",
      followPromptButtonLabel: "I'm following",
      followUpDelayMinutes: 1_440,
    });
    expect(restoreCampaignDraft({ ...completeDraft, followUpDelayMinutes: -4 }).followUpDelayMinutes).toBe(0);
  });
});
