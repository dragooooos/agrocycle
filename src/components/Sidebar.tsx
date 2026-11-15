import { BarChart3, Home, Map } from "lucide-react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export const SIDE_NAV_ACTIONS_ID = "side-nav-actions";

const startLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/map", label: "Field map", icon: Map },
];

const endLinks = [{ to: "/analysis", label: "Analysis", icon: BarChart3 }];

function NavItems({ items }: { items: typeof startLinks }) {
  return (
    <ul className="side-nav-list">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={to === "/"}
            aria-label={label}
            className={({ isActive }) => `side-nav-link${isActive ? " is-active" : ""}`}
          >
            <span className="side-nav-icon">
              <Icon size={17} />
            </span>
            <span className="side-nav-label">{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default function Sidebar() {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      <div className="side-nav-start">
        <NavItems items={startLinks} />
      </div>

      <img className="side-nav-logo" src="/logo-circle.png" alt="AgroCycle" width={28} height={28} />

      <div className="side-nav-end">
        <NavItems items={endLinks} />
        <div className="side-nav-footer">
          <div id={SIDE_NAV_ACTIONS_ID} className="side-nav-actions" />
          <ThemeToggle className="side-nav-link side-nav-button" showLabel />
        </div>
      </div>
    </nav>
  );
}
