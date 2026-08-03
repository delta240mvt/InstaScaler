export function selectPublicReply(replies: string[], random = Math.random): string | undefined {
  const variants = replies.filter(Boolean);
  if (!variants.length) return undefined;
  return variants[Math.min(variants.length - 1, Math.floor(random() * variants.length))];
}
