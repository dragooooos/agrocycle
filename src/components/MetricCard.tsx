import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  trend?: number | null;
  /** Text shown for the change instead of the default "n%". */
  trendText?: string;
  /** Colours the value: green = fine, yellow = watch, red = concern. */
  tone?: MetricTone;
}

export type MetricTone = "good" | "watch" | "bad";

const TONE_LABEL: Record<MetricTone, string> = { good: "fine", watch: "worth watching", bad: "concern" };

export default function MetricCard({ icon: Icon, label, value, description, trend, trendText, tone }: MetricCardProps) {
  const change =
    trend === undefined || trend === null
      ? null
      : `${trend > 0 ? "+" : trend < 0 ? "−" : ""}${trendText ?? `${Math.abs(trend)}%`} vs normal`;
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        <Icon className="metric-icon" aria-hidden="true" />
        {tone ? (
          <span className={`metric-number tone-${tone}`} title={TONE_LABEL[tone]}>
            {value}
          </span>
        ) : (
          value
        )}
      </div>
      <div className="metric-description">
        {description}
        {change && <span className="trend">{change}</span>}
      </div>
    </div>
  );
}
