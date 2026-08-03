import type { InstagramMedia } from "@/lib/meta/client";

type PendingAutomation = {
  id: string;
  createdAt: Date;
};

/**
 * Treats each pending automation as a reservation for the first publication
 * made after it was armed. When several automations wait on one account,
 * publications are assigned chronologically so none can claim the same post.
 */
export function assignNextMedia<T extends PendingAutomation>(pending: T[], media: InstagramMedia[]) {
  const publications = media
    .filter((item) => Number.isFinite(new Date(item.timestamp).getTime()))
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const available = new Set(publications.map((item) => item.id));
  const assignments: { automation: T; media: InstagramMedia }[] = [];

  for (const automation of pending) {
    const armedAt = automation.createdAt.getTime();
    const next = publications.find((item) => available.has(item.id) && new Date(item.timestamp).getTime() > armedAt);
    if (!next) continue;
    available.delete(next.id);
    assignments.push({ automation, media: next });
  }

  return assignments;
}
