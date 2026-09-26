import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  isLateStatus,
  statusName,
  statusTally,
  type DayAppointment,
} from "../../../api/bookingContracts";
import { useCalendarDisplay } from "../../../api/displaySettings";
import { readableTextOn } from "../../../utils/calendarPalette";
import { formatPragueTime, isLate } from "../../../utils/time";
import { AppointmentHoverCard } from "./AppointmentHoverCard";

/**
 * One appointment. It is a `button`, not a div with an onClick (7.1), and its
 * status is written out as well as coloured, because colour may not be the only
 * carrier of the information.
 *
 * Moved here unchanged from `CalendarGridPage.tsx` so the time grid and the
 * page's list and month views draw an appointment the same way.
 */
export function AppointmentButton({
  appointment,
  calendar,
  now,
  onOpen,
  layout,
}: {
  appointment: DayAppointment;
  calendar?: { id: string; name: string; color: string };
  now: Date;
  onOpen: (id: string) => void;
  layout: "row" | "block" | "compact";
}) {
  const { t } = useTranslation();
  const { settings } = useCalendarDisplay();
  const color = calendar?.color ?? "#37474F";
  const late = isLate(appointment.startUtc, isLateStatus(appointment.status), now);
  const tally = statusTally(appointment.status);
  const name = statusName(appointment.status);
  const statusLabel = name
    ? t(`booking.status.${name}`)
    : t("booking.status.unknown");

  return (
    <Tooltip
      arrow
      placement="top"
      enterDelay={350}
      enterNextDelay={350}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            boxShadow: 3,
            border: "1px solid",
            borderColor: "divider",
            p: 1,
          },
        },
        arrow: { sx: { color: "background.paper" } },
      }}
      title={
        <AppointmentHoverCard
          appointment={appointment}
          calendarName={calendar?.name}
          fields={settings.hoverFields}
        />
      }
    >
    <Box
      component="button"
      type="button"
      data-grid-item="appointment"
      onClick={() => onOpen(appointment.id)}
      aria-haspopup="dialog"
      sx={{
        display: "block",
        width: "100%",
        height: layout === "block" ? "100%" : "auto",
        whiteSpace: layout === "compact" ? "nowrap" : "normal",
        textOverflow: "ellipsis",
        textAlign: "left",
        cursor: "pointer",
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 1,
        px: 1,
        py: 0.5,
        font: "inherit",
        fontSize: 12,
        overflow: "hidden",
        backgroundColor: color,
        color: readableTextOn(color),
        opacity: tally === "cancelled" ? 0.55 : 1,
        textDecoration: tally === "cancelled" ? "line-through" : "none",
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
        },
      }}
    >
      <Box component="span" sx={{ fontWeight: 700 }}>
        {formatPragueTime(appointment.startUtc)}
      </Box>{" "}
      {appointment.activityName}
      {/*
        4.5, v29: ✓ or ⚠ for the paperwork, and nothing at all while the
        register cannot answer. The mark carries a label of its own, because a
        symbol is not a word and 7.1 does not accept one standing alone.
      */}
      {appointment.paperwork ? (
        <Box
          component="span"
          aria-label={
            appointment.paperwork.ready
              ? t("booking.paperwork.ready")
              : t("booking.paperwork.line")
          }
          sx={{ ml: 0.5 }}
        >
          {appointment.paperwork.ready ? "✓" : "⚠"}
        </Box>
      ) : null}
      {/*
        A month cell has one line to spare, so the status goes on the same line
        and the calendar name is dropped - but it is still there in words, never
        colour alone (7.1). The fuller second line is for the day and week.
      */}
      {layout === "compact" ? (
        <Box component="span" sx={{ ml: 0.5, fontSize: 10, opacity: 0.9 }}>
          {late ? t("booking.status.late") : statusLabel}
        </Box>
      ) : (
        <Box
          component="span"
          sx={{ display: "block", fontSize: 11, opacity: 0.9 }}
        >
          {statusLabel}
          {late ? ` · ${t("booking.status.late")}` : ""}
          {calendar ? ` · ${calendar.name}` : ""}
        </Box>
      )}
    </Box>
    </Tooltip>
  );
}
