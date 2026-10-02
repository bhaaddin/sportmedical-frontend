import { useState } from "react";
import { Box, ButtonBase, Link, Radio, Stack, Typography } from "@mui/material";
import { DESIGN } from "../../ui";
import type { Activity } from "../../../api/bookingContracts";
import { formatCzk, minutesWord } from "../NewAppointmentDialog.logic";

/**
 * "ČINNOST" as the board draws it: one radio card per činnost - name, its
 * length under it, its price on the right - the chosen one in the accent.
 *
 * The day's own činnosti (what `preview.offeredActivityIds` said, rule 6.1)
 * come first and are all that shows at first. "Zobrazit všechny činnosti z
 * ceníku" reveals the rest, marked as not on offer today: picking one is
 * possible, but the server will not offer the time for it, so booking it
 * takes the override path (6.4), the same as any other time outside the offer.
 */
export function ActivityCards({
  offered,
  others,
  value,
  onChange,
  disabled = false,
}: {
  offered: Activity[];
  others: Activity[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? [...offered, ...others] : offered;
  const offeredIds = new Set(offered.map((a) => a.id));

  return (
    <Stack spacing={1}>
      <Stack role="radiogroup" aria-label="Činnost" spacing={1}>
        {rows.map((a) => {
          const selected = a.id === value;
          const onOffer = offeredIds.has(a.id);
          return (
            <ButtonBase
              key={a.id}
              role="radio"
              aria-checked={selected}
              aria-label={a.name}
              disabled={disabled}
              onClick={() => onChange(a.id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                textAlign: "left",
                width: "100%",
                px: 1.5,
                py: 1.25,
                borderRadius: 3,
                border: "1px solid",
                borderColor: selected ? "primary.main" : "divider",
                boxShadow: selected
                  ? (t) => `inset 0 0 0 1px ${t.palette.primary.main}`
                  : "none",
                bgcolor: selected ? DESIGN.softPrimary.bg : "background.paper",
                fontFamily: "inherit",
                "&:hover": { bgcolor: selected ? DESIGN.softPrimary.bg : "action.hover" },
                "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" },
              }}
            >
              <Radio
                checked={selected}
                tabIndex={-1}
                size="small"
                sx={{ p: 0.5 }}
                slotProps={{ input: { "aria-hidden": true, tabIndex: -1 } }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{a.name}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                  {minutesWord(a.durationMinutes)}
                  {onOffer ? "" : " · dnes se nenabízí"}
                </Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {formatCzk(a.priceCzk)}
              </Typography>
            </ButtonBase>
          );
        })}
      </Stack>

      {others.length > 0 && !showAll ? (
        <Link
          component="button"
          type="button"
          underline="hover"
          onClick={() => setShowAll(true)}
          sx={{ alignSelf: "flex-start", fontWeight: 600, fontSize: 14 }}
        >
          Zobrazit všechny činnosti z ceníku
        </Link>
      ) : null}
    </Stack>
  );
}

export default ActivityCards;
