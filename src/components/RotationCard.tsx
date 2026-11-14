import {
  AlertTriangle,
  CheckCircle2,
  Leaf,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import type { Rotation } from "../types";
import ScoreBar from "./ScoreBar";
import { getScoreTone } from "../utils/scoring";

interface RotationCardProps {
  rotation: Rotation;
  rank: number;
}

function cropEmoji(crop: string) {
  const normalized = crop.toLowerCase();

  if (normalized.includes("wheat")) return "🌾";
  if (normalized.includes("soy")) return "🫘";
  if (normalized.includes("corn")) return "🌽";
  if (normalized.includes("sunflower")) return "🌻";
  if (normalized.includes("cover")) return "🌱";

  return "🌿";
}

export default function RotationCard({
  rotation,
  rank,
}: RotationCardProps) {
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

          <div className="crop-list">
            {rotation.crops.map(
              (crop, index) => (
                <span
                  className="crop-pill"
                  key={crop}
                >
                  {cropEmoji(crop)}
                  {crop}

                  {index <
                    rotation.crops.length -
                      1 && (
                    <span className="arrow">
                      →
                    </span>
                  )}
                </span>
              ),
            )}
          </div>
        </div>

        <div
          className={`rotation-score ${tone}`}
        >
          <strong>{rotation.score}</strong>
          <span>/100</span>
        </div>
      </div>

      {highlights.length > 0 && (
        <div className="rotation-highlights">
          {highlights.map((highlight) => (
            <span key={highlight}>
              <CheckCircle2 size={13} />
              {highlight}
            </span>
          ))}
        </div>
      )}

      <p className="rotation-explanation">
        {rotation.explanation}
      </p>

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
      </div>

      <div className="confidence">
        <ShieldCheck size={16} />

        <span>
          Recommendation confidence:{" "}
          <strong>
            {rotation.confidence}
          </strong>
        </span>
      </div>

      <div className="rotation-source">
        <TrendingUp size={15} />
        Evidence will combine climate,
        moisture, vegetation and soil signals.
      </div>
    </article>
  );
}