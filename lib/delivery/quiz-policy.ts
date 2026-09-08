export function sourceTimestamp(value: unknown, receivedAt: Date, unit: "ms" | "s"): string | null {
  const ms = typeof value === "number" ? value * (unit === "s" ? 1000 : 1) : typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && ms > 0 && ms <= receivedAt.getTime() ? new Date(ms).toISOString() : null;
}
export function canSendQuizMessage(input: { now: Date; lastInteractionAt: Date | null; commentCreatedAt: Date | null; opening: boolean; blocked: boolean }) {
  if (input.blocked) return false;
  const source = input.opening ? input.commentCreatedAt : input.lastInteractionAt;
  if (!source || !Number.isFinite(source.getTime())) return false;
  const age = input.now.getTime() - source.getTime();
  return age >= 0 && age < (input.opening ? 7 * 24 : 24) * 3600_000;
}
