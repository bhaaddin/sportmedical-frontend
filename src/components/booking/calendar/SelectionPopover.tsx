import { Box, ButtonBase, MenuItem, MenuList, Popover, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { DESIGN } from "../../../theme";
import { GRID_TEXT } from "../grid/gridText";

/*
 * The board's popover for a selection (N-Slot): what to do with the time - or
 * the run of days - that was just marked. Three or four actions with an icon
 * each and "Zrušit výběr · Esc". One component for the grid's time drags and
 * the month/week day ranges, so both say the same words in the same place.
 *
 * On a phone or tablet the same menu opens as a bottom-anchored sheet, with
 * every row 44 px high or more.
 *
 * "Kluby" (Etapa 12) is never a path to a NEW club order - per Etapa 9 that
 * stays only in "Klubová objednávka". It attaches the marked time to an order
 * that already exists (`onAddToClubOrder`), so it only shows beside `onBook`.
 */

export interface SelectionPopoverProps {
  /** Where the pointer was let go; `null` closes it. */
  anchor: { x: number; y: number } | null;
  title: string;
  subtitle: string;
  /** A third muted line - the calendar the time belongs to. */
  caption?: string;
  mayBook: boolean;
  mayBlock: boolean;
  onBook?: () => void;
  onBlock?: () => void;
  /** Etapa 12: "Přidat do objednávky klubu" - shown exactly where `onBook` is (same `mayBook`). */
  onAddToClubOrder?: () => void;
  onClose: () => void;
  /** Overrides for the hint lines (a day range reads differently from a time). */
  hints?: Partial<{ book: string; block: string }>;
}

function Action({
  icon,
  filled = false,
  primary,
  secondary,
  onClick,
}: {
  icon: React.ReactNode;
  filled?: boolean;
  primary: string;
  secondary: string;
  onClick: () => void;
}) {
  return (
    <MenuItem onClick={onClick} sx={{ alignItems: "center", gap: 1.5, px: 1.5, py: 1, mx: 0.75, minHeight: 44, borderRadius: 2.25 }}>
      <Box
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2.25,
          bgcolor: filled ? "primary.main" : "action.hover",
          color: filled ? "primary.contrastText" : "text.secondary",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{primary}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.3, whiteSpace: "normal" }}>
          {secondary}
        </Typography>
      </Box>
    </MenuItem>
  );
}

export function SelectionPopover({
  anchor,
  title,
  subtitle,
  caption,
  mayBook,
  mayBlock,
  onBook,
  onBlock,
  onAddToClubOrder,
  onClose,
  hints,
}: SelectionPopoverProps) {
  return (
    <Popover
      open={anchor !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchor ? { top: anchor.y, left: anchor.x } : undefined}
      slotProps={{
        paper: {
          sx: {
            width: 290,
            maxWidth: "calc(100vw - 24px)",
            borderRadius: "13px",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: DESIGN.shadow.dialog,
          },
        },
      }}
    >
      <Box>
        <Box sx={{ px: 2, pt: 1.6, pb: 1.3, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.25 }}>{subtitle}</Typography>
          {caption ? <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>{caption}</Typography> : null}
        </Box>
        <MenuList aria-label="Akce pro vybraný čas" sx={{ py: 0.75 }}>
          {mayBook && onBook ? (
            <Action
              icon={<AddIcon fontSize="small" />}
              filled
              primary={GRID_TEXT.bookPatient}
              secondary={hints?.book ?? GRID_TEXT.bookPatientHint}
              onClick={onBook}
            />
          ) : null}
          {mayBlock && onBlock ? (
            <Action
              icon={<LockOutlinedIcon fontSize="small" />}
              primary={GRID_TEXT.blockTime}
              secondary={hints?.block ?? GRID_TEXT.blockTimeHint}
              onClick={onBlock}
            />
          ) : null}
          {mayBook && onAddToClubOrder ? (
            <Action
              icon={<GroupsOutlinedIcon fontSize="small" />}
              primary={GRID_TEXT.addToClubOrder}
              secondary={GRID_TEXT.addToClubOrderHint}
              onClick={onAddToClubOrder}
            />
          ) : null}
        </MenuList>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 0.75,
            py: 0.75,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <ButtonBase
            onClick={onClose}
            sx={{ flex: 1, minHeight: 44, px: 1.5, justifyContent: "flex-start", fontSize: 13, color: "text.secondary", borderRadius: 2.25 }}
          >
            {GRID_TEXT.cancelSelection}
          </ButtonBase>
          <Typography aria-hidden sx={{ fontSize: 12, color: "text.secondary", pr: 1.5, display: { xs: "none", md: "block" } }}>
            {GRID_TEXT.escape}
          </Typography>
        </Box>
      </Box>
    </Popover>
  );
}
