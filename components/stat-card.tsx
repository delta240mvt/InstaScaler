/**
 * Stat Card
 *
 * Metric panel with label, value, and optional trend.
 */

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ label, value, trend, trendUp }: StatCardProps) {
  return (
    <div className="app-card min-w-0 p-4 sm:p-5">
      <div className="mb-4 h-1 w-8 rounded-full bg-accent/20" />
      <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold tracking-[-0.04em] text-foreground sm:text-3xl">{value}</p>
      {trend && (
        <p className={`mt-2 text-xs font-medium ${trendUp ? "text-success" : "text-error"}`}>
          {trendUp ? "Up" : "Down"} {trend}
        </p>
      )}
    </div>
  );
}
