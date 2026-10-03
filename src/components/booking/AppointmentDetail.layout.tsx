import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useDevice, type Device } from "../../layout/useDevice";
import { DESIGN } from "../ui";

/*
 * Where the appointment detail and its edit form live, per device (Etapa 2,
 * decision 13; the board draws only the desktop one, M-Detail / M-Uprava):
 *
 *   desktop  - a dialog 880 px wide, the actions in a rail on the right;
 *   tablet   - a centred dialog, a little narrower, the same two columns
 *              while there is room;
 *   phone    - the whole screen, with the actions docked at the bottom
 *              (Přišel / Nepřišel / Upravit / Přesunout / Zrušit termín) so
 *              the thumb never has to scroll to reach them.
 */
export type DetailLayout = "dialog-880" | "dialog-centered" | "full-screen";

export const DETAIL_WIDTH = 880;
/** The tablet dialog: as wide as it can be while leaving a margin to see the page behind. */
export const TABLET_DIALOG_WIDTH = 720;

export function layoutForDevice(device: Device): DetailLayout {
  return device === "phone" ? "full-screen" : device === "tablet" ? "dialog-centered" : "dialog-880";
}

export function useDetailLayout(): DetailLayout {
  return layoutForDevice(useDevice());
}

/** Props for the `Dialog` so both modes of the detail share one frame. */
export function dialogFrameProps(layout: DetailLayout) {
  return {
    fullScreen: layout === "full-screen",
    maxWidth: false as const,
    fullWidth: layout !== "full-screen",
    slotProps: {
      paper: {
        "data-layout": layout,
        sx: {
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          ...(layout === "dialog-880"
            ? { width: "100%", maxWidth: DETAIL_WIDTH, borderRadius: 4 }
            : layout === "dialog-centered"
              ? { width: `min(${TABLET_DIALOG_WIDTH}px, calc(100% - 48px))`, borderRadius: 4 }
              : { borderRadius: 0, margin: 0, width: "100%", height: "100%", maxHeight: "none" }),
        },
      } as Record<string, unknown>,
    },
  };
}

/**
 * The strip pinned under the scrolling body on a phone: the actions, always
 * in reach. It scrolls inside itself when something opens in it (the reason
 * for a cancellation), never off the screen.
 */
export function DockedBar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Box
      role="group"
      aria-label={label}
      data-testid="docked-actions"
      sx={{
        flexShrink: 0,
        maxHeight: "60vh",
        overflowY: "auto",
        px: 2,
        pt: 1.5,
        pb: "max(12px, env(safe-area-inset-bottom))",
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: DESIGN.head,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {children}
    </Box>
  );
}
