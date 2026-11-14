import { BarChart3, Home, Map } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/map", label: "Field map", icon: Map },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
];

/**
 * Left navigation rail on desktop (expands on hover to show labels),
 * horizontal navbar at the top on mobile.
 */
export default function Sidebar() {
  return (
    <nav className="side-nav" aria-label="Main navigation">
      <ul className="side-nav-list">
        {links.map(({ to, label, icon: Icon }, index) => (
          <li key={to} style={{ animationDelay: `${0.15 + index * 0.08}s` }}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `side-nav-link${isActive ? " is-active" : ""}`
              }
            >
              <span className="side-nav-icon">
                <Icon size={19} />
              </span>
              <span className="side-nav-label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
