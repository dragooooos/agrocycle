interface ScoreBarProps {
  value: number;
  label: string;
}

export default function ScoreBar({
  value,
  label,
}: ScoreBarProps) {
  return (
    <div className="score-row">
      <div className="score-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="score-track">
        <div
          className="score-fill"
          style={{
            width: `${Math.max(
              0,
              Math.min(value, 100),
            )}%`,
          }}
        />
      </div>
    </div>
  );
}