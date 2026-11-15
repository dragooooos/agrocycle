import { useState, type CSSProperties } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { Rotation, RotationYear } from "../types";
import ScoreBar from "./ScoreBar";

interface RotationCardProps {
  rotation: Rotation;
  rank: number;
  collapsible?: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const unique = (lines: string[] = []) => [...new Set(lines)];

export function cropSchedule(years: RotationYear[] = []) {
  const seen = new Set<string>();
  const out: { name: string; plant: string; harvest: string; wholeYear: boolean }[] = [];
  years.forEach((year) =>
    year.segments.forEach((segment) => {
      const key = `${segment.name}-${segment.months[0]}-${segment.months[segment.months.length - 1]}`;
      if (seen.has(key) || segment.months.length === 0) return;
      seen.add(key);
      out.push({
        name: segment.name,
        plant: MONTHS[segment.months[0]],
        harvest: MONTHS[segment.months[segment.months.length - 1]],
        wholeYear: segment.months.length >= 12,
      });
    }),
  );
  return out;
}

export default function RotationCard({ rotation, rank, collapsible = false }: RotationCardProps) {
  const [expanded, setExpanded] = useState(!collapsible);
  const schedule = cropSchedule(rotation.calendar);
  const meta = [
    rotation.recommended ? "Best match for your priorities" : null,
    rotation.strategy,
    rotation.fit !== undefined ? `Climate & soil fit ${rotation.fit}/100` : null,
  ].filter(Boolean);

  return (
    <article className={`rotation-card ${rotation.recommended ? "recommended" : ""}`}>
      <div className="rotation-header">
        <span className="rotation-rank">{rank}</span>
        <div className="rotation-title">
          <h3>{rotation.name}</h3>
          <p className="rotation-meta">{meta.join(" · ")}</p>
        </div>
        <div className="rotation-score">
          <strong>{rotation.score}</strong>
          <span>/100</span>
        </div>
      </div>

      {rotation.calendar && <RotationCalendar years={rotation.calendar} />}

      {schedule.length > 0 && (
        <p className="rotation-schedule">
          {schedule.map((crop, index) => (
            <span key={`${crop.name}-${index}`}>
              <b>{crop.name}</b>{" "}
              {crop.wholeYear ? "all year" : `plant ${crop.plant}, harvest ${crop.harvest}`}
            </span>
          ))}
        </p>
      )}

      {expanded && (
        <>
          <div className="rotation-scores">
            <ScoreBar value={rotation.water} label="Water" />
            <ScoreBar value={rotation.soil} label="Soil health" />
            <ScoreBar value={rotation.heat} label="Heat" />
            <ScoreBar value={rotation.erosion} label="Erosion" />
            <ScoreBar value={rotation.pest} label="Pests" />
            <ScoreBar value={rotation.market} label="Market" />
          </div>

          <div className="rotation-columns">
            {unique(rotation.benefits).length > 0 && (
              <div>
                <h4>Benefits</h4>
                <ul>
                  {unique(rotation.benefits).map((benefit, index) => (
                    <li key={index}>
                      <CheckCircle2 size={14} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {unique(rotation.risks).length > 0 && (
              <div>
                <h4>Check first</h4>
                <ul>
                  {unique(rotation.risks).map((risk, index) => (
                    <li key={index}>
                      <AlertTriangle size={14} />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {unique(rotation.evidence).length > 0 && (
            <details className="rotation-evidence">
              <summary>Field data behind this score · confidence {rotation.confidence}</summary>
              <ul>
                {unique(rotation.evidence).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {collapsible && (
        <button
          type="button"
          className="rotation-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show details"}
        </button>
      )}
    </article>
  );
}

function RotationCalendar({ years }: { years: RotationYear[] }) {
  return (
    <div className="rotation-calendar" aria-label="Rotation calendar">
      <div className="calendar-row calendar-head">
        <span />
        {MONTH_LETTERS.map((letter, index) => (
          <i key={index}>{letter}</i>
        ))}
      </div>
      {years.map((year) => (
        <div className="calendar-row" key={year.label}>
          <span>{year.label}</span>
          {MONTH_LETTERS.map((_, month) => {
            const segment = year.segments.find((seg) => seg.months.includes(month));
            const startsHere = segment && (month === 0 || !segment.months.includes(month - 1));
            let run = 0;
            while (segment && month + run < 12 && segment.months.includes(month + run)) run += 1;
            return (
              <i key={month} className={segment ? `cell ${segment.role}` : "cell bare"} title={segment ? segment.name : "Bare soil"}>
                {startsHere && (
                  <span className="cell-label" style={{ "--run": run } as CSSProperties}>
                    {segment.name}
                  </span>
                )}
              </i>
            );
          })}
        </div>
      ))}
      <div className="calendar-legend">
        <span><i className="cell main" /> Main crop</span>
        <span><i className="cell second" /> Second crop</span>
        <span><i className="cell cover" /> Cover crop</span>
        <span><i className="cell bare" /> Bare soil</span>
      </div>
    </div>
  );
}
