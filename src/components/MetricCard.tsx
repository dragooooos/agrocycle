import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  trend?: number | null;
  /** Text shown for the change instead of the default "n%". */
  trendText?: string;
}

export default function MetricCard({ icon: Icon, label, value, description, trend, trendText }: MetricCardProps) {
  const change =
    trend === undefined || trend === null
      ? null
      : `${trend > 0 ? "+" : trend < 0 ? "−" : ""}${trendText ?? `${Math.abs(trend)}%`} vs normal`;
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        <Icon className="metric-icon" aria-hidden="true" />
        {value}
      </div>
      <div className="metric-description">
        {description}
        {change && <span className="trend">{change}</span>}
      </div>
    </div>
  );
}
