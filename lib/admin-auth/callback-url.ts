export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}
