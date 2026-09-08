import { z } from "zod";
import { createReportShareSlug } from "@/lib/core/report-share";
import { automationAnalytics, withClickAnalytics, type AnalyticsDb } from "@/lib/core/automation-analytics";

const webUrl = z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "A web URL is required");
const automationFieldsSchema = z.object({
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
  trackedDestinationUrl: z.union([z.literal(""), webUrl]).default(""),
  secondaryDestinationUrl: z.union([z.literal(""), webUrl]).default(""),
  secondaryButtonLabel: z.string().max(20).nullable().optional(),
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
});

const automationInputSchema = automationFieldsSchema.superRefine((value, context) => {
  if (!value.matchAnyPost && !value.pendingNextReel && !value.postId) context.addIssue({ code: "custom", path: ["postId"], message: "A trigger post is required" });
  if (!value.matchAnyWord && value.keywords.length === 0) context.addIssue({ code: "custom", path: ["keywords"], message: "A keyword is required" });
});

export type AutomationInput = z.input<typeof automationInputSchema>;
export type AutomationStore = AnalyticsDb & { automation: { findMany(args: unknown): Promise<unknown[]>; findUnique(args: unknown): Promise<unknown | null>; create(args: { data: unknown }): Promise<unknown>; update(args: unknown): Promise<unknown>; delete(args: unknown): Promise<unknown> } };

function linkWrites(value: { trackedDestinationUrl: string; secondaryDestinationUrl: string; linkButtonLabel?: string | null; secondaryButtonLabel?: string | null }) {
  return [
    value.trackedDestinationUrl ? { slug: crypto.randomUUID().replaceAll("-", ""), destinationUrl: value.trackedDestinationUrl, label: value.linkButtonLabel || null } : null,
    value.secondaryDestinationUrl ? { slug: crypto.randomUUID().replaceAll("-", ""), destinationUrl: value.secondaryDestinationUrl, label: value.secondaryButtonLabel || null } : null,
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));
}

export function normalizeAutomationInput(input: AutomationInput) {
  const value = automationInputSchema.parse(input);
  const automation = Object.fromEntries(Object.entries(value).filter(([key]) => !["trackedDestinationUrl", "secondaryDestinationUrl", "secondaryButtonLabel"].includes(key)));
  const isSpecificPost = !value.pendingNextReel && !value.matchAnyPost;
  const publicReplyMessages = value.publicReplyEnabled ? value.publicReplyMessages.map((message) => message.trim()).filter(Boolean) : [];
  return {
    ...automation,
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
    trackedLinks: { create: linkWrites(value) },
  };
}

export async function listAutomations(db: AutomationStore, instagramAccountId?: string, baseUrl?: string) {
  const rows = await db.automation.findMany({ where: instagramAccountId && instagramAccountId !== "all" ? { instagramAccountId } : {}, orderBy: { createdAt: "desc" }, include: { trackedLinks: { orderBy: { createdAt: "asc" }, include: { _count: { select: { clicks: true } } } }, instagramAccount: { select: { username: true, instagramId: true } }, _count: { select: { dmLogs: true } } } });
  const counts = await automationAnalytics(db, rows.map((row) => (row as { id: string }).id));
  return rows.map((raw) => {
    const row = raw as Record<string, unknown> & { id: string; trackedLinks?: Array<Record<string, unknown> & { _count?: { clicks: number } }> };
    const clicks = (row.trackedLinks ?? []).reduce((total, link) => total + (link._count?.clicks ?? 0), 0);
    const trackedLinks = (row.trackedLinks ?? []).map((link) => ({ ...link, trackedUrl: baseUrl && typeof link.slug === "string" ? `${baseUrl.replace(/\/$/, "")}/r/${link.slug}` : undefined }));
    const reportUrl = baseUrl && row.reportShareEnabled && typeof row.reportShareSlug === "string" ? `${baseUrl.replace(/\/$/, "")}/reports/${row.reportShareSlug}` : null;
    return { ...row, trackedLinks, reportUrl, analytics: withClickAnalytics(counts.get(row.id), clicks) };
  });
}

export async function createAutomation(db: { automation: Pick<AutomationStore["automation"], "create"> }, input: AutomationInput) {
  return db.automation.create({ data: normalizeAutomationInput(input) });
}

