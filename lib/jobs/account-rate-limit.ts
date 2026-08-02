export function reserveAccountCapacity(input: { used: number; limit: number; amount: number; now: number }): { allowed: boolean; remaining: number; retryAt: number | null } {
  const remaining = Math.max(0, input.limit - input.used);
  if (input.amount <= remaining) return { allowed: true, remaining: remaining - input.amount, retryAt: null };
  const nextHour = new Date(input.now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return { allowed: false, remaining, retryAt: nextHour.getTime() };
}
