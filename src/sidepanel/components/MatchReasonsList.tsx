import type { MatchReason } from "../../matching/scoreProfile";

interface MatchReasonsListProps {
  reasons: MatchReason[];
}

const IMPORTANCE_LABEL: Record<string, string> = {
  MUST_HAVE: "Must Have",
  PREFERRED: "Preferred",
  OPTIONAL: "Optional",
};

export function MatchReasonsList({ reasons }: MatchReasonsListProps) {
  const met = reasons.filter((r) => r.status === "MET");
  if (met.length === 0) {
    return <p className="section-empty">No criteria were confirmed on this profile yet.</p>;
  }

  return (
    <ul className="reason-list">
      {met.map((reason) => (
        <li key={reason.criterion.id} className="reason-item">
          <div className="reason-item__header">
            <span className="reason-item__icon" aria-hidden>
              ✓
            </span>
            <span className="reason-item__label">{reason.criterion.label}</span>
            <span className="reason-item__importance">{IMPORTANCE_LABEL[reason.criterion.importance]}</span>
            {reason.confidence === "moderate" && <span className="reason-item__confidence">related match</span>}
          </div>
          <div className="reason-item__evidence">
            <span className="reason-item__field">{reason.evidence.fieldLabel}:</span> "{reason.evidence.snippet}"
          </div>
        </li>
      ))}
    </ul>
  );
}
