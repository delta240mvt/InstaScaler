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
