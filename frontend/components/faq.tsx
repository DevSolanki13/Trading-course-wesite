import { Plus } from "./icons";
import { faqs } from "../content/site";

export function Faq({ compact = false }: { compact?: boolean }) {
  return (
    <div className="faq-list">
      {(compact ? faqs.slice(0, 3) : faqs).map((item) => (
        <details key={item.question}>
          <summary>
            {item.question}
            <Plus size={20} aria-hidden="true" />
          </summary>
          <div className="faq-answer">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
