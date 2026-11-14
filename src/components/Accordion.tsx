import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface AccordionItem {
  id: string;
  title: string;
  hint?: string;
  render: () => ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  open: Set<string>;
  onToggle: (id: string) => void;
}

/** FAQ-style list: titles stacked, content rendered only when opened. */
export default function Accordion({ items, open, onToggle }: AccordionProps) {
  return (
    <div className="faq">
      {items.map((item) => {
        const isOpen = open.has(item.id);
        return (
          <section key={item.id} id={`faq-${item.id}`} className={`faq-item ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              className="faq-question"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${item.id}`}
              onClick={() => onToggle(item.id)}
            >
              <span>
                <strong>{item.title}</strong>
                {item.hint && <small>{item.hint}</small>}
              </span>
              <ChevronDown size={20} className="faq-chevron" />
            </button>
            {isOpen && (
              <div className="faq-answer" id={`faq-panel-${item.id}`}>
                {item.render()}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
