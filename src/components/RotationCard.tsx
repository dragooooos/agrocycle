import { useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Leaf,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import type { Rotation, RotationYear } from "../types";
import ScoreBar from "./ScoreBar";
import { getScoreTone } from "../utils/scoring";

interface RotationCardProps {
  rotation: Rotation;
  rank: number;
  collapsible?: boolean;
}

function cropEmoji(crop: string) {
  const normalized = crop.toLowerCase();

  if (normalized.includes("wheat")) return "🌾";
  if (normalized.includes("soy")) return "🫘";
  if (normalized.includes("corn")) return "🌽";
  if (normalized.includes("sunflower")) return "🌻";
  if (normalized.includes("cover")) return "🌱";
  if (normalized.includes("pea")) return "🫛";
  if (normalized.includes("sorghum")) return "🌾";

  return "🌿";
}

export default function RotationCard({
  rotation,
  rank,
  collapsible = false,
}: RotationCardProps) {
  const [expanded, setExpanded] = useState(!collapsible);
  const tone = getScoreTone(
    rotation.score,
  );

  const highlights = [];

  if (rotation.water >= 80) {
    highlights.push("Water-smart");
  }

  if (rotation.soil >= 80) {
    highlights.push("Soil-building");
  }

  if (rotation.heat >= 80) {
    highlights.push("Heat-tolerant");
  }

  if (rotation.erosion >= 80) {
    highlights.push("Erosion-aware");
  }

  return (
    <article
      className={`rotation-card ${
        rotation.recommended
          ? "recommended"
          : ""
      }`}
    >
      {rotation.recommended && (
        <div className="recommended-badge">
          <CheckCircle2 size={14} />
          Best match for your priorities
        </div>
      )}

      <div className="rotation-header">
        <div className="rotation-rank">
          #{rank}
        </div>

        <div className="rotation-title">
          <h3>{rotation.name}</h3>

          <div className="rotation-tags">
            {rotation.strategy && (
              <span className={`strategy-tag ${rotation.id === "current" ? "baseline" : ""}`}>
                {rotation.strategy}
              </span>
            )}
            {rotation.fit !== undefined && <span className="fit-tag">Climate & soil fit {rotation.fit}/100</span>}
            <span className="fit-tag">{rotation.crops.map((crop) => cropEmoji(crop)).join(" ")}</span>
          </div>
        </div>

        <div
          className={`rotation-score ${tone}`}
        >
          <strong>{rotation.score}</strong>
          <span>/100</span>
        </div>
      </div>

      {expanded && highlights.length > 0 && (
        <div className="rotation-highlights">
          {highlights.map((highlight) => (
            <span key={highlight}>
              <CheckCircle2 size={13} />
              {highlight}
            </span>
          ))}
        </div>
      )}

      <p className={`rotation-explanation ${!expanded ? "collapsed-explanation" : ""}`}>
        {rotation.explanation}
      </p>

      {rotation.calendar && <RotationCalendar years={rotation.calendar} />}

      {collapsible && !expanded && (
        <button
          type="button"
          className="see-more-button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
        >
          See more
          <span>↓</span>
        </button>
      )}

      {expanded && <>
        <div className="rotation-scores">
        <ScoreBar
          value={rotation.water}
          label="💧 Water resilience"
        />

        <ScoreBar
          value={rotation.soil}
          label="🌱 Soil health"
        />

        <ScoreBar
          value={rotation.heat}
          label="🌡️ Heat tolerance"
        />

        <ScoreBar
          value={rotation.erosion}
          label="⛰️ Erosion protection"
        />

        <ScoreBar
          value={rotation.pest}
          label="🐛 Pest disruption"
        />

        <ScoreBar
          value={rotation.market}
          label="💰 Market fit"
        />
      </div>

      <div className="rotation-columns">
        <div>
          <h4>
            <Leaf size={16} />
            Potential benefits
          </h4>

          <ul>
            {rotation.benefits.map(
              (benefit) => (
                <li key={benefit}>
                  <CheckCircle2 size={15} />
                  {benefit}
                </li>
              ),
            )}
          </ul>
        </div>

        <div>
          <h4>
            <AlertTriangle size={16} />
            Things to verify
          </h4>

          <ul>
            {rotation.risks.map((risk) => (
              <li key={risk}>
                <AlertTriangle size={15} />
                {risk}
              </li>
            ))}
          </ul>
        </div>

        {rotation.infoGaps && rotation.infoGaps.length > 0 && (
          <div>
            <h4>
              <HelpCircle size={16} />
              Information gaps
            </h4>
            <ul>
              {rotation.infoGaps.map((gap) => (
                <li key={gap}>
                  <HelpCircle size={15} />
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
      </>}

      {expanded && <div className="confidence">
        <ShieldCheck size={16} />

        <span>
          Recommendation confidence:{" "}
          <strong>
            {rotation.confidence}
          </strong>
        </span>
      </div>}

      {expanded && rotation.evidence && rotation.evidence.length > 0 && (
        <div className="rotation-source rotation-evidence">
          <TrendingUp size={15} />
          <div>
            <strong>Evidence from NASA data for this field</strong>
            <ul>
              {rotation.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {collapsible && expanded && (
        <button
          type="button"
          className="see-more-button see-less-button"
          onClick={() => setExpanded(false)}
          aria-expanded={true}
        >
          Show less
          <span>↑</span>
        </button>
      )}
    </article>
  );
}
const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

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
            return (
              <i
                key={month}
                className={segment ? `cell ${segment.role}` : "cell bare"}
                title={segment ? `${segment.name}` : "Bare soil"}
              >
                {segment && segment.months[0] === month ? segment.emoji : ""}
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
