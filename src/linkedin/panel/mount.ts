// Mounts the LinkWise panel directly into the LinkedIn page as a fixed, right-anchored,
// full-height element — a page-mounted panel, not the browser's own side panel. Rendered
// inside a shadow root so LinkedIn's CSS can never leak in and this panel's CSS can never leak
// out. The React tree is created once and kept alive; toggling only shows/hides the host, so
// re-opening never loses in-panel state or re-fetches anything.
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PanelApp } from "./PanelApp";
import { getPanelStyles } from "./panelStyles";
import { setOpenerOffset } from "../opener";

const HOST_ID = "finder-linkwise-panel-host";
export const PANEL_WIDTH_PX = 360;

let hostElement: HTMLDivElement | null = null;
let root: Root | null = null;

function ensureHost(): HTMLDivElement {
  if (hostElement && document.body.contains(hostElement)) return hostElement;

  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100vh",
    zIndex: "2147483646", // one below the opener button, which stays clickable to close
    display: "none",
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = getPanelStyles(PANEL_WIDTH_PX);
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  root = createRoot(mountPoint);
  root.render(createElement(PanelApp, { onClose: closePanel }));

  hostElement = host;
  return host;
}

export function isPanelOpen(): boolean {
  return hostElement?.style.display === "block";
}

/**
 * Both open and close live here, alongside the opener-offset update, rather than leaving the
 * caller responsible for keeping the two in sync — the panel can be closed from more than one
 * place (the opener button's own toggle, or the panel's own "✕"), and every one of them must
 * reset the opener back to the viewport's right edge, not just the toggle path.
 */
export function openPanel(): void {
  ensureHost().style.display = "block";
  setOpenerOffset(PANEL_WIDTH_PX);
}

export function closePanel(): void {
  if (hostElement) hostElement.style.display = "none";
  setOpenerOffset(0);
}

export function togglePanel(): void {
  if (isPanelOpen()) closePanel();
  else openPanel();
}

/** Unmounts the React tree and removes the host entirely — used only when this content script
 * instance is being torn down for a fresh one to replace it (see content.ts's teardown token).
 * Never called during normal open/close; that only toggles visibility, which is what lets a
 * reopen skip re-fetching anything. */
export function destroyPanel(): void {
  root?.unmount();
  root = null;
  hostElement?.remove();
  hostElement = null;
}
