import { encodeBase64url } from "@/lib/admin-auth/encoding";

export function createReportShareSlug(): string {
  return encodeBase64url(crypto.getRandomValues(new Uint8Array(24)));
}

type ReportDb = { automation: { findFirst(args: unknown): Promise<unknown | null> } };

export function getPublicReport(db: ReportDb, shareSlug: string) {
  return db.automation.findFirst({
    where: { reportShareSlug: shareSlug, reportShareEnabled: true },
    select: {
      id: true, name: true, goal: true, createdAt: true,
      instagramAccount: { select: { username: true, name: true } },
      trackedLinks: { select: { id: true, slug: true, label: true, destinationUrl: true, _count: { select: { clicks: true } } } },
      dmLogs: { select: { status: true, matchedKeyword: true, createdAt: true } },
    },
  });
}
