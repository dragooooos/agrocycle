import {
  AlertTriangle,
  Droplets,
  Flame,
  Leaf,
  MapPin,
  Mountain,
  Satellite,
  Sprout,
  Thermometer,
} from "lucide-react";

import {
  useMemo,
} from "react";

import Header from "../components/Header";
import MetricCard from "../components/MetricCard";
import RotationCard from "../components/RotationCard";
import FadeIn from "../components/FadeIn";

import {
  demoField,
  rotations,
} from "../data/demoData";

import type {
  FieldSelection,
  PriorityId,
} from "../types";

import {
  getScoreTone,
  rankRotations,
} from "../utils/scoring";

export default function Analysis() {
  const storedField =
    sessionStorage.getItem(
      "farmrotate:field",
    );

  const storedPriorities =
    sessionStorage.getItem(
      "farmrotate:priorities",
    );

  const storedNote =
    sessionStorage.getItem(
      "farmrotate:note",
    );

  const field: FieldSelection | null =
    storedField
      ? JSON.parse(storedField)
      : null;

  const priorities: PriorityId[] =
    storedPriorities
      ? JSON.parse(storedPriorities)
      : [];

  const farmerNote =
    storedNote || "";

  const rankedRotations = useMemo(
    () =>
      rankRotations(
        rotations,
        priorities,
      ),
    [priorities],
  );

  const topRotation =
    rankedRotations[0];

  const currentRotation =
    rotations.find((rotation) => rotation.id === "current") ?? rotations[0];

  const alternativeRotations =
    rankedRotations.filter((rotation) => rotation.id !== "current");

  const displayedRotations = [
    currentRotation,
    ...alternativeRotations,
  ];

  const score = demoField.resilienceScore;
  const tone = getScoreTone(score);

  return (
    <div className="app-shell">
      <Header selected />

      <main className="page-container analysis-page">
        <section className="analysis-hero">
          <div>
            <div className="hero-badge">
              <Satellite size={15} />
              Field analysis
            </div>

            <h1>
              Your field is showing
              <span> mixed resilience signals.</span>
            </h1>

            <p>
              The current demo signals suggest
              moderate water pressure, warmer-than-
              typical temperatures and some vegetation
              stress.
            </p>

            {field && (
              <div className="location-pill">
                <MapPin size={15} />

                <span>
                  {field.latitude.toFixed(6)},{" "}
                  {field.longitude.toFixed(6)}
                </span>

                <strong>
                  {field.selectionType === "point"
                    ? "Point analysis"
                    : `${field.area.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })} m²`}
                </strong>
              </div>
            )}
          </div>

          <div className="analysis-visual">
            <div className="analysis-visual-orbit" />

            <div className="analysis-icon satellite">
              <Satellite size={25} />
            </div>

            <div className="analysis-icon water">
              <Droplets size={23} />
            </div>

            <div className="analysis-icon heat">
              <Flame size={23} />
            </div>

            <div className="analysis-icon soil">
              <Mountain size={23} />
            </div>

            <div className="analysis-center">
              <Sprout size={32} />
              <span>FIELD</span>
            </div>
          </div>
        </section>

        <FadeIn>
          <section className="resilience-card">
            <div>
              <span className="eyebrow">
                FIELD RESILIENCE
              </span>

              <h2>
                Current resilience
              </h2>

              <p>
                This is a combined indicator of the
                current demo climate, water,
                vegetation and soil signals.
              </p>
            </div>

            <div
              className={`resilience-score ${tone}`}
            >
              <strong>{score}</strong>
              <span>/100</span>
            </div>

            <div className="resilience-meter">
              <div
                className={`resilience-fill ${tone}`}
                style={{
                  width: `${score}%`,
                }}
              />
            </div>

            <div className="resilience-legend">
              <span>
                <i className="green-dot" />
                Resilient
              </span>

              <span>
                <i className="yellow-dot" />
                Watch
              </span>

              <span>
                <i className="red-dot" />
                Higher pressure
              </span>
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  EARTH OBSERVATION SIGNALS
                </span>

                <h2>
                  What is happening on the field?
                </h2>

                <p>
                  These indicators summarize the
                  signals that influence the rotation
                  comparison.
                </p>
              </div>
            </div>

            <div className="metric-grid">
              <MetricCard
                icon={Thermometer}
                label="Mean temperature"
                value={`${demoField.climate.meanTemperature}°C`}
                description="Average seasonal temperature"
                status={
                  demoField.climate
                    .temperatureAnomaly > 1
                    ? "moderate"
                    : "good"
                }
                trend={
                  demoField.climate
                    .temperatureAnomaly
                }
              />

              <MetricCard
                icon={Flame}
                label="Heat stress"
                value={`${demoField.climate.heatStressDays} days`}
                description="Days with elevated heat pressure"
                status="moderate"
              />

              <MetricCard
                icon={Droplets}
                label="Rainfall"
                value={`${demoField.water.rainfall} mm`}
                description="Seasonal precipitation"
                status="moderate"
                trend={
                  demoField.water
                    .rainfallAnomaly
                }
              />

              <MetricCard
                icon={Droplets}
                label="Soil moisture"
                value={`${demoField.water.soilMoisture}`}
                description="Current modeled moisture indicator"
                status="bad"
                trend={
                  demoField.water
                    .soilMoistureAnomaly
                }
              />

              <MetricCard
                icon={Leaf}
                label="Vegetation"
                value={`${demoField.vegetation.ndvi}`}
                description="NDVI vegetation signal"
                status="moderate"
                trend={
                  demoField.vegetation
                    .ndviAnomaly
                }
              />

              <MetricCard
                icon={Mountain}
                label="Erosion risk"
                value={
                  demoField.soil
                    .erosionRisk
                }
                description={`Slope: ${demoField.soil.slope}%`}
                status="moderate"
              />
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section className="evidence-section">
            <div className="evidence-main">
              <span className="eyebrow">
                WHAT THE EVIDENCE SUGGESTS
              </span>

              <h2>
                Water pressure is the main signal
              </h2>

              <p>
                Soil moisture is below the reference
                level while rainfall is also lower
                than typical. At the same time,
                temperature pressure is elevated.
              </p>

              <div className="evidence-points">
                <div>
                  <Droplets size={19} />
                  <span>
                    Lower soil moisture increases
                    water-management pressure.
                  </span>
                </div>

                <div>
                  <Flame size={19} />
                  <span>
                    Warmer conditions increase the
                    importance of heat-tolerant
                    options.
                  </span>
                </div>

                <div>
                  <Mountain size={19} />
                  <span>
                    Soil coverage becomes more
                    valuable when erosion exposure
                    is moderate.
                  </span>
                </div>
              </div>
            </div>

            <div className="evidence-side">
              <div className="evidence-score">
                <strong>
                  {topRotation.score}
                </strong>

                <span>
                  personalized fit
                </span>
              </div>

              <p>
                Based on the priorities you selected,
                <strong>
                  {" "}
                  {topRotation.name}
                </strong>{" "}
                currently ranks highest.
              </p>
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  DECISION SUPPORT
                </span>

                <h2>
                  Compare rotation options
                </h2>

                <p>
                  The ranking changes according to
                  your priorities. No single rotation
                  is best for every objective.
                </p>
              </div>

              <div className="rotation-count">
                {priorities.length} priorities
                weighted
              </div>
            </div>

            <div className="rotation-list">
              {displayedRotations.map(
                (rotation, index) => (
                  <RotationCard
                    key={rotation.id}
                    rotation={rotation}
                    rank={index + 1}
                    collapsible={rotation.id !== "current"}
                  />
                ),
              )}
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section className="tradeoff-card">
            <div className="tradeoff-icon">
              <AlertTriangle size={23} />
            </div>

            <div>
              <span className="eyebrow">
                TRADE-OFFS & UNCERTAINTY
              </span>

              <h2>
                A strong option is not a guarantee.
              </h2>

              <p>
                The ranking reflects the evidence
                currently available in this demo. It
                does not replace local agronomic
                knowledge, field observations, market
                information or farm economics.
              </p>

              <div className="tradeoff-grid">
                <div>
                  <strong>
                    Weather uncertainty
                  </strong>

                  <span>
                    Future seasons can behave
                    differently from historical
                    patterns.
                  </span>
                </div>

                <div>
                  <strong>
                    Soil variability
                  </strong>

                  <span>
                    Field-level soil conditions can
                    vary considerably within the same
                    region.
                  </span>
                </div>

                <div>
                  <strong>
                    Market conditions
                  </strong>

                  <span>
                    Prices, contracts and local
                    demand should be validated.
                  </span>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>

        {farmerNote && (
          <FadeIn>
            <section className="farmer-context">
              <span className="eyebrow">
                YOUR CONTEXT
              </span>

              <h2>
                What you told FarmRotate
              </h2>

              <p>{farmerNote}</p>
            </section>
          </FadeIn>
        )}

        <FadeIn>
          <section className="sources-card">
            <div className="sources-header">
              <Satellite size={21} />

              <div>
                <span className="eyebrow">
                  DATA PROVENANCE
                </span>

                <h2>
                  Designed around NASA Earth
                  observations
                </h2>
              </div>
            </div>

            <p>
              The current interface uses demo
              analytical values. The production
              backend can connect these indicators to
              NASA Earth observation products.
            </p>

            <div className="source-tags">
              {[
                "SMAP",
                "ECOSTRESS",
                "GPM",
                "Landsat",
                "MODIS",
                "NASA POWER",
                "GRACE / GRACE-FO",
                "SRTM",
              ].map((source) => (
                <span key={source}>
                  {source}
                </span>
              ))}
            </div>

            <div className="demo-disclaimer">
              <AlertTriangle size={16} />

              <span>
                Demo values are illustrative. They
                should not be interpreted as actual
                measurements for the selected field
                until the NASA data backend is
                connected.
              </span>
            </div>
          </section>
        </FadeIn>
      </main>
    </div>
  );
}