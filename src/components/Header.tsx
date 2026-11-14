import {
  ArrowLeft,
  Leaf,
  Satellite,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  selected?: boolean;
}

export default function Header({
  selected = false,
}: HeaderProps) {
  const location = useLocation();

  const isAnalysis = location.pathname === "/analysis";

  return (
    <header className="header">
      <div className="brand">
        {isAnalysis ? (
          <Link to="/" className="back-button">
            <ArrowLeft size={17} />
          </Link>
        ) : (
          <div className="brand-icon">
            <Leaf size={22} />
          </div>
        )}

        <Link to="/" className="brand-copy">
          <div className="brand-name">FarmRotate</div>
          <div className="brand-subtitle">
            Climate-smart crop decisions
          </div>
        </Link>
      </div>

      <div className="header-right">
        {selected && (
          <div className="data-badge">
            <Satellite size={15} />
            Earth observation demo
          </div>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}