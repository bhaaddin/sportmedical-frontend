import { useSyncExternalStore } from "react";
import { useDevice } from "../../../layout/useDevice";

/**
 * Where the booking flow lives on this screen (Etapa 2, decision 13):
 *
 *   desktop            - the 580 px side panel, as drawn
 *   tablet, portrait   - a bottom panel over half the height, expanding on focus
 *   tablet, landscape  - the side panel again
 *   phone              - the whole screen, one step at a time
 */
export type PanelLayout = "side-panel" | "bottom-panel" | "full-screen";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

/** Taller than wide. Read from the window itself, so a rotated tablet is noticed at once. */
function readPortrait(): boolean {
  return typeof window !== "undefined" && window.innerHeight > window.innerWidth;
}

export function useIsPortrait(): boolean {
  return useSyncExternalStore(subscribe, readPortrait, () => false);
}

export function usePanelLayout(): PanelLayout {
  const device = useDevice();
  const portrait = useIsPortrait();
  if (device === "phone") return "full-screen";
  if (device === "tablet" && portrait) return "bottom-panel";
  return "side-panel";
}
