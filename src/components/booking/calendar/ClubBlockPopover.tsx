import { Box, Button, Popover, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { DESIGN } from "../../../theme";
import { CAL_TEXT } from "./calendarText";
import { cleanHex, rangeDates, type DayRange } from "./model";

/*
 * What a click on a club's block says: whose it is, for which days, and the
 * way to its screen. "Blok pro FK Slaný · 26. 10. – 9. 11." with "Otevřít blok"
 * (the clubs screen opens it from the router state it is given).
 */

export interface ClubBlockPick {
  clubBlockId: string;
  clubId: string | null;
  clubName: string;
  colorHex: string | null;
  range: DayRange;
  /** Where on screen it was clicked. */
  x: number;
  y: number;
}


export function ClubBlockPopover({
  pick,
  onOpen,
  onClose,
}: {
  pick: ClubBlockPick | null;
  onOpen: (pick: ClubBlockPick) => void;
  onClose: () => void;
}) {
  const colour = cleanHex(pick?.colorHex) ?? DESIGN.faint;
  return (
    <Popover
      open={pick !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={pick ? { top: pick.y, left: pick.x } : undefined}
      slotProps={{
        paper: {
          sx: {
            width: 300,
            maxWidth: "calc(100vw - 24px)",
            borderRadius: "13px",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: DESIGN.shadow.dialog,
          },
        },
      }}
    >
      {pick ? (
        <Box role="dialog" aria-label={CAL_TEXT.clubPopover.title(pick.clubName)}>
          <Box
            sx={{
              px: 2,
              pt: 1.6,
              pb: 1.3,
              borderLeft: `4px solid ${colour}`,
              bgcolor: alpha(colour, 0.1),
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
              {CAL_TEXT.clubPopover.title(pick.clubName)} · {rangeDates(pick.range)}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>{CAL_TEXT.clubPopover.hint}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, p: 1.25, justifyContent: "flex-end" }}>
            <Button onClick={onClose} sx={{ minHeight: 44 }}>
              {CAL_TEXT.clubPopover.close}
            </Button>
            <Button variant="contained" onClick={() => onOpen(pick)} sx={{ minHeight: 44 }}>
              {CAL_TEXT.clubPopover.open}
            </Button>
          </Box>
        </Box>
      ) : null}
    </Popover>
  );
}

/** A club block as the month and the grid know it, before they add where it was clicked. */
export type ClubBlockRef = Omit<ClubBlockPick, "x" | "y">;
