import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  status: "good" | "moderate" | "bad";
  trend?: number | null;
  /** Text shown next to the arrow instead of the default "n%". */
  trendText?: string;
}

export default function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  status,
  trend,
  trendText,
}: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <div
          className={`metric-icon ${status}`}
        >
          <Icon size={21} />
        </div>

        {trend !== undefined && trend !== null && (
          <div
            className={`trend ${
              trend > 0
                ? "up"
                : trend < 0
                  ? "down"
                  : ""
            }`}
          >
            {trend > 0 ? (
              <ArrowUp size={14} />
            ) : trend < 0 ? (
              <ArrowDown size={14} />
            ) : (
              <Minus size={14} />
            )}

            {trendText ?? `${Math.abs(trend)}%`}
          </div>
        )}
      </div>

      <div className="metric-label">
        {label}
      </div>

      <div className="metric-value">
        {value}
      </div>

      <div className="metric-description">
        {description}
      </div>
    </div>
  );
}