import { z } from "zod";

const automationInputSchema = z.object({
  instagramAccountId: z.string().min(1).max(255),
  name: z.string().min(1).max(100),
  goal: z.string().max(120).nullable().optional(),
  postId: z.string().min(1).nullable().optional(),
  postUrl: z.string().url().nullable().optional(),
  pendingNextReel: z.boolean().default(false),
  matchAnyPost: z.boolean().default(false),
  keywords: z.array(z.string().min(1).max(50)).max(10).default([]),
  matchAnyWord: z.boolean().default(false),
  dmTriggerEnabled: z.boolean().default(false),
  dmMessage: z.string().min(1).max(1000),
  openingDmEnabled: z.boolean().default(false),
  openingDmMessage: z.string().max(1000).nullable().optional(),
  openingDmButtonLabel: z.string().max(64).nullable().optional(),
  linkButtonLabel: z.string().max(20).nullable().optional(),
  requireFollowBeforeFreebie: z.boolean().default(false),
  followPromptMessage: z.string().max(1000).nullable().optional(),
  followPromptButtonLabel: z.string().max(20).nullable().optional(),
  followUpEnabled: z.boolean().default(false),
  followUpMessage: z.string().max(1000).nullable().optional(),
  followUpDelayMinutes: z.number().int().min(0).max(1440).default(0),
  publicReplyEnabled: z.boolean().default(false),
  publicReplyMessage: z.string().max(1000).nullable().optional(),
  publicReplyMessages: z.array(z.string().max(1000)).max(10).default([]),
  isActive: z.boolean().default(true),
  wholeWordMatch: z.boolean().default(true),
}).superRefine((value, context) => {
  if (!value.matchAnyPost && !value.pendingNextReel && !value.postId) context.addIssue({ code: "custom", path: ["postId"], message: "A trigger post is required" });
  if (!value.matchAnyWord && value.keywords.length === 0) context.addIssue({ code: "custom", path: ["keywords"], message: "A keyword is required" });
});

export type AutomationInput = z.input<typeof automationInputSchema>;
export type AutomationStore = { automation: { findMany(args: unknown): Promise<unknown[]>; create(args: { data: unknown }): Promise<unknown>; update(args: unknown): Promise<unknown>; delete(args: unknown): Promise<unknown> } };

export function normalizeAutomationInput(input: AutomationInput) {
  const value = automationInputSchema.parse(input);
  const isSpecificPost = !value.pendingNextReel && !value.matchAnyPost;
  const publicReplyMessages = value.publicReplyEnabled ? value.publicReplyMessages.map((message) => message.trim()).filter(Boolean) : [];
  return {
    ...value,
    postId: isSpecificPost ? value.postId ?? null : null,
    postUrl: isSpecificPost ? value.postUrl ?? null : null,
    keywords: value.matchAnyWord ? [] : value.keywords,
    openingDmMessage: value.openingDmEnabled ? value.openingDmMessage ?? null : null,
    openingDmButtonLabel: value.openingDmEnabled ? value.openingDmButtonLabel ?? null : null,
    followPromptMessage: value.requireFollowBeforeFreebie ? value.followPromptMessage ?? null : null,
    followPromptButtonLabel: value.requireFollowBeforeFreebie ? value.followPromptButtonLabel ?? null : null,
    followUpMessage: value.followUpEnabled ? value.followUpMessage ?? null : null,
    followUpDelayMinutes: value.followUpEnabled ? value.followUpDelayMinutes : 0,
    publicReplyMessages,
    publicReplyMessage: publicReplyMessages[0] ?? null,
  };
}

export async function listAutomations(db: AutomationStore, instagramAccountId?: string) {
  return db.automation.findMany({ where: instagramAccountId && instagramAccountId !== "all" ? { instagramAccountId } : {}, orderBy: { createdAt: "desc" }, include: { trackedLinks: true, instagramAccount: { select: { username: true, instagramId: true } } } });
}

export async function createAutomation(db: { automation: Pick<AutomationStore["automation"], "create"> }, input: AutomationInput) {
  return db.automation.create({ data: normalizeAutomationInput(input) });
}

export async function updateAutomation(db: { automation: Pick<AutomationStore["automation"], "update"> }, id: string, input: Partial<AutomationInput>) {
  return db.automation.update({ where: { id }, data: input });
}

export async function deleteAutomation(db: { automation: Pick<AutomationStore["automation"], "delete"> }, id: string) {
  return db.automation.delete({ where: { id } });
}

export async function importAutomations(db: { automation: Pick<AutomationStore["automation"], "create"> }, rows: AutomationInput[]) {
  return Promise.all(rows.map((row) => createAutomation(db, row)));
}
