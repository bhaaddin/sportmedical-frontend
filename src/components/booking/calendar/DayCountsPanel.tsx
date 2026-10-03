import { Box, Typography } from "@mui/material";
import { DESIGN } from "../../../theme";
import { longDate } from "../grid/periodTitle";
import { CAL_TEXT } from "./calendarText";
import { cleanHex, peopleWord, type DayCounts } from "./model";
import type { DateOnly } from "../../../utils/time";

/*
 * What a day of the month holds, in people, split by služba - the board's hover
 * panel on the desktop and the tap panel on a tablet:
 *
 *     Čtvrtek 22. října
 *     9 osob
 *     PROHLÍDKY ------------- 9 osob
 *     Základní prohlídka         6
 *     Komplexní prohlídka        3
 *
 * One block per ClinicService (InBody has its own when it is its own service),
 * the činnosti under it. A group or club booking counts per head. Nothing
 * here is typed in: names, colours and counts all come from the API.
 */

export function DayCountsPanel({
  dayKey,
  counts,
  note,
}: {
  dayKey: DateOnly;
  counts: DayCounts;
  /** "Státní svátek" / "Zavřeno" for a day the clinic is off. */
  note?: string | null;
}) {
  return (
    <Box data-testid={`day-panel-${dayKey}`} sx={{ display: "flex", flexDirection: "column", gap: 1.375 }}>
      <Box>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{longDate(dayKey, false)}</Typography>
        <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
          {counts.total === 0 ? CAL_TEXT.nobody : peopleWord(counts.total)}
        </Typography>
        {note ? <Typography sx={{ fontSize: 12, color: DESIGN.hatch.holidayInk, fontWeight: 600 }}>{note}</Typography> : null}
      </Box>
      {counts.services.map((service) => (
        <Box key={service.serviceId ?? "other"} data-testid="day-panel-service" sx={{ display: "flex", flexDirection: "column", gap: 0.125 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 1.5,
              pb: 0.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              mb: 0.375,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              {cleanHex(service.colorHex) ? (
                <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "2px", flexShrink: 0, bgcolor: service.colorHex }} />
              ) : null}
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {service.name}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", whiteSpace: "nowrap" }}>
              {peopleWord(service.total)}
            </Typography>
          </Box>
          {service.activities.map((activity) => (
            <Box key={activity.activityId} sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5, py: "3px" }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activity.name}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>
                {activity.count}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
