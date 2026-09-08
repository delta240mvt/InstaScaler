export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  if (new URL(value, "https://callback.invalid").origin !== "https://callback.invalid") return "/dashboard";
  return value;
}
