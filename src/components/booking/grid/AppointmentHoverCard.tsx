import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { patientsApi } from "../../../api/patients";
import { statusName, type DayAppointment } from "../../../api/bookingContracts";
import { formatPragueTime, formatPragueDate } from "../../../utils/time";

/** What the card shows when the server sent no hover-field choice of its own. */
const DEFAULT_HOVER_FIELDS = ["patientName", "activity", "status", "phone", "paperwork"];

/**
 * The card the calendar shows when the mouse rests on a booked slot (plan 5.2).
 *
 * It reads only what the owner asked to see, in the order they asked, from the
 * clinic-wide `hoverFields` setting. The patient's name and telephone are the
 * point of it — the desk can call back without opening the appointment — so the
 * patient is fetched (cached) the moment the card opens, never before.
 *
 * Fields the grid row cannot answer for (an insurer, a written note) are left
 * out rather than shown blank; the fuller answer is one click away in the
 * appointment itself.
 */
export function AppointmentHoverCard({
  appointment,
  calendarName,
  fields,
}: {
  appointment: DayAppointment;
  calendarName?: string;
  fields: string[];
}) {
  const { t } = useTranslation();

  const activeFields = fields && fields.length > 0 ? fields : DEFAULT_HOVER_FIELDS;

  const needsPatient = activeFields.some((f) =>
    f === "patientName" || f === "phone" || f === "birthDate",
  );

  const patientQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: needsPatient,
    staleTime: 5 * 60 * 1000,
  });

  const patient = patientQuery.data;
  const statusLabel = (() => {
    const name = statusName(appointment.status);
    return name ? t(`booking.status.${name}`) : t("booking.status.unknown");
  })();

  const value = (key: string): string | null => {
    switch (key) {
      case "patientName":
        return patient
          ? (patient.fullName || `${patient.firstName} ${patient.lastName}`.trim())
          : null;
      case "phone":
        return patient?.phone?.trim() || null;
      case "birthDate":
        return patient?.dateOfBirth ? formatPragueDate(patient.dateOfBirth) : null;
      case "activity":
        return appointment.activityName || null;
      case "service":
        return calendarName || null;
      case "status":
        return statusLabel;
      case "paperwork":
        return appointment.paperwork
          ? appointment.paperwork.ready
            ? t("booking.paperwork.ready")
            : t("booking.paperwork.line")
          : null;
      default:
        return null;
    }
  };

  const labelFor = (key: string): string => {
    switch (key) {
      case "patientName": return "Pacient";
      case "phone": return "Telefon";
      case "birthDate": return "Narozen(a)";
      case "activity": return "Činnost";
      case "service": return "Služba";
      case "status": return "Stav";
      case "paperwork": return "Podklady";
      default: return key;
    }
  };

  const rows = activeFields
    .map((key) => ({ key, label: labelFor(key), val: value(key) }))
    .filter((r) => r.val !== null);

  return (
    <Box sx={{ p: 0.5, minWidth: 180, maxWidth: 280 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 12, mb: 0.5 }}>
        {formatPragueTime(appointment.startUtc)}–{formatPragueTime(appointment.endUtc)}
      </Typography>
      {needsPatient && patientQuery.isPending ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
          <CircularProgress size={12} />
          <Typography sx={{ fontSize: 12 }}>Načítám…</Typography>
        </Box>
      ) : rows.length === 0 ? (
        <Typography sx={{ fontSize: 12, opacity: 0.8 }}>Bez údajů</Typography>
      ) : (
        <Stack spacing={0.25}>
          {rows.map((r) => (
            <Box key={r.key} sx={{ display: "flex", gap: 1, fontSize: 12 }}>
              <Typography component="span" sx={{ fontSize: 12, opacity: 0.7, minWidth: 74 }}>
                {r.label}
              </Typography>
              <Typography component="span" sx={{ fontSize: 12, fontWeight: 600 }}>
                {r.val}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
