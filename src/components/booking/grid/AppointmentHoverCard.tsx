import { Box, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../../api/appointments";
import {
  isKnownPaperworkReason,
  type DayAppointment,
} from "../../../api/bookingContracts";
import type { HoverFieldKey } from "../../../api/displaySettings";
import { patientsApi } from "../../../api/patients";
import { usePatientCard } from "../patient/patientCard";
import { GRID_TEXT } from "./gridText";
import { birthDateText, hoverNeeds, lastChangeText } from "./hoverCard";

/**
 * What the mouse sees on a booked block - the facts the administrator chose in
 * Nastavení → Vzhled kalendáře, in that order.
 *
 * Fetches only once the card is open (`active`), and only what the chosen
 * facts need: a screen of forty blocks makes no request until somebody rests
 * on one. Phone, e-mail and insurer come from the patient's profile through
 * the same reader the booking dialog uses, so the server's own rule about
 * who may see what applies here unchanged.
 */
export function AppointmentHoverCard({
  appointment,
  fields,
  active,
  statusLabel,
  serviceName,
}: {
  appointment: DayAppointment;
  fields: readonly HoverFieldKey[];
  /** Whether the card is open - nothing is fetched before. */
  active: boolean;
  statusLabel: string;
  serviceName: string | null;
}) {
  const { t } = useTranslation();
  const needs = hoverNeeds(fields);
  const calendarId = appointment.calendarId ?? "";

  const profile = usePatientCard(appointment.patientId, active && needs.profile);
  const patient = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: active && needs.patient,
    staleTime: 60_000,
  });
  const detail = useQuery({
    queryKey: ["appointment", calendarId, appointment.id],
    queryFn: () => appointmentsApi.get(calendarId, appointment.id),
    enabled: active && needs.detail && calendarId !== "",
    staleTime: 30_000,
  });
  const history = useQuery({
    queryKey: ["appointment-history", calendarId, appointment.id],
    queryFn: () => appointmentsApi.history(calendarId, appointment.id),
    enabled: active && needs.history && calendarId !== "",
    staleTime: 30_000,
  });

  const pending = (loading: boolean, value: string | null | undefined) =>
    loading ? GRID_TEXT.hoverLoading : value || GRID_TEXT.hoverUnknown;

  const rows: { key: HoverFieldKey; label: string; value: string }[] = [];
  for (const key of fields) {
    switch (key) {
      case "patientName":
        rows.push({ key, label: GRID_TEXT.hoverPatient, value: appointment.patientName ?? GRID_TEXT.hoverUnknown });
        break;
      case "phone":
        rows.push({ key, label: GRID_TEXT.hoverPhone, value: pending(profile.isLoading, profile.data?.phone) });
        break;
      case "email":
        rows.push({ key, label: GRID_TEXT.hoverEmail, value: pending(profile.isLoading, profile.data?.email) });
        break;
      case "activity":
        rows.push({ key, label: GRID_TEXT.hoverActivity, value: appointment.activityName || t("booking.detail.noActivity") });
        break;
      case "service":
        rows.push({ key, label: GRID_TEXT.hoverService, value: serviceName ?? GRID_TEXT.hoverUnknown });
        break;
      case "status":
        rows.push({ key, label: GRID_TEXT.hoverStatus, value: statusLabel });
        break;
      case "paperwork":
        if (appointment.paperwork) {
          rows.push({
            key,
            label: GRID_TEXT.hoverPaperwork,
            value: appointment.paperwork.ready
              ? t("booking.paperwork.ready")
              : appointment.paperwork.missing
                  .map((code) =>
                    isKnownPaperworkReason(code)
                      ? t(`booking.paperwork.${code}`)
                      : t("booking.paperwork.unknown", { code }),
                  )
                  .join(" · "),
          });
        }
        break;
      case "note":
        rows.push({
          key,
          label: GRID_TEXT.hoverNote,
          value: detail.isLoading ? GRID_TEXT.hoverLoading : detail.data?.note || t("booking.detail.noNote"),
        });
        break;
      case "insurer":
        rows.push({ key, label: GRID_TEXT.hoverInsurer, value: pending(profile.isLoading, profile.data?.insurerCode) });
        break;
      case "birthDate":
        rows.push({
          key,
          label: GRID_TEXT.hoverBirthDate,
          value: pending(patient.isLoading, birthDateText(patient.data?.dateOfBirth)),
        });
        break;
      case "history":
        rows.push({
          key,
          label: GRID_TEXT.hoverHistory,
          value: history.isLoading
            ? GRID_TEXT.hoverLoading
            : (lastChangeText(history.data, t, t("booking.detail.unknownActor")) ?? GRID_TEXT.hoverNoHistory),
        });
        break;
      default:
        break;
    }
  }

  return (
    <Stack spacing={0.25} sx={{ minWidth: 200, maxWidth: 320 }} data-testid="appointment-hover-card">
      {rows.map((row) => (
        <Box key={row.key} sx={{ display: "flex", gap: 1, fontSize: 12, lineHeight: 1.4 }}>
          <Typography component="span" sx={{ fontSize: 12, color: "grey.400", flexShrink: 0, minWidth: 84 }}>
            {row.label}
          </Typography>
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, whiteSpace: "pre-wrap" }}>
            {row.value}
          </Typography>
        </Box>
      ))}
      <Typography sx={{ fontSize: 11, color: "grey.500", mt: 0.5 }}>{GRID_TEXT.hoverOpen}</Typography>
    </Stack>
  );
}
