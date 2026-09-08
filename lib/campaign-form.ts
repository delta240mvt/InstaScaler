export type CampaignDraft = {
  requireFollowBeforeFreebie: boolean;
  followPromptMessage: string;
  followPromptButtonLabel: string;
  followUpDelayMinutes: number;
  [key: string]: unknown;
};

function delay(value: unknown): number {
  const minutes = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
  return Math.min(1_440, Math.max(0, minutes));
}

export function serializeCampaignDraft<T extends CampaignDraft>(draft: T): T {
  return { ...draft, followUpDelayMinutes: delay(draft.followUpDelayMinutes) };
}

export function restoreCampaignDraft(value: CampaignDraft): CampaignDraft {
  return { ...value, followUpDelayMinutes: delay(value.followUpDelayMinutes) };
}

/** Copy editable settings without carrying delivery history or public report access. */
export function duplicateCampaignDraft<T extends { name: string; trackedLinks: Array<{ destinationUrl: string; label?: string | null }> }>(source: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ["goal", "instagramAccountId", "postId", "postUrl", "matchAnyPost", "pendingNextReel", "matchAnyWord", "keywords", "wholeWordMatch", "dmTriggerEnabled", "dmMessage", "openingDmEnabled", "openingDmMessage", "openingDmButtonLabel", "linkButtonLabel", "publicReplyEnabled", "publicReplyMessages", "requireFollowBeforeFreebie", "followPromptMessage", "followPromptButtonLabel", "followUpEnabled", "followUpMessage", "followUpDelayMinutes"] as const) {
    if (key in source) result[key] = source[key as keyof T];
  }
  return { ...result, name: `${source.name.slice(0, 92)} — kopia`, isActive: false, trackedDestinationUrl: source.trackedLinks[0]?.destinationUrl ?? "", secondaryDestinationUrl: source.trackedLinks[1]?.destinationUrl ?? "", secondaryButtonLabel: source.trackedLinks[1]?.label ?? "Otwórz link" };
}
