import { Box, Tooltip, useTheme } from "@mui/material";
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
import { cardTones } from "../calendar/colors";
import { formatPragueTime, isLate } from "../../../utils/time";
import { AppointmentHoverCard } from "./AppointmentHoverCard";
import { clubLine } from "./clubLine";
import { shortName } from "./periodTitle";

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
  accent,
  dense = false,
  shortLabel = false,
}: {
  appointment: DayAppointment;
  calendar?: { id: string; name: string; color: string };
  now: Date;
  onOpen: (id: string) => void;
  layout: "row" | "block" | "compact";
  /** The činnost's colour (contract C1): the card's edge and tint. Without it, the board's grey. */
  accent?: string;
  /** A short card: one line, "09:30 Tomáš Kříž" - the rest is in the hover/tap card. */
  dense?: boolean;
  /** Month on a tablet: "J. Novák" instead of "Jan Novák". */
  shortLabel?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useCalendarDisplay();
  const tones = accent
    ? cardTones(accent, theme.palette.background.paper)
    : {
        bg: DESIGN.appointment.bg,
        bgActive: DESIGN.appointment.bgActive,
        edge: calendar?.color ?? DESIGN.appointment.edge,
      };
  const edge = tones.edge;

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
  /* "Klub · FK Slaný · −10 %" - the board's club line, from what the server sent. */
  const club = clubLine(appointment.partnerName, appointment.clubDiscountPercent);

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
  /* A grid card is drawn at the board's size (Main.dc.html: time 11/600, name 12/500, status 11);
     a phone's list row is read at arm's length and keeps the larger type. */
  const gridCard = layout === "block";

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
      /* A list row already says everything the card does, and a phone has no hover: no card there. */
      title={
        layout === "row" ? (
          ""
        ) : (
          <AppointmentHoverCard
            appointment={appointment}
            calendarName={calendar?.name}
            fields={settings.hoverFields}
          />
        )
      }
    >
    <Box
      component="button"
      type="button"
      data-grid-item="appointment"
      data-status={tally}
      onClick={() => onOpen(appointment.id)}
      aria-haspopup="dialog"
      aria-label={
        dense && layout === "block"
          ? [
              `${formatPragueTime(appointment.startUtc)} – ${formatPragueTime(appointment.endUtc)}`,
              patientName,
              club,
              appointment.activityName ? `${statusLine} · ${appointment.activityName}` : statusLine,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      sx={{
        display: "block",
        width: "100%",
        height: layout === "block" ? "100%" : "auto",
        textAlign: "left",
        cursor: "pointer",
        border: "none",
        borderLeft: `${compact ? 2 : 3}px solid ${edge}`,
        borderRadius: compact ? "3px" : `${DESIGN.radius.sm}px`,
        px: compact ? 0.75 : gridCard ? "7px" : 1,
        py: compact ? "2px" : gridCard ? "5px" : 0.5,
        font: "inherit",
        lineHeight: 1.25,
        overflow: "hidden",
        backgroundColor: active ? tones.bgActive : tones.bg,
        color: accent ? theme.palette.text.primary : DESIGN.ink,
        opacity: cancelled ? 0.55 : 1,
        textDecoration: cancelled ? "line-through" : "none",
        whiteSpace: compact ? "nowrap" : "normal",
        textOverflow: "ellipsis",
        "&:hover": { backgroundColor: tones.bgActive },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      {dense && layout === "block" ? (
        <Box
          component="span"
          sx={{
            display: "block",
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatPragueTime(appointment.startUtc)}
          </Box>{" "}
          {patientName ?? appointment.activityName}
          {club ? ` · ${club}` : ""}
          {paperworkMark}
        </Box>
      ) : compact ? (
        /*
          A month cell has one line to spare: the time, then whoever is coming
          - or the činnost when the row carries no name. A status other than
          "booked" is still said in words, never only by shading (7.1).
        */
        <>
          <Box component="span" sx={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {formatPragueTime(appointment.startUtc)}
          </Box>{" "}
          <Box component="span" sx={{ fontSize: 11 }}>
            {(shortLabel && rowName ? shortName(rowName) : rowName) ?? appointment.activityName}
          </Box>
          {club ? (
            <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: DESIGN.muted }}>
              {club}
            </Box>
          ) : null}
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
            sx={{
              display: "block",
              fontSize: gridCard ? 11 : 13,
              fontWeight: gridCard ? 600 : 700,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {formatPragueTime(appointment.startUtc)} – {formatPragueTime(appointment.endUtc)}
          </Box>
          {patientName ? (
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: gridCard ? 12 : 14,
                fontWeight: gridCard ? 500 : 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {patientName}
            </Box>
          ) : null}
          {club ? (
            <Box
              component="span"
              data-testid="club-line"
              sx={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: DESIGN.muted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {club}
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

