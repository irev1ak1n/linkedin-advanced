// Self-contained CSS for the in-page panel's shadow root — deliberately isolated from
// LinkedIn's own stylesheet (nothing here can leak out, nothing of LinkedIn's can leak in).
// Kept simple on purpose: correct behavior over final polish for this milestone.
//
// Takes the panel width as a parameter rather than hardcoding it a second time here — mount.ts's
// PANEL_WIDTH_PX is the one source of truth, also used to offset the opener button so the two
// can never drift apart.
export function getPanelStyles(widthPx: number): string {
  return `
  :host, * {
    box-sizing: border-box;
  }
  .lw-panel {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: ${widthPx}px;
    background: #ffffff;
    border-left: 1px solid #d0d7dd;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.12);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
  }
  .lw-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid #e4e9ed;
    flex-shrink: 0;
  }
  .lw-panel__brand {
    font-weight: 700;
    font-size: 15px;
    color: #0a66c2;
  }
  .lw-panel__close {
    border: none;
    background: transparent;
    font-size: 14px;
    cursor: pointer;
    color: #56687a;
    line-height: 1;
    padding: 4px;
  }
  .lw-panel__body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
  }
  .lw-empty {
    color: #56687a;
    font-style: italic;
  }

  /* Scanning state */
  .lw-scanning__title {
    font-weight: 600;
    margin: 0 0 4px;
  }
  .lw-scanning__for {
    color: #445;
    margin: 0 0 8px;
  }
  .lw-scanning__hint {
    color: #56687a;
    font-size: 12px;
    margin: 0 0 14px;
  }
  .lw-fraction {
    font-weight: 600;
    font-size: 12px;
    margin: 8px 0 4px;
  }
  .lw-progress {
    height: 6px;
    border-radius: 3px;
    background: #e4e9ed;
    overflow: hidden;
  }
  .lw-progress__fill {
    height: 100%;
    background: #0a66c2;
    border-radius: 3px;
    transition: width 0.2s ease;
  }
  .lw-checklist {
    list-style: none;
    margin: 8px 0 16px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lw-checklist li.is-done {
    color: #057642;
  }
  .lw-checklist li.is-pending {
    color: #8a949c;
  }

  .lw-button {
    font: inherit;
    border-radius: 16px;
    padding: 6px 14px;
    cursor: pointer;
    border: 1px solid #0a66c2;
    color: #0a66c2;
    background: #fff;
  }
  .lw-button--secondary {
    width: 100%;
  }

  /* Analysis state */
  .lw-summary-card {
    text-align: center;
    padding: 16px;
    border-radius: 10px;
    background: #f3f6f8;
    margin-bottom: 16px;
  }
  .lw-summary-card__level {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #56687a;
  }
  .lw-summary-card--strong .lw-summary-card__level {
    color: #057642;
  }
  .lw-summary-card--good .lw-summary-card__level {
    color: #0a66c2;
  }
  .lw-summary-card--low .lw-summary-card__level {
    color: #8a6d00;
  }
  .lw-summary-card--excluded .lw-summary-card__level {
    color: #c0392b;
  }
  .lw-summary-card__score {
    font-size: 32px;
    font-weight: 700;
    margin-top: 4px;
  }
  .lw-summary-card__target {
    font-size: 12px;
    color: #445;
    margin-top: 6px;
  }
  .lw-summary-card__note {
    font-size: 11.5px;
    color: #8a6d00;
    margin: 8px 0 0;
  }

  .lw-section {
    margin-bottom: 16px;
  }
  .lw-section h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #56687a;
    margin: 0 0 8px;
  }
  .lw-title-alignment {
    margin: 0;
    font-size: 12.5px;
  }
  .lw-title-alignment--aligned {
    color: #057642;
  }
  .lw-title-alignment--partial {
    color: #8a6d00;
  }
  .lw-title-alignment--unclear {
    color: #56687a;
  }

  .lw-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lw-chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    border: 1px solid transparent;
  }
  .lw-chip--matched {
    background: #e6f4ea;
    color: #057642;
    border-color: #b7dfc4;
  }
  .lw-chip--missing {
    background: #fdecea;
    color: #c0392b;
    border-color: #f3c6c1;
  }
`;
}
