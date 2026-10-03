import { useState } from "react";
import { Box, Button, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { alpha } from "@mui/material/styles";
import type { DateOnly } from "../../../utils/time";
import { DESIGN } from "../../../theme";
import { GRID_TEXT } from "../grid/gridText";
import { CAL_TEXT } from "./calendarText";
import { clubRanges, isPastPicked, pickedLabel, type PickedRange } from "./multiSelect";

/*
 * The tray for several marked places: chips with an x each, the count, and what
 * to do with them. Desktop and tablet: a floating card at the bottom right of
 * the grid. Phone: a bar above the bottom navigation that opens to the list.
 */

export interface SelectionTrayProps {
  items: readonly PickedRange[];
  today: DateOnly;
  phone: boolean;
  mayBook: boolean;
  mayBlock: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** Offered when exactly one time range is marked. */
  onBook?: () => void;
  onBlock?: () => void;
  onClub?: () => void;
}

function PlaceChip({
  item,
  past,
  onRemove,
}: {
  item: PickedRange;
  past: boolean;
  onRemove: () => void;
}) {
  const label = pickedLabel(item);
  return (
    <Box
      data-testid="tray-chip"
      data-past={past ? "true" : undefined}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        pl: 1.25,
        pr: 0.25,
        minHeight: 32,
        borderRadius: 16,
        border: "1px solid",
        borderColor: past ? "divider" : DESIGN.selection.line,
        bgcolor: past ? "action.hover" : alpha(DESIGN.selection.bg, 0.8),
        color: past ? "text.secondary" : "text.primary",
        maxWidth: "100%",
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: 13, fontVariantNumeric: "tabular-nums", textDecoration: past ? "line-through" : "none" }}
      >
        {label}
      </Typography>
      {past ? (
        <Typography component="span" sx={{ fontSize: 12, ml: 0.5 }}>
          {CAL_TEXT.trayPast}
        </Typography>
      ) : null}
      <IconButton
        size="small"
        aria-label={CAL_TEXT.trayRemove(label)}
        onClick={onRemove}
        sx={{ width: 28, height: 28, "@media (pointer: coarse)": { width: 36, height: 36 } }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}

export function SelectionTray({
  items,
  today,
  phone,
  mayBook,
  mayBlock,
  onRemove,
  onClear,
  onBook,
  onBlock,
  onClub,
}: SelectionTrayProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const usable = clubRanges(items, today).length;
  const showBook = mayBook && onBook && items.length === 1 && items[0].kind === "time";
  const chips = (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }} data-testid="tray-chips">
      {items.map((item) => (
        <PlaceChip key={item.id} item={item} past={isPastPicked(item, today)} onRemove={() => onRemove(item.id)} />
      ))}
    </Box>
  );

  const actions = (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {showBook ? (
        <Button variant="contained" onClick={onBook} sx={{ minHeight: 44 }}>
          {GRID_TEXT.bookPatient}
        </Button>
      ) : null}
      {mayBlock && onBlock ? (
        <Button variant="outlined" onClick={onBlock} sx={{ minHeight: 44 }}>
          {GRID_TEXT.blockTime}
        </Button>
      ) : null}
      {mayBook && onClub ? (
        <Tooltip title={usable === 0 ? CAL_TEXT.trayClubFromToday : ""}>
          <span>
            <Button variant="outlined" disabled={usable === 0} onClick={onClub} sx={{ minHeight: 44 }}>
              {GRID_TEXT.bookClub}
            </Button>
          </span>
        </Tooltip>
      ) : null}
      <Button onClick={onClear} sx={{ minHeight: 44, color: "text.secondary" }}>
        {GRID_TEXT.cancelSelection}
      </Button>
    </Box>
  );

  if (phone) {
    return (
      <Paper
        role="region"
        aria-label={CAL_TEXT.trayLabel}
        data-testid="selection-tray"
        data-variant="bar"
        elevation={8}
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "var(--bottom-bar-height, 0px)",
          zIndex: (theme) => theme.zIndex.appBar,
          px: 2,
          py: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{CAL_TEXT.trayCount(items.length)}</Typography>
          <IconButton
            aria-label={open ? CAL_TEXT.trayCollapse : CAL_TEXT.trayExpand}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            sx={{ width: 44, height: 44 }}
          >
            {open ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Box>
        {open ? <Box sx={{ maxHeight: "30vh", overflowY: "auto", mb: 1 }}>{chips}</Box> : null}
        {actions}
      </Paper>
    );
  }

  return (
    <Paper
      role="region"
      aria-label={CAL_TEXT.trayLabel}
      data-testid="selection-tray"
      data-variant="card"
      elevation={8}
      sx={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: (theme) => theme.zIndex.appBar,
        width: 380,
        maxWidth: "calc(100vw - 48px)",
        p: 1.75,
        borderRadius: `${DESIGN.radius.xl}px`,
        border: "1px solid",
        borderColor: "divider",
        boxShadow: DESIGN.shadow.dialog,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>{CAL_TEXT.trayCount(items.length)}</Typography>
      <Box sx={{ maxHeight: 180, overflowY: "auto", mb: 1.25 }}>{chips}</Box>
      {actions}
    </Paper>
  );
}