export async function updateAutomation(db: { automation: Pick<AutomationStore["automation"], "findUnique" | "update"> }, id: string, input: Partial<AutomationInput>) {
  const parsed = automationFieldsSchema.partial().parse(input);
  const value = Object.fromEntries(Object.entries(parsed).filter(([key]) => Object.hasOwn(input, key))) as Partial<typeof parsed>;
  const current = await db.automation.findUnique({ where: { id }, include: { trackedLinks: { orderBy: { createdAt: "asc" } } } }) as (AutomationInput & { trackedLinks?: Array<{ id: string; destinationUrl: string; label: string | null }> }) | null;
  if (!current) return null;
  automationInputSchema.parse({ ...current, ...value });
  const linkFieldsPresent = ["trackedDestinationUrl", "secondaryDestinationUrl", "secondaryButtonLabel", "linkButtonLabel"].some((key) => Object.hasOwn(value, key));
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(value).filter(([key]) => !["trackedDestinationUrl", "secondaryDestinationUrl", "secondaryButtonLabel"].includes(key)));
  if (value.matchAnyWord) data.keywords = [];
  if (value.matchAnyPost || value.pendingNextReel) Object.assign(data, { postId: null, postUrl: null });
  if (value.openingDmEnabled === false) Object.assign(data, { openingDmMessage: null, openingDmButtonLabel: null });
  if (value.requireFollowBeforeFreebie === false) Object.assign(data, { followPromptMessage: null, followPromptButtonLabel: null });
  if (value.followUpEnabled === false) Object.assign(data, { followUpMessage: null, followUpDelayMinutes: 0 });
  if (value.publicReplyEnabled === false) Object.assign(data, { publicReplyMessages: [], publicReplyMessage: null });
  if (value.publicReplyMessages) data.publicReplyMessage = value.publicReplyMessages.map((message) => message.trim()).filter(Boolean)[0] ?? null;
  if (linkFieldsPresent) {
    const links = current.trackedLinks ?? [];
    const writes = [
      { existing: links[0], destinationUrl: value.trackedDestinationUrl ?? links[0]?.destinationUrl ?? "", label: Object.hasOwn(value, "linkButtonLabel") ? value.linkButtonLabel || null : links[0]?.label ?? null },
      { existing: links[1], destinationUrl: value.secondaryDestinationUrl ?? links[1]?.destinationUrl ?? "", label: Object.hasOwn(value, "secondaryButtonLabel") ? value.secondaryButtonLabel || null : links[1]?.label ?? null },
    ];
    data.trackedLinks = {
      update: writes.filter((link) => link.existing && link.destinationUrl).map((link) => ({ where: { id: link.existing!.id }, data: { destinationUrl: link.destinationUrl, label: link.label } })),
      create: writes.filter((link) => !link.existing && link.destinationUrl).map((link) => ({ slug: crypto.randomUUID().replaceAll("-", ""), destinationUrl: link.destinationUrl, label: link.label })),
      delete: writes.filter((link) => link.existing && !link.destinationUrl).map((link) => ({ id: link.existing!.id })),
    };
  }
  return db.automation.update({ where: { id }, data });
}

export async function setReportSharing(db: { automation: Pick<AutomationStore["automation"], "findUnique" | "update"> }, id: string, enabled: boolean, baseUrl: string) {
  const current = await db.automation.findUnique({ where: { id }, select: { reportShareSlug: true } }) as { reportShareSlug?: string | null } | null;
  if (!current) return null;
  const reportShareSlug = current.reportShareSlug ?? createReportShareSlug();
  await db.automation.update({ where: { id }, data: { reportShareEnabled: enabled, reportShareSlug } });
  return { reportShareEnabled: enabled, reportShareSlug, reportUrl: enabled ? `${baseUrl.replace(/\/$/, "")}/reports/${reportShareSlug}` : null };
}

export async function deleteAutomation(db: { automation: Pick<AutomationStore["automation"], "delete"> }, id: string) {
  return db.automation.delete({ where: { id } });
}

export async function importAutomations(db: { automation: Pick<AutomationStore["automation"], "findMany" | "create"> }, rows: AutomationInput[]) {
  rows.forEach((row) => automationInputSchema.parse(row));
  const accountIds = [...new Set(rows.map((row) => row.instagramAccountId))];
  const postIds = rows.flatMap((row) => row.postId ? [row.postId] : []);
  const existing = await db.automation.findMany({ where: { instagramAccountId: { in: accountIds }, postId: { in: postIds } }, select: { instagramAccountId: true, postId: true } }) as { instagramAccountId: string; postId?: string | null }[];
  const postKey = (row: { instagramAccountId: string; postId?: string | null }) => JSON.stringify([row.instagramAccountId, row.postId]);
  const usedPostIds = new Set(existing.map(postKey));
  const created: { name: string; postId: string | null }[] = [];
  const skipped: { row: number; reason: string }[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.postId && usedPostIds.has(postKey(row))) {
      skipped.push({ row: index + 1, reason: "a campaign already exists for this post" });
      continue;
    }
    await createAutomation(db, row);
    if (row.postId) usedPostIds.add(postKey(row));
    created.push({ name: row.name, postId: row.postId ?? null });
  }
  return { created, skipped };
}
