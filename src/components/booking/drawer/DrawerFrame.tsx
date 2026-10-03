import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Close from "@mui/icons-material/Close";
import { DESIGN } from "../../ui";
import { useDevice } from "../../../layout/useDevice";
import { usePanelLayout, type PanelLayout } from "./usePanelLayout";

/** The board's drawer is 580px wide at 1440. */
export const DRAWER_WIDTH = 580;

/** How far a finger has to travel to count as a swipe on the handle. */
const SWIPE_PX = 36;

/** Motion only where it explains - opening and resizing the panel - and never over 200 ms. */
const PANEL_MS = 180;

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * The panel every booking screen lives in: a white sheet over a dark scrim,
 * with a fixed header (title, the step under it, back and close), a scrolling
 * body and a footer pinned at the bottom for the actions. The content decides
 * what goes in; this decides where, per device (Etapa 2, decision 13):
 *
 *  - **desktop** (and a tablet held sideways): the 580 px right-hand panel;
 *  - **tablet held upright**: a bottom panel covering half the height, with a
 *    swipe handle; it grows to the full height when a field takes the keyboard,
 *    so what is being typed is never hidden behind it;
 *  - **phone**: the whole screen. The back arrow stands where the close
 *    button would, the footer is the pinned primary action, and every touch
 *    target is at least 44 px.
 */
export function DrawerFrame({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  footer,
  labelId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Shown as `‹` before the title; step 2 has one, step 1 has none. */
  onBack?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  /** Id of the heading, so the dialog is named by its title. */
  labelId: string;
  children: ReactNode;
}) {
  const layout = usePanelLayout();
  const touch = useDevice() !== "desktop";
  const [expanded, setExpanded] = useState(false);
  const touchY = useRef<number | null>(null);

  /* A panel that is opened again starts at half height again. */
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  /* Rotating the tablet to landscape leaves the bottom panel behind. */
  useEffect(() => {
    if (layout !== "bottom-panel") setExpanded(false);
  }, [layout]);

  /*
   * Phones and tablets are driven by a finger: nothing inside the panel is
   * smaller than 44 px, whichever component drew it. One rule here instead of
   * a size prop on every button and field of every screen that lives in it.
   */
  const touchRules = touch
    ? {
        "& .MuiButton-sizeSmall": { minHeight: 44 },
        "& .MuiIconButton-sizeSmall": { minHeight: 44, minWidth: 44 },
        "& .MuiInputBase-sizeSmall": { minHeight: 44 },
        "& .MuiFormControlLabel-root": { minHeight: 44 },
        "& .MuiButtonBase-root.MuiButton-text": { minHeight: 44 },
      }
    : {};

  const full = layout === "full-screen";
  const bottom = layout === "bottom-panel";
  const gutter = full ? 2 : 3;

  const paperSx = {
    display: "flex",
    flexDirection: "column",
    bgcolor: "background.paper",
    boxShadow: DESIGN.shadow.dialog,
    maxWidth: "100%",
    "@media (prefers-reduced-motion: no-preference)": {
      transition: `height ${PANEL_MS}ms ease, width ${PANEL_MS}ms ease`,
    },
    ...(layout === "side-panel"
      ? { width: DRAWER_WIDTH }
      : bottom
        ? {
            width: "100%",
            height: expanded ? "100%" : "50vh",
            maxHeight: "100%",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }
        : { width: "100%", height: "100%" }),
  };

  const startSwipe = (event: React.TouchEvent) => {
    touchY.current = event.touches[0]?.clientY ?? null;
  };
  const endSwipe = (event: React.TouchEvent) => {
    const from = touchY.current;
    touchY.current = null;
    const to = event.changedTouches[0]?.clientY;
    if (from === null || to === undefined) return;
    if (from - to > SWIPE_PX) setExpanded(true);
    else if (to - from > SWIPE_PX) setExpanded(false);
  };

  const paperProps = {
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": labelId,
    "data-layout": layout satisfies PanelLayout,
    "data-expanded": bottom ? String(expanded) : undefined,
    onFocusCapture: (event: React.FocusEvent) => {
      if (bottom && isTextEntry(event.target)) setExpanded(true);
    },
    sx: paperSx,
  } as Record<string, unknown>;

  return (
    <Drawer
      anchor={layout === "side-panel" ? "right" : "bottom"}
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: { sx: { bgcolor: alpha(DESIGN.inkSoft, 0.72) } },
        paper: paperProps,
      }}
    >
      {bottom ? (
        <Box
          role="button"
          tabIndex={0}
          aria-label={expanded ? "Sbalit panel" : "Rozbalit panel"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          onTouchStart={startSwipe}
          onTouchEnd={endSwipe}
          sx={{
            flexShrink: 0,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            touchAction: "none",
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
          }}
        >
          <Box aria-hidden="true" sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: DESIGN.line }} />
        </Box>
      ) : null}

      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          px: gutter,
          py: bottom ? 1 : 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        {full ? (
          <IconButton
            aria-label={onBack ? "Zpět" : "Zavřít"}
            onClick={onBack ?? onClose}
            sx={{ border: "1px solid", borderColor: "divider", width: 44, height: 44, borderRadius: 2.5 }}
          >
            <ArrowBack fontSize="small" />
          </IconButton>
        ) : onBack ? (
          <IconButton
            aria-label="Zpět"
            onClick={onBack}
            sx={{ border: "1px solid", borderColor: "divider", width: 44, height: 44 }}
          >
            <ArrowBack fontSize="small" />
          </IconButton>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={labelId} variant="h5" component="h2" sx={{ lineHeight: 1.25, fontSize: full ? 19 : undefined }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {full ? null : (
          <IconButton aria-label="Zavřít" onClick={onClose} sx={{ width: 44, height: 44 }}>
            <Close fontSize="small" />
          </IconButton>
        )}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: gutter, py: 2.5, ...touchRules }}>
        {children}
      </Box>

      {footer ? (
        <Box
          data-testid="panel-footer"
          sx={{
            flexShrink: 0,
            px: gutter,
            pt: 2,
            pb: full ? "max(16px, env(safe-area-inset-bottom))" : 2,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: DESIGN.head,
            ...touchRules,
          }}
        >
          {footer}
        </Box>
      ) : null}
    </Drawer>
  );
}

export default DrawerFrame;
