import { encodeBase64url } from "@/lib/admin-auth/encoding";
import { automationAnalytics, withClickAnalytics, type AnalyticsDb } from "@/lib/core/automation-analytics";

export function createReportShareSlug(): string {
  return encodeBase64url(crypto.getRandomValues(new Uint8Array(24)));
}

type ReportDb = AnalyticsDb & { automation: { findFirst(args: unknown): Promise<unknown | null> } };

export async function getPublicReport(db: ReportDb, shareSlug: string) {
  const report = await db.automation.findFirst({
    where: { reportShareSlug: shareSlug, reportShareEnabled: true },
    select: {
      id: true, name: true, goal: true, createdAt: true,
      instagramAccount: { select: { username: true, name: true } },
      trackedLinks: { select: { id: true, slug: true, label: true, destinationUrl: true, _count: { select: { clicks: true } } } },
    },
  }) as { id: string; trackedLinks: Array<{ _count: { clicks: number } }> } | null;
  if (!report) return null;
  const counts = await automationAnalytics(db, [report.id]);
  const clicks = report.trackedLinks.reduce((total, link) => total + link._count.clicks, 0);
  return { ...report, analytics: withClickAnalytics(counts.get(report.id), clicks) };
}
