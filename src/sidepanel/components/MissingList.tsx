import type { MissingItem } from "../../matching/scoreProfile";

interface MissingListProps {
  missing: MissingItem[];
}

const IMPORTANCE_LABEL: Record<string, string> = {
  MUST_HAVE: "Must Have",
  PREFERRED: "Preferred",
  OPTIONAL: "Optional",
};

export function MissingList({ missing }: MissingListProps) {
  if (missing.length === 0) {
    return <p className="section-empty">Nothing missing — every criterion was addressed above.</p>;
  }

  return (
    <ul className="missing-list">
      {missing.map((item) => (
        <li key={item.criterion.id} className="missing-item">
          <div className="missing-item__header">
            <span className="missing-item__icon" aria-hidden>
              ?
            </span>
            <span className="missing-item__label">{item.criterion.label}</span>
            <span className="missing-item__importance">{IMPORTANCE_LABEL[item.criterion.importance]}</span>
          </div>
          <div className="missing-item__note">{item.note ?? "No supporting information found on this profile."}</div>
        </li>
      ))}
    </ul>
  );
}
