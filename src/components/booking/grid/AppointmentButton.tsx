import { useState } from "react";
import { Box, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  isLateStatus,
  statusName,
  statusTally,
  type DayAppointment,
} from "../../../api/bookingContracts";
import type { HoverFieldKey } from "../../../api/displaySettings";
import { readableTextOn } from "../../../utils/calendarPalette";
import { formatPragueTime, isLate } from "../../../utils/time";
import { AppointmentHoverCard } from "./AppointmentHoverCard";

/**
 * One appointment. It is a `button`, not a div with an onClick (7.1), and its
 * status is written out as well as coloured, because colour may not be the only
 * carrier of the information.
 *
 * Moved here unchanged from `CalendarGridPage.tsx` so the time grid and the
 * page's list and month views draw an appointment the same way. Since wave 3
 * the mouse resting on it opens a card with the facts the administrator chose
 * (`hoverFields`); with none chosen there is no card at all.
 */
export function AppointmentButton({
  appointment,
  calendar,
  now,
  onOpen,
  layout,
  hoverFields = [],
}: {
  appointment: DayAppointment;
  calendar?: { id: string; name: string; color: string; serviceName?: string | null };
  now: Date;
  onOpen: (id: string) => void;
  layout: "row" | "block" | "compact";
  /** What the hover card shows, in order; empty means no card. */
  hoverFields?: readonly HoverFieldKey[];
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const color = calendar?.color ?? "#37474F";
  const late = isLate(appointment.startUtc, isLateStatus(appointment.status), now);
  const tally = statusTally(appointment.status);
  const name = statusName(appointment.status);
  const statusLabel = name
    ? t(`booking.status.${name}`)
    : t("booking.status.unknown");
  const statusWithLate = late ? `${statusLabel} · ${t("booking.status.late")}` : statusLabel;

  const button = (
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
          {appointment.patientName ? `${appointment.patientName} · ` : ""}
          {statusLabel}
          {late ? ` · ${t("booking.status.late")}` : ""}
          {calendar ? ` · ${calendar.name}` : ""}
        </Box>
      )}
    </Box>
  );

  if (hoverFields.length === 0) {
    return button;
  }

  return (
    <Tooltip
      enterDelay={350}
      enterNextDelay={350}
      onOpen={() => setHovered(true)}
      placement="right-start"
      title={
        <AppointmentHoverCard
          appointment={appointment}
          fields={hoverFields}
          active={hovered}
          statusLabel={statusWithLate}
          serviceName={calendar?.serviceName ?? null}
        />
      }
    >
      {button}
    </Tooltip>
  );
}
