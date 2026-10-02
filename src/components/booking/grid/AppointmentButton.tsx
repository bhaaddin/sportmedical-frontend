import { Box, Tooltip } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  isLateStatus,
  statusName,
  statusTally,
  type DayAppointment,
} from "../../../api/bookingContracts";
import { patientsApi } from "../../../api/patients";
import { useCalendarDisplay } from "../../../api/displaySettings";
import { DESIGN } from "../../../theme";
import { formatPragueTime, isLate } from "../../../utils/time";
import { AppointmentHoverCard } from "./AppointmentHoverCard";

/**
 * One appointment, drawn the board's way (3. 10. 2026): a flat grey card
 * with a 3px coloured edge on the left, the time in bold, the patient's name
 * under it and the status in muted small print. A patient who has arrived or
 * is being seen sits on the darker grey.
 *
 * It is a `button`, not a div with an onClick (7.1), and its status is written
 * out as well as shaded, because colour may not be the only carrier of the
 * information. The month view (`compact`) has one line per booking.
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
  const edge = calendar?.color ?? DESIGN.appointment.edge;

  /*
   * The patient's name on the cell itself, not only in the hover (owner: "každá
   * objednávka bez haveru musí ukázat jméno a činnost"). Fetched through the same
   * cached ['patient', id] query the hover uses, so a day is one request per
   * patient however many times it is drawn. Not on the month view (compact),
   * where the name the row already carries has to do.
   */
  /* A slot taken for nobody on the books (walk-in or event) has an empty patient
     id and carries its name on the row itself — so there is nothing to fetch, and
     fetching the empty id would 404. Only a real patient is looked up. */
  const hasPatient =
    appointment.patientId !== "" &&
    appointment.patientId !== "00000000-0000-0000-0000-000000000000";
  const nameQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: layout !== "compact" && hasPatient,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const rowName = appointment.patientName?.trim() || null;
  const patientName = hasPatient
    ? (nameQuery.data
        ? (nameQuery.data.fullName
          || `${nameQuery.data.firstName} ${nameQuery.data.lastName}`.trim())
        : rowName)
    : rowName;
  const late = isLate(appointment.startUtc, isLateStatus(appointment.status), now);
  const tally = statusTally(appointment.status);
  const name = statusName(appointment.status);
  const statusLabel = name
    ? t(`booking.status.${name}`)
    : t("booking.status.unknown");
  const statusLine = late ? `${statusLabel} · ${t("booking.status.late")}` : statusLabel;
  const cancelled = tally === "cancelled";
  const active = tally === "arrived";

  const paperworkMark = appointment.paperwork ? (
    /*
      4.5, v29: ✓ or ⚠ for the paperwork, and nothing at all while the
      register cannot answer. The mark carries a label of its own, because a
      symbol is not a word and 7.1 does not accept one standing alone.
    */
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
  ) : null;

  const compact = layout === "compact";

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
            boxShadow: DESIGN.shadow.menu,
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
      data-status={tally}
      onClick={() => onOpen(appointment.id)}
      aria-haspopup="dialog"
      sx={{
        display: "block",
        width: "100%",
        height: layout === "block" ? "100%" : "auto",
        textAlign: "left",
        cursor: "pointer",
        border: "none",
        borderLeft: `3px solid ${edge}`,
        borderRadius: `${DESIGN.radius.sm}px`,
        px: compact ? 0.75 : 1,
        py: compact ? 0.125 : 0.5,
        font: "inherit",
        lineHeight: 1.25,
        overflow: "hidden",
        backgroundColor: active ? DESIGN.appointment.bgActive : DESIGN.appointment.bg,
        color: DESIGN.ink,
        opacity: cancelled ? 0.55 : 1,
        textDecoration: cancelled ? "line-through" : "none",
        whiteSpace: compact ? "nowrap" : "normal",
        textOverflow: "ellipsis",
        "&:hover": { backgroundColor: DESIGN.appointment.bgActive },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      {compact ? (
        /*
          A month cell has one line to spare: the time, then whoever is coming
          - or the činnost when the row carries no name. A status other than
          "booked" is still said in words, never only by shading (7.1).
        */
        <>
          <Box component="span" sx={{ fontSize: 12, fontWeight: 700 }}>
            {formatPragueTime(appointment.startUtc)}
          </Box>{" "}
          <Box component="span" sx={{ fontSize: 12 }}>
            {rowName ?? appointment.activityName}
          </Box>
          {tally !== "booked" || late ? (
            <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: DESIGN.muted }}>
              {late ? t("booking.status.late") : statusLabel}
            </Box>
          ) : null}
          {paperworkMark}
        </>
      ) : (
        <>
          <Box
            component="span"
            sx={{ display: "block", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {formatPragueTime(appointment.startUtc)} – {formatPragueTime(appointment.endUtc)}
          </Box>
          {patientName ? (
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {patientName}
            </Box>
          ) : null}
          <Box
            component="span"
            sx={{
              display: "block",
              fontSize: 11,
              color: DESIGN.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {statusLine}
            {appointment.activityName ? ` · ${appointment.activityName}` : ""}
            {paperworkMark}
          </Box>
        </>
      )}
    </Box>
    </Tooltip>
  );
}
