import { useSyncExternalStore } from "react";
import { getPanelProfileData, subscribePanelProfileData, type PanelProfileData } from "./panelStore";

export function useCollectionData(): PanelProfileData {
  return useSyncExternalStore(subscribePanelProfileData, getPanelProfileData);
}
