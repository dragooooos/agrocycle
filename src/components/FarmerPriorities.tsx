import {
  Bug,
  Coins,
  Droplets,
  Flame,
  Mountain,
  Sprout,
  Check,
} from "lucide-react";
import type {
  LucideIcon,
} from "lucide-react";
import type { PriorityId } from "../types";

interface PriorityOption {
  id: PriorityId;
  label: string;
  description: string;
  icon: LucideIcon;
}

const priorities: PriorityOption[] = [
  {
    id: "water",
    label: "Save water",
    description:
      "Reduce water pressure and drought exposure.",
    icon: Droplets,
  },
  {
    id: "soil",
    label: "Build soil health",
    description:
      "Improve soil structure and long-term fertility.",
    icon: Sprout,
  },
  {
    id: "heat",
    label: "Handle heat",
    description:
      "Increase resilience to hot and dry periods.",
    icon: Flame,
  },
  {
    id: "erosion",
    label: "Protect soil",
    description:
      "Reduce erosion and bare-soil exposure.",
    icon: Mountain,
  },
  {
    id: "pest",
    label: "Break pest cycles",
    description:
      "Increase crop diversity and disruption.",
    icon: Bug,
  },
  {
    id: "income",
    label: "Protect income",
    description:
      "Keep market fit and economic stability in mind.",
    icon: Coins,
  },
];

interface FarmerPrioritiesProps {
  selected: PriorityId[];
  onToggle: (id: PriorityId) => void;
  note: string;
  onNoteChange: (note: string) => void;
}

export default function FarmerPriorities({
  selected,
  onToggle,
  note,
  onNoteChange,
}: FarmerPrioritiesProps) {
  const count = selected.length;

  const message =
    count === 0
      ? "Choose the goals that matter most to you. The model will start from a balanced baseline."
      : count <= 3
        ? "These priorities will receive extra weight in the rotation comparison."
        : "You have several competing goals. FarmRotate will balance them and show where improving one dimension may create trade-offs elsewhere.";

  return (
    <section className="priority-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            FARMER INPUT
          </span>

          <h2>What matters most to you?</h2>

          <p>
            You can choose as many goals as you want.
            We will show the trade-offs instead of
            hiding them.
          </p>
        </div>

        <div className="selection-count">
          {count} selected
        </div>
      </div>

      <div className="priority-grid">
        {priorities.map((priority) => {
          const Icon = priority.icon;
          const active = selected.includes(
            priority.id,
          );

          return (
            <button
              key={priority.id}
              className={`priority-card ${
                active ? "selected" : ""
              }`}
              onClick={() =>
                onToggle(priority.id)
              }
              aria-pressed={active}
            >
              <div className="priority-icon">
                <Icon size={19} />
              </div>

              <div className="priority-content">
                <strong>{priority.label}</strong>
                <span>
                  {priority.description}
                </span>
              </div>

              <div className="priority-check">
                {active && <Check size={15} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="priority-message">
        <Sprout size={18} />
        <span>{message}</span>
      </div>

      <div className="farmer-note">
        <label htmlFor="farmer-note">
          Anything else we should know?
        </label>

        <textarea
          id="farmer-note"
          value={note}
          onChange={(event) =>
            onNoteChange(event.target.value)
          }
          placeholder="For example: limited irrigation, livestock feed needs, equipment constraints, local market preferences..."
          rows={4}
        />

        <small>
          This context is saved with your analysis and
          can be used by the future recommendation
          model.
        </small>
      </div>
    </section>
  );
}