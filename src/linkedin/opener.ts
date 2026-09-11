// Injects the fixed "LinkWise" tab on the right edge of a LinkedIn profile page — the only UI
// this extension adds to the page itself (besides the panel it opens). Clicking it toggles the
// in-page panel (see panel/mount.ts); it never reloads the page, never dims/blurs/shifts
// LinkedIn's own content, and never interferes with normal LinkedIn navigation. Styled entirely
// with inline styles rather than an injected stylesheet, so it can never be affected by (or
// accidentally affect) LinkedIn's own CSS.
const OPENER_ID = "finder-linkwise-opener";

function applyOpenerStyles(button: HTMLButtonElement): void {
  Object.assign(button.style, {
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
    zIndex: "2147483647",
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    padding: "12px 7px",
    margin: "0",
    border: "none",
    borderRadius: "8px 0 0 8px",
    background: "#0a66c2",
    color: "#ffffff",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.03em",
    lineHeight: "1",
    cursor: "pointer",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
    transition: "right 0.15s ease",
  });
}

/** Idempotent and safe to call repeatedly (e.g. on every collection tick) — only ever creates
 * the button once per page load and re-attaches the current click handler. LinkedIn's own SPA
 * navigation does not tear down `document.body`, so the button persists across profile-to-
 * profile navigation on its own; this is a self-healing check, not something expected to fire
 * often. */
export function ensureLinkWiseOpener(onToggle: () => void): void {
  const existing = document.getElementById(OPENER_ID) as HTMLButtonElement | null;
  if (existing) {
    existing.onclick = onToggle;
    return;
  }

  const button = document.createElement("button");
  button.id = OPENER_ID;
  button.type = "button";
  button.textContent = "LinkWise";
  button.setAttribute("aria-label", "Open or close the LinkWise panel");
  applyOpenerStyles(button);
  button.onclick = onToggle;

  document.body.appendChild(button);
}

/** Shifts the opener to hug the panel's left edge while it's open (so it stays visible and
 * clickable to close again), and back to the page's right edge once closed. */
export function setOpenerOffset(offsetPx: number): void {
  const existing = document.getElementById(OPENER_ID) as HTMLButtonElement | null;
  if (existing) existing.style.right = `${offsetPx}px`;
}

/** Removes the opener entirely — used only when this content script instance is being torn
 * down for a fresh one to replace it (see content.ts's teardown token), never during normal
 * operation. Leaving a stale button behind would risk a duplicate once the new instance's own
 * `ensureLinkWiseOpener` runs. */
export function removeLinkWiseOpener(): void {
  document.getElementById(OPENER_ID)?.remove();
}
