export const NEON_FREE_STORAGE_BYTES = 536_870_912;

export function normalizePagination(input: { page?: string; pageSize?: string }) {
  const parsedPage = Number.parseInt(input.page ?? "1", 10);
  const parsedPageSize = Number.parseInt(input.pageSize ?? "25", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const pageSize = Number.isFinite(parsedPageSize) ? Math.min(100, Math.max(1, parsedPageSize)) : 25;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function databaseStorageLevel(bytes: number): "normal" | "warning" | "critical" {
  if (bytes >= NEON_FREE_STORAGE_BYTES * 0.85) return "critical";
  if (bytes >= NEON_FREE_STORAGE_BYTES * 0.7) return "warning";
  return "normal";
}
