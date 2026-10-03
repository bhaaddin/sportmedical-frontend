import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { patientsApi } from "../../../api/patients";
import { activitiesApi } from "../../../api/activities";
import { statusName, type DayAppointment } from "../../../api/bookingContracts";
import { formatPragueTime, formatPragueDate } from "../../../utils/time";
import { clubLine } from "./clubLine";
import { GRID_TEXT } from "./gridText";

/** What the card shows when the server sent no hover-field choice of its own. */
const DEFAULT_HOVER_FIELDS = [
  "patientName", "activity", "price", "registrationStatus", "questionnaire", "status", "phone", "email", "paperwork",
];

/** A paperwork gap code → the words the desk reads. */
const PAPERWORK_REASON_LABEL: Record<string, string> = {
  questionnaire_missing: "chybí dotazník",
  questionnaire_expired: "dotazník propadlý — nový souhlas",
  report_missing: "chybí výpis",
  registration_incomplete: "nedokončená registrace",
};
const paperworkReasonLabel = (code: string): string =>
  PAPERWORK_REASON_LABEL[code] ?? code;

/**
 * The questionnaire's own status, read from the paperwork gaps — so the desk
 * sees "vyplněn / chybí / propadlý" distinctly, not folded into one Podklady line.
 * `null` when the server could not judge (no paperwork answer for this patient).
 */
const questionnaireStatus = (
  paperwork: { ready: boolean; missing: string[] } | null | undefined,
): string | null => {
  if (!paperwork) return null;
  if (paperwork.missing.includes("questionnaire_expired")) return "propadlý — nový souhlas";
  if (paperwork.missing.includes("questionnaire_missing")) return "chybí";
  return "vyplněn";
};

/** The činnost's price in Czech koruna, from the price list it is linked to. */
function formatPrice(czk: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(czk)} Kč`;
}

/** The patient's registration standing, in words rather than the raw code. */
const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  Active: "Registrovaný",
  Registered: "Registrovaný",
  Provisional: "Předběžná registrace",
  PreRegistered: "Předběžná registrace",
  Draft: "Rozepsaná registrace",
  Incomplete: "Nedokončená registrace",
  Archived: "Archivovaný",
};

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

  /* A walk-in or event has no patient on the books — its name and phone ride on
     the row, so there is nothing to fetch and the empty id must not be queried. */
  const hasPatient =
    appointment.patientId !== "" &&
    appointment.patientId !== "00000000-0000-0000-0000-000000000000";

  const needsPatient = hasPatient && activeFields.some((f) =>
    f === "patientName" || f === "phone" || f === "birthDate"
    || f === "email" || f === "registrationStatus",
  );

  const patientQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: needsPatient,
    staleTime: 5 * 60 * 1000,
  });

  /* The price lives on the price list the činnost is linked to, not on the
     appointment; one cached list answers it for every booking on screen. */
  const needsPrice = activeFields.includes("price");
  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(),
    enabled: needsPrice,
    staleTime: 5 * 60 * 1000,
  });
  const activityPrice = activitiesQuery.data?.activities.find(
    (a) => a.id === appointment.activityId,
  )?.priceCzk ?? null;

  const patient = patientQuery.data;
  const statusLabel = (() => {
    const name = statusName(appointment.status);
    return name ? t(`booking.status.${name}`) : t("booking.status.unknown");
  })();

  const value = (key: string): string | null => {
    switch (key) {
      case "patientName":
        if (!hasPatient) {
          return appointment.patientName?.trim() || null;
        }
        return patient
          ? (patient.fullName || `${patient.firstName} ${patient.lastName}`.trim())
          : null;
      case "phone":
        if (!hasPatient) {
          return appointment.unregisteredPhone?.trim() || null;
        }
        return patient?.phone?.trim() || null;
      case "email":
        return hasPatient ? (patient?.email?.trim() || null) : null;
      case "registrationStatus":
        if (!hasPatient) {
          return "Neregistrovaný";
        }
        return patient?.status
          ? (REGISTRATION_STATUS_LABELS[patient.status] ?? patient.status)
          : null;
      case "birthDate":
        return patient?.dateOfBirth ? formatPragueDate(patient.dateOfBirth) : null;
      case "activity":
        return appointment.activityName || null;
      case "price":
        return activityPrice !== null ? formatPrice(activityPrice) : null;
      case "service":
        return calendarName || null;
      case "status":
        return statusLabel;
      case "paperwork":
        return appointment.paperwork
          ? appointment.paperwork.ready
            ? t("booking.paperwork.ready")
            : appointment.paperwork.missing.length > 0
              ? appointment.paperwork.missing.map(paperworkReasonLabel).join(" · ")
              : t("booking.paperwork.line")
          : null;
      case "questionnaire":
        return questionnaireStatus(appointment.paperwork);
      default:
        return null;
    }
  };

  const labelFor = (key: string): string => {
    switch (key) {
      case "patientName": return "Pacient";
      case "phone": return "Telefon";
      case "email": return "E-mail";
      case "birthDate": return "Narozen(a)";
      case "activity": return "Činnost";
      case "price": return "Cena";
      case "service": return "Služba";
      case "registrationStatus": return "Registrace";
      case "questionnaire": return "Dotazník";
      case "status": return "Stav objednávky";
      case "paperwork": return "Podklady";
      default: return key;
    }
  };

  const rows = activeFields
    .map((key) => ({ key, label: labelFor(key), val: value(key) }))
    .filter((r) => r.val !== null);
  /* A club booking says so whatever fields the owner picked: the partner and its discount. */
  const club = clubLine(appointment.partnerName, appointment.clubDiscountPercent);
  if (club !== null) rows.unshift({ key: "club", label: GRID_TEXT.clubLine, val: club });

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
