type RedirectDb = {
  trackedLink: { findUnique(args: unknown): Promise<{ id: string; automationId: string; destinationUrl: string; automation: { instagramAccountId: string } } | null> };
  linkClick: { create(args: unknown): Promise<unknown> };
};

export async function resolveTrackedRedirect(db: RedirectDb, slug: string, request: { ipHash: string | null; userAgent: string | null; referrer: string | null }): Promise<string | null> {
  const link = await db.trackedLink.findUnique({ where: { slug }, select: { id: true, automationId: true, destinationUrl: true, automation: { select: { instagramAccountId: true } } } });
  if (!link) return null;
  try {
    await db.linkClick.create({ data: { trackedLinkId: link.id, automationId: link.automationId, instagramAccountId: link.automation.instagramAccountId, ...request } });
  } catch (error) {
    console.error("Failed to record tracked link click", { trackedLinkId: link.id, error });
  }
  return link.destinationUrl;
}
