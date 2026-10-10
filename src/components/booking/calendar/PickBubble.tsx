import type { ReactNode } from "react";
import { Box, Button, Drawer, Popover } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Device } from "../../../layout/useDevice";
import { DESIGN } from "../../../theme";

/*
 * The one small anchored bubble of pick mode (Etapa 12), in the look of the move popover (`MoveConfirmDialog`): a
 * caret pointing at what it is about, a 20/700 title, 44 px buttons side by side, "Zrušit" grey and outlined. On a
 * phone the same content opens as a bottom sheet. The shell only; the content and the two decisions are the caller's.
 *
 *   Esc            → `onEscape` (cancel)
 *   click outside  → `onOutside` (the caller says what that means - usually "keep what is ticked")
 */

export const BUBBLE_WIDTH = 340;
const CARET = 10;

export function PickBubble({
  device,
  anchorEl,
  titleId,
  testId,
  width = BUBBLE_WIDTH,
  onEscape,
  onOutside,
  onKeyDown,
  children,
}: {
  device: Device;
  /** What the bubble hangs off (a picked bar, a month cell, a button); null → centred. */
  anchorEl: Element | null;
  titleId: string;
  testId: string;
  width?: number;
  onEscape: () => void;
  onOutside: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  const close = (_event: object, reason: "backdropClick" | "escapeKeyDown") => {
    if (reason === "escapeKeyDown") onEscape();
    else onOutside();
  };

  if (device === "phone") {
    return (
      <Drawer
        open
        anchor="bottom"
        onClose={close}
        data-testid={testId}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-modal": true,
            "aria-labelledby": titleId,
            "data-layout": "sheet",
            onKeyDown,
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "85vh", p: 2, pb: "calc(16px + env(safe-area-inset-bottom, 0px))" },
          } as object,
        }}
      >
        {children}
      </Drawer>
    );
  }

  /* Beside the anchor, on whichever side has the room; the caret points at it. */
  const rect = anchorEl?.getBoundingClientRect() ?? null;
  const viewport = typeof window !== "undefined" ? window.innerWidth : 1440;
  const side: "right" | "left" = rect !== null && rect.right + width + 24 > viewport ? "left" : "right";
  const anchored = anchorEl !== null;

  return (
    <Popover
      open
      anchorEl={anchored ? anchorEl : undefined}
      anchorReference={anchored ? "anchorEl" : "anchorPosition"}
      anchorPosition={anchored ? undefined : { top: typeof window !== "undefined" ? window.innerHeight / 2 : 400, left: viewport / 2 }}
      anchorOrigin={anchored ? { vertical: "center", horizontal: side } : { vertical: "center", horizontal: "center" }}
      transformOrigin={anchored ? { vertical: "center", horizontal: side === "right" ? "left" : "right" } : { vertical: "center", horizontal: "center" }}
      marginThreshold={8}
      onClose={close}
      data-testid={testId}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": titleId,
          "data-layout": "bubble",
          onKeyDown,
          sx: {
            width,
            maxWidth: "calc(100vw - 16px)",
            maxHeight: "calc(100vh - 24px)",
            overflow: "visible",
            p: 2,
            ml: anchored && side === "right" ? `${CARET}px` : 0,
            mr: anchored && side === "left" ? `${CARET}px` : 0,
            borderRadius: "12px",
            boxShadow: DESIGN.shadow.menu,
            border: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          },
        } as object,
      }}
    >
      {anchored ? (
        <Box
          aria-hidden
          data-testid={`${testId}-caret`}
          sx={{
            position: "absolute",
            top: "50%",
            [side === "right" ? "left" : "right"]: -CARET / 2 - 1,
            width: CARET,
            height: CARET,
            transform: "translateY(-50%) rotate(45deg)",
            bgcolor: "background.paper",
            borderLeft: side === "right" ? "1px solid" : "none",
            borderBottom: side === "right" ? "1px solid" : "none",
            borderRight: side === "left" ? "1px solid" : "none",
            borderTop: side === "left" ? "1px solid" : "none",
            borderColor: "divider",
          }}
        />
      ) : null}
      {children}
    </Popover>
  );
}

/** The two (or three) 44 px buttons of a bubble: the primary one filled, the rest grey and outlined. */
export function BubbleButtons({ children }: { children: ReactNode }) {
  return <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>{children}</Box>;
}

export function BubbleButton({
  primary = false,
  testId,
  disabled,
  onClick,
  children,
}: {
  primary?: boolean;
  testId: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant={primary ? "contained" : "outlined"}
      color={primary ? "primary" : "inherit"}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      sx={{ flex: 1, minWidth: 120, minHeight: 44, ...(primary ? {} : { borderColor: alpha("#000", 0.25), color: "text.secondary" }) }}
    >
      {children}
    </Button>
  );
}
