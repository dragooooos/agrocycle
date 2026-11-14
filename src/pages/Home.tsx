import {
  ArrowRight,
  Droplets,
  Mountain,
  Satellite,
  ShieldCheck,
  Sprout,
  Thermometer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import EarthScene from "../components/EarthScene";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <Header />

      <main className="landing-page landing-screen">
        <section className="landing-hero landing-hero-screen">
          <div className="landing-copy">
            <div className="hero-badge">
              <Satellite size={15} />
              NASA Earth observation decision support
            </div>

            <h1>
              Build crop rotations that are
              <span> ready for a changing climate.</span>
            </h1>

            <p className="hero-description">
              AgroCycle combines Earth observation signals, local field context,
              crop characteristics and farmer priorities to help you explore
              more resilient crop-rotation strategies.
            </p>

            <div className="hero-actions">
              <button className="primary-button" onClick={() => navigate("/map")}>
                Explore your field
                <ArrowRight size={18} />
              </button>
              <span className="hero-action-note">
                Point or field analysis · no account required
              </span>
            </div>

            <div className="landing-feature-row">
              <div><Satellite size={17} /><span>Earth observations</span></div>
              <div><Droplets size={17} /><span>Water resilience</span></div>
              <div><Sprout size={17} /><span>Soil health</span></div>
              <div><Thermometer size={17} /><span>Climate stress</span></div>
            </div>

            <div className="hero-principle">
              <ShieldCheck size={18} />
              <span>
                Decision support, not a prescription. Local farmer and agronomist
                knowledge remains essential.
              </span>
            </div>
          </div>

          <div className="landing-visual landing-visual-three">
            <div className="scene-glow" />
            <EarthScene />
            <div className="scene-label scene-label-top">
              <Satellite size={14} /> NASA LAND OBSERVATION
            </div>
            <div className="scene-label scene-label-bottom">
              <span className="pulse-dot" /> Interactive satellite visualization
            </div>
          </div>
        </section>

        <section className="landing-info-strip">
          <article>
            <span>01</span>
            <div><strong>Choose a location</strong><p>Use your location, coordinates, a map point or a field boundary.</p></div>
          </article>
          <article>
            <span>02</span>
            <div><strong>Set your priorities</strong><p>Weight water, soil health, heat, erosion, pests or income.</p></div>
          </article>
          <article>
            <span>03</span>
            <div><strong>Compare rotations</strong><p>Explore evidence, trade-offs, uncertainty and confidence.</p></div>
          </article>
        </section>
      </main>
    </div>
  );
}
