import {
  ArrowRight,
  Map,
  Satellite,
  ShieldCheck,
  Sparkles,
  Sprout,
} from "lucide-react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header";
import MapView from "../components/MapView";
import FarmerPriorities from "../components/FarmerPriorities";
import FadeIn from "../components/FadeIn";

import type {
  FieldSelection,
  PriorityId,
} from "../types";

export default function Home() {
  const navigate = useNavigate();

  const [field, setField] =
    useState<FieldSelection | null>(null);

  const [priorities, setPriorities] =
    useState<PriorityId[]>([]);

  const [note, setNote] = useState("");

  const togglePriority = (
    id: PriorityId,
  ) => {
    setPriorities((current) =>
      current.includes(id)
        ? current.filter(
            (priority) => priority !== id,
          )
        : [...current, id],
    );
  };

  const handleAnalyze = () => {
    if (!field) return;

    sessionStorage.setItem(
      "farmrotate:field",
      JSON.stringify(field),
    );

    sessionStorage.setItem(
      "farmrotate:priorities",
      JSON.stringify(priorities),
    );

    sessionStorage.setItem(
      "farmrotate:note",
      note,
    );

    navigate("/analysis");
  };

  return (
    <div className="app-shell">
      <Header selected={!!field} />

      <main className="page-container">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-badge">
              <Sparkles size={15} />
              NASA Earth observation decision support
            </div>

            <h1>
              Make your next crop rotation
              <span> more resilient.</span>
            </h1>

            <p className="hero-description">
              FarmRotate helps you understand what
              your land is experiencing and compare
              crop rotation options against water,
              heat, soil and market pressures.
            </p>

            <div className="hero-principle">
              <ShieldCheck size={18} />

              <span>
                We don't tell farmers what to plant.
                We show what the land is experiencing,
                what options may be more resilient,
                and why.
              </span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />

            <div className="hero-center">
              <Satellite size={34} />
              <span>Earth</span>
              <strong>+ Field</strong>
            </div>

            <div className="floating-icon icon-one">
              💧
            </div>

            <div className="floating-icon icon-two">
              🌱
            </div>

            <div className="floating-icon icon-three">
              🌡️
            </div>

            <div className="floating-icon icon-four">
              🛰️
            </div>
          </div>
        </section>

        <FadeIn>
          <section className="workflow-card">
            <div className="workflow-step">
              <div className="workflow-number">
                01
              </div>

              <div>
                <strong>Select your field</strong>
                <span>
                  Draw it on the map or use coordinates.
                </span>
              </div>
            </div>

            <div className="workflow-line" />

            <div className="workflow-step">
              <div className="workflow-number">
                02
              </div>

              <div>
                <strong>Tell us what matters</strong>
                <span>
                  Choose as many farmer priorities as
                  needed.
                </span>
              </div>
            </div>

            <div className="workflow-line" />

            <div className="workflow-step">
              <div className="workflow-number">
                03
              </div>

              <div>
                <strong>Compare rotations</strong>
                <span>
                  See evidence, benefits, risks and
                  uncertainty.
                </span>
              </div>
            </div>
          </section>
        </FadeIn>

        <FadeIn>
          <section className="map-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  STEP 01 · FIELD
                </span>

                <h2>
                  Where is your field?
                </h2>

                <p>
                  Draw the field boundary for a more
                  precise area estimate, or use the
                  coordinate finder to jump to a
                  location.
                </p>
              </div>

              {field && (
                <div className="field-selected-badge">
                  <Map size={16} />
                  Field selected
                </div>
              )}
            </div>

            <MapView
              onFieldSelected={setField}
            />

            {field && (
              <div className="field-summary">
                <div>
                  <span>Field area</span>
                  <strong>
                    {field.area} ha
                  </strong>
                </div>

                <div>
                  <span>Latitude</span>
                  <strong>
                    {field.latitude.toFixed(6)}
                  </strong>
                </div>

                <div>
                  <span>Longitude</span>
                  <strong>
                    {field.longitude.toFixed(6)}
                  </strong>
                </div>

                <div>
                  <span>Boundary</span>
                  <strong>
                    Polygon selected
                  </strong>
                </div>
              </div>
            )}
          </section>
        </FadeIn>

        <FadeIn delay={80}>
          <FarmerPriorities
            selected={priorities}
            onToggle={togglePriority}
            note={note}
            onNoteChange={setNote}
          />
        </FadeIn>

        <FadeIn delay={120}>
          <section className="analyze-section">
            <div>
              <div className="analyze-icon">
                <Sprout size={24} />
              </div>

              <div>
                <h2>
                  Ready to explore your field?
                </h2>

                <p>
                  We'll compare at least three
                  rotation strategies and explain the
                  trade-offs.
                </p>
              </div>
            </div>

            <button
              className="primary-button analyze-button"
              onClick={handleAnalyze}
              disabled={!field}
            >
              Analyze my field
              <ArrowRight size={18} />
            </button>
          </section>
        </FadeIn>

        <section className="data-note">
          <Satellite size={18} />

          <div>
            <strong>
              Built for NASA Earth observations
            </strong>

            <p>
              The demo architecture is designed to
              combine NASA GIBS imagery with datasets
              such as SMAP, ECOSTRESS, GPM, Landsat,
              MODIS, NASA POWER, GRACE/GRACE-FO and
              SRTM.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}