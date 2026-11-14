import { ArrowLeft, Leaf, Satellite } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

interface HeaderProps {
  selected?: boolean;
}

export default function Header({ selected = false }: HeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isAnalysis = location.pathname === "/analysis";
  const backTo = isAnalysis ? "/map" : "/";

  return (
    <header className="header">
      <div className="brand">
        {isHome ? (
          <div className="brand-icon"><Leaf size={22} /></div>
        ) : (
          <Link to={backTo} className="back-button" aria-label="Go back">
            <ArrowLeft size={17} />
          </Link>
        )}
        <Link to="/" className="brand-copy">
          <div className="brand-name">AgroCycle</div>
          <div className="brand-subtitle">Climate-smart crop decisions</div>
        </Link>
      </div>

      <div className="header-right">
        {selected && (
          <div className="data-badge">
            <Satellite size={15} />
            NASA Earth observation demo
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
