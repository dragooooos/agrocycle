import { BarChart3, Home, Map } from "lucide-react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

/** Pages can render their own sidebar actions into this element via a portal. */
export const SIDE_NAV_ACTIONS_ID = "side-nav-actions";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/map", label: "Field map", icon: Map },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
];

/**
 * Small floating navigation bar at the top centre of the screen.
 * Shows icons only; labels slide out while it is hovered or focused.
 */
export default function Sidebar() {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      <ul className="side-nav-list">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              aria-label={label}
              className={({ isActive }) =>
                `side-nav-link${isActive ? " is-active" : ""}`
              }
            >
              <span className="side-nav-icon">
                <Icon size={17} />
              </span>
              <span className="side-nav-label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="side-nav-footer">
        <div id={SIDE_NAV_ACTIONS_ID} className="side-nav-actions" />
        <ThemeToggle className="side-nav-link side-nav-button" />
      </div>
    </nav>
  );
}