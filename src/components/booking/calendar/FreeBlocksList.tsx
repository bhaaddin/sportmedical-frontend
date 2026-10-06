import { Box, Button, ButtonBase, Paper, Stack, Typography } from "@mui/material";
import { DESIGN } from "../../../theme";
import { formatMinutes } from "../grid/timeRange";
import type { FreeBlock } from "./pickDays";
import { formatFree } from "./pickDays";
import { CAL_TEXT } from "./calendarText";

/*
 * The free time of the day in "výběr termínů", as big blocks on a phone: one tap takes the whole block
 * ("08:30–12:00 volno") takes the time the order still needs from it (never more than the block; the rest of the block
 * stays free for ordinary bookings). The grid below stays for marking an exact part of a block.
 */

export interface FreeBlocksListProps {
  blocks: readonly FreeBlock[];
  calendarName: (calendarId: string) => string;
  /** More than one calendar of the služba: the name is shown on every block. */
  showCalendar: boolean;
  onPick: (block: FreeBlock) => void;
  /** What a tap would take from the block (minutes) and whether the order is already covered. */
  takeOf?: (block: FreeBlock) => { minutes: number; covered: boolean };
  /** No free time today: the way forward. */
  onNextDay: () => void;
}

export function FreeBlocksList({ blocks, calendarName, showCalendar, onPick, takeOf, onNextDay }: FreeBlocksListProps) {
  return (
    <Paper variant="outlined" data-testid="free-blocks" sx={{ p: 1.25, mb: 1.5, borderRadius: `${DESIGN.radius.lg}px` }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{CAL_TEXT.pick.blocksTitle}</Typography>
      {blocks.length === 0 ? (
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>V tento den už není volný čas.</Typography>
          <Button variant="outlined" data-testid="free-blocks-next" onClick={onNextDay} sx={{ minHeight: 44, whiteSpace: "nowrap" }}>
            Další den
          </Button>
        </Stack>
      ) : (
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {blocks.map((block) => (
            <ButtonBase
              key={`${block.calendarId}-${block.range.start}`}
              data-testid="free-block"
              onClick={() => onPick(block)}
              sx={{
                minHeight: 52,
                px: 1.5,
                py: 0.75,
                borderRadius: `${DESIGN.radius.md}px`,
                border: `2px solid ${DESIGN.selection.line}`,
                bgcolor: DESIGN.selection.bg,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "left",
                "&.Mui-disabled": { opacity: 0.5 },
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {`${formatMinutes(block.range.start)}–${formatMinutes(block.range.end)}`}
                </Typography>
                {showCalendar ? (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{calendarName(block.calendarId)}</Typography>
                ) : null}
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: DESIGN.selection.line }}>
                  {`volno ${formatFree(block.range.end - block.range.start)}`}
                </Typography>
                {(() => {
                  const take = takeOf?.(block);
                  if (take === undefined) return null;
                  if (take.covered) return null;
                  if (take.minutes >= block.range.end - block.range.start) return null;
                  return (
                    <Typography data-testid="free-block-take" sx={{ fontSize: 12, color: "text.secondary" }}>
                      {CAL_TEXT.pick.willTake(formatFree(take.minutes))}
                    </Typography>
                  );
                })()}
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}
    </Paper>
  );
}
