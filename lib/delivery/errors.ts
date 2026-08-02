import { MetaApiError, RateLimitError } from "@/lib/meta/client";

export function deliveryError(error: unknown): { status: "retry" | "failed"; code: string } {
  if (error instanceof RateLimitError) return { status: "retry", code: "META_RATE_LIMIT" };
  if (error instanceof MetaApiError && [10, 100, 190, 200].includes(error.code)) return { status: "failed", code: "META_PERMANENT" };
  return { status: "retry", code: "TRANSIENT_FAILURE" };
}
