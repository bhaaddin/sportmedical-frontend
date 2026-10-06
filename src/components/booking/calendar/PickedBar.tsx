import { useRef } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { DESIGN } from "../../../theme";
import { selectionLabel, type MinuteRange } from "../grid/timeRange";
import type { AdjustMode } from "./pickLogic";

/*
 * One picked time range in "výběr termínů", drawn in its column: drag the top or bottom edge to resize it, drag
 * the body to move it, the cross removes it. The column owns the rules (what is taken, how much is still needed);
 * this only turns pointer movement into whole steps and reports them.
 */

interface PickedBarProps {
  id: string;
  range: MinuteRange;
  /** `top`/`height` in px, from the column. */
  place: { top: number; height: number };
  pxPerMinute: number;
  step: number;
  /** The server named this range in a refusal. */
  conflict?: boolean;
  /** Etapa 10: the činnosti this window is restricted to ("Spiroergometrie"), or null when it allows all. */
  tag?: string | null;
  /** Touch: bigger handles and cross (about 44 px to hit). */
  touch?: boolean;
  onDrag: (mode: AdjustMode, deltaMinutes: number) => void;
  onEnd: () => void;
  onRemove: () => void;
}

const HANDLE = 10;

export function PickedBar({ id, range, place, pxPerMinute, step, conflict = false, tag = null, touch = false, onDrag, onEnd, onRemove }: PickedBarProps) {
  const press = useRef<{ mode: AdjustMode; y: number } | null>(null);
  const line = conflict ? "#C62828" : DESIGN.selection.line;

  const start = (mode: AdjustMode) => (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    press.current = { mode, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* A pointer the browser no longer tracks; the drag still works while it stays over the bar. */
    }
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const current = press.current;
    if (current === null) return;
    const raw = (event.clientY - current.y) / pxPerMinute;
    onDrag(current.mode, Math.round(raw / step) * step);
  };
  const end = (event: React.PointerEvent<HTMLElement>) => {
    if (press.current === null) return;
    press.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released. */
    }
    onEnd();
  };

  const handle = (mode: "start" | "end") => (
    <Box
      data-testid={`pick-handle-${mode}`}
      data-grid-item
      onPointerDown={start(mode)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        [mode === "start" ? "top" : "bottom"]: touch ? -20 : -HANDLE / 2,
        height: touch ? 40 : HANDLE + 4,
        cursor: "ns-resize",
        touchAction: "none",
        zIndex: 2,
        display: "flex",
        justifyContent: "center",
        alignItems: mode === "start" ? "flex-start" : "flex-end",
      }}
    >
      <Box aria-hidden sx={{ width: 34, height: 6, borderRadius: "3px", bgcolor: line }} />
    </Box>
  );

  return (
    <Box
      data-testid="picked-range"
      data-pick-id={id}
      data-conflict={conflict ? "true" : undefined}
      data-grid-item
      onPointerDown={start("move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      sx={{
        position: "absolute",
        left: 4,
        right: 4,
        ...place,
        zIndex: 5,
        cursor: "grab",
        touchAction: "none",
        border: `2px solid ${line}`,
        borderRadius: `${DESIGN.radius.md}px`,
        backgroundColor: conflict ? alpha("#C62828", 0.14) : DESIGN.selection.bg,
        userSelect: "none",
      }}
    >
      <Typography
        sx={{
          position: "absolute",
          top: -13,
          left: -2,
          px: 1.1,
          py: "3px",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.3,
          borderRadius: "6px",
          backgroundColor: line,
          color: "#FFFFFF",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          pointerEvents: "none",
        }}
      >
        {selectionLabel(range)}
      </Typography>
      {tag !== null ? (
        <Typography
          data-testid="picked-range-tag"
          sx={{
            position: "absolute",
            top: 8,
            left: 4,
            right: touch ? 44 : 32,
            px: 0.75,
            py: "1px",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.3,
            borderRadius: "5px",
            backgroundColor: "rgba(255,255,255,0.85)",
            color: line,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            width: "fit-content",
            maxWidth: "calc(100% - 8px)",
          }}
        >
          {tag}
        </Typography>
      ) : null}
      <Box
        component="button"
        type="button"
        aria-label="Odebrat termín"
        data-testid="pick-remove"
        data-grid-item
        onPointerDown={(event: React.PointerEvent) => event.stopPropagation()}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          onRemove();
        }}
        sx={{
          position: "absolute",
          top: touch ? 4 : 2,
          right: touch ? 4 : 2,
          width: touch ? 36 : 24,
          height: touch ? 36 : 24,
          p: 0,
          border: 0,
          borderRadius: "50%",
          bgcolor: line,
          color: "#FFFFFF",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          zIndex: 3,
        }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </Box>
      {handle("start")}
      {handle("end")}
    </Box>
  );
}
