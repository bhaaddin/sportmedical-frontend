import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Button, IconButton, Modal, Stack, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import Close from "@mui/icons-material/Close";
import { DESIGN } from "../ui";
import { useDevice } from "../../layout/useDevice";
import {
  BUBBLE_WIDTH,
  CARET_SIZE,
  bubbleMaxHeight,
  placeBubble,
  type BubbleAnchor,
  type BubblePlacement,
} from "./NewAppointmentDialog.bubble.logic";

/**
 * Etapa 12, "rovnou na bublinku" (the owner, 10. 10. 2026): on a desktop and a
 * tablet the booking opens as a BUBBLE anchored to the slot the desk marked in
 * the grid - a compact card with a caret pointing at the slot, the same visual
 * language as the move-confirm bubble - not a full-height side drawer. Width
 * 440 px, the body scrolls inside, it flips to whichever side of the slot has
 * room (`placeBubble`), and it is measured again whenever its content grows.
 *
 * The same header / scrolling body / pinned footer the `DrawerFrame` has, so
 * the dialog's content does not know which one it is in. Esc and a click
 * outside close it - unless something was typed (`dirty`): then one strip asks
 * "Zahodit rozpracovanou objednávku?" first. The scrim is invisible: the slot
 * the caret points at stays visible underneath.
 *
 * The phone never gets a bubble; the dialog keeps the full-screen drawer there.
 */
export function BubbleFrame({
  open,
  anchor,
  onClose,
  onBack,
  title,
  subtitle,
  footer,
  labelId,
  dirty = false,
  children,
}: {
  open: boolean;
  anchor: BubbleAnchor;
  onClose: () => void;
  onBack?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  labelId: string;
  /** Something was typed: Esc and a click outside ask before discarding it. */
  dirty?: boolean;
  children: ReactNode;
}) {
  const touch = useDevice() !== "desktop";
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  const viewport = {
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  };
  const maxHeight = bubbleMaxHeight(viewport.height);
  /* The height is the content's; it is measured once drawn and again when it changes. */
  const [height, setHeight] = useState(() => Math.min(640, maxHeight));

  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) return undefined;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, children]);

  /* The bubble is asked to close by Esc or by a click outside; a typed form asks first. */
  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };

  const placement: BubblePlacement = placeBubble(anchor, viewport, { width: BUBBLE_WIDTH, height });

  /* The same finger rule the drawer has: nothing inside is under 44 px on a tablet. */
  const touchRules = touch
    ? {
        "& .MuiButton-sizeSmall": { minHeight: 44 },
        "& .MuiIconButton-sizeSmall": { minHeight: 44, minWidth: 44 },
        "& .MuiInputBase-sizeSmall": { minHeight: 44 },
        "& .MuiFormControlLabel-root": { minHeight: 44 },
        "& .MuiButtonBase-root.MuiButton-text": { minHeight: 44 },
      }
    : {};

  /*
   * The caret: a square turned 45°, half outside the edge that faces the slot,
   * with only the two outer borders drawn so it reads as one shape with the card.
   */
  const half = CARET_SIZE / 2 + 1;
  const caretSx = (() => {
    const base = {
      position: "absolute" as const,
      width: CARET_SIZE,
      height: CARET_SIZE,
      bgcolor: "background.paper",
      transform: "rotate(45deg)",
      borderColor: "divider",
      borderStyle: "solid",
      borderWidth: 0,
    };
    switch (placement.side) {
      case "right":
        return { ...base, left: -half, top: placement.caret - CARET_SIZE / 2, borderLeftWidth: 1, borderBottomWidth: 1 };
      case "left":
        return { ...base, right: -half, top: placement.caret - CARET_SIZE / 2, borderTopWidth: 1, borderRightWidth: 1 };
      case "below":
        return { ...base, top: -half, left: placement.caret - CARET_SIZE / 2, borderTopWidth: 1, borderLeftWidth: 1 };
      default:
        return { ...base, bottom: -half, left: placement.caret - CARET_SIZE / 2, borderRightWidth: 1, borderBottomWidth: 1 };
    }
  })();

  return (
    <Modal
      open={open}
      onClose={requestClose}
      slotProps={{ backdrop: { invisible: true } }}
      sx={{ "@media (prefers-reduced-motion: no-preference)": { "& [data-layout='bubble']": { transition: "top 120ms ease, left 120ms ease" } } }}
    >
      <Box
        ref={paperRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        data-layout="bubble"
        data-side={placement.side}
        tabIndex={-1}
        sx={{
          position: "fixed",
          top: placement.top,
          left: placement.left,
          width: BUBBLE_WIDTH,
          maxWidth: "calc(100vw - 32px)",
          maxHeight,
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "13px",
          boxShadow: DESIGN.shadow.dialog,
          outline: "none",
        }}
      >
        <Box aria-hidden="true" data-testid="bubble-caret" data-side={placement.side} sx={caretSx} />

        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}
        >
          {onBack ? (
            <IconButton aria-label="Zpět" onClick={onBack} sx={{ border: "1px solid", borderColor: "divider", width: 44, height: 44 }}>
              <ArrowBack fontSize="small" />
            </IconButton>
          ) : null}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id={labelId} variant="h6" component="h2" sx={{ lineHeight: 1.25, fontSize: 17, fontWeight: 700 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <IconButton aria-label="Zavřít" onClick={requestClose} sx={{ width: 44, height: 44 }}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>

        {confirming ? (
          <Alert
            severity="warning"
            role="alertdialog"
            aria-label="Zahodit rozpracovanou objednávku?"
            sx={{ borderRadius: 0, flexShrink: 0, alignItems: "center" }}
            action={
              <Stack direction="row" spacing={0.5}>
                <Button color="inherit" size="small" onClick={() => setConfirming(false)} sx={{ minHeight: 36 }}>
                  Pokračovat
                </Button>
                <Button color="warning" variant="contained" size="small" onClick={onClose} sx={{ minHeight: 36 }}>
                  Zahodit
                </Button>
              </Stack>
            }
          >
            Zahodit rozpracovanou objednávku?
          </Alert>
        ) : null}

        <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", px: 2, py: 2, ...touchRules }}>{children}</Box>

        {footer ? (
          <Box
            data-testid="panel-footer"
            sx={{
              flexShrink: 0,
              px: 2,
              py: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: DESIGN.head,
              borderBottomLeftRadius: "12px",
              borderBottomRightRadius: "12px",
              ...touchRules,
            }}
          >
            {footer}
          </Box>
        ) : null}
      </Box>
    </Modal>
  );
}

export default BubbleFrame;
