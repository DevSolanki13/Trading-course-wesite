import { Plus } from "./icons";
import { faqs } from "../content/site";

export function Faq({
  compact = false,
  items = faqs,
}: {
  compact?: boolean;
  items?: { question: string; answer: string }[];
}) {
  return (
    <div className="faq-list">
      {(compact ? items.slice(0, 3) : items).map((item) => (
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
