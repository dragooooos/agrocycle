import "./Home.css";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EarthScene from "../components/EarthScene";
import ThemeToggle from "../components/ThemeToggle";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <div className="landing-theme-toggle">
        <ThemeToggle />
      </div>

      <main className="landing-stage">
        <div className="landing-stage-earth" aria-hidden="true">
          <div className="scene-glow" />
          <EarthScene />
        </div>
        <div className="landing-stage-veil" aria-hidden="true" />

        <section className="landing-stage-copy">
          <h1>
            <span>Build crop rotations that are</span>{" "}
            <span>ready for a changing climate.</span>
          </h1>

          <p className="hero-description">
            AgroCycle combines Earth observation signals, local field context,
            crop characteristics and farmer priorities to help you explore
            more resilient crop-rotation strategies.
          </p>

          <div className="landing-stage-action">
            <button className="primary-button" onClick={() => navigate("/map")}>
              Explore your field
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}