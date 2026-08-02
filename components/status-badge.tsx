/**
 * Status label for DM status. Plain text; color carries the state.
 */

const statusConfig: Record<string, { tone: string; dot: string; label: string }> = {
  SENT: { tone: "border-success/15 bg-success/8 text-success", dot: "bg-success", label: "Sent" },
  COMPLETED: { tone: "border-success/15 bg-success/8 text-success", dot: "bg-success", label: "Completed" },
  FAILED: { tone: "border-error/15 bg-error/7 text-error", dot: "bg-error", label: "Failed" },
  PENDING: { tone: "border-warning/15 bg-warning/8 text-warning", dot: "bg-warning", label: "Pending" },
  PROCESSING: { tone: "border-accent/15 bg-accent/7 text-accent", dot: "bg-accent", label: "Processing" },
  RETRYING: { tone: "border-warning/15 bg-warning/8 text-warning", dot: "bg-warning", label: "Retrying" },
  SKIPPED_DEDUP: { tone: "border-border bg-surface-hover text-muted", dot: "bg-muted", label: "Dedup" },
  SKIPPED_RATE_LIMIT: { tone: "border-warning/15 bg-warning/8 text-warning", dot: "bg-warning", label: "Rate limited" },
  SKIPPED_PLAN_LIMIT: { tone: "border-warning/15 bg-warning/8 text-warning", dot: "bg-warning", label: "Skipped" },
  SKIPPED_NO_MATCH: { tone: "border-border bg-surface-hover text-muted", dot: "bg-muted", label: "No match" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.PENDING;

  return (
    <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${config.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
