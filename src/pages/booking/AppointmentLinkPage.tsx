import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { appointmentsApi } from "../../api/appointments";
import { patientsApi } from "../../api/patients";
import { isKnownPaperworkReason, statusName } from "../../api/bookingContracts";
import { AppointmentDetail, HistoryRow } from "../../components/booking/AppointmentDetail";
import { formatLongPragueDate } from "../../components/booking/appointmentEdit";
import { StatusChip } from "../../components/ui";
import { usePermission } from "../../auth/usePermission";
import { pragueDateKey, formatPragueTime } from "../../utils/time";
import { EntityCard, PageFrame, PinButton, Shelf, rememberOpened, type EntityRef } from "../../ui/shelf";
import { APPOINTMENT_STATUS_WORD } from "../../ui/shelf/words";

/**
 * The page of one appointment (route 36) - where a booking notification's `actionUrl` points
 * (`/kalendar/{calendarId}/termin/{appointmentId}`), and where every appointment chip of the shelf system lands.
 *
 * History worth keeping: the bell used to ring, a reception clicked it, and landed nowhere - no such route existed. Rather
 * than rewrite the server's link, the route it names exists: one place decides where an appointment lives.
 *
 * It opens with the appointment's detail dialog (the notification is about a change to act on - the same detail, the same
 * edit, move and cancel as everywhere, which can notify the patient). Behind it the appointment is a page of its own:
 *
 *   Termín          when, what, where, how it stands, what paperwork is missing
 *   Související     the patient and the činnost, each opening its own page (with a peek)
 *   Historie        who changed what, when and why
 *
 * Closing the dialog shows the page; "V kalendáři" opens the planner on that day. The calendar name is decoration: if it
 * fails to load the detail still opens, because the appointment is the point.
 */
export default function AppointmentLinkPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { calendarId, appointmentId } = useParams();
  const maySeePatients = usePermission("patients.view");
  const [open, setOpen] = useState(true);
  const known = calendarId !== undefined && appointmentId !== undefined;

  const calendarsQuery = useQuery({ queryKey: ["calendars"], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  /* The same key the dialog reads: asked once. */
  const detailQuery = useQuery({
    queryKey: ["appointment", calendarId, appointmentId],
    queryFn: () => appointmentsApi.get(calendarId as string, appointmentId as string),
    enabled: known,
  });
  const historyQuery = useQuery({
    queryKey: ["appointment-history", calendarId, appointmentId],
    queryFn: () => appointmentsApi.history(calendarId as string, appointmentId as string),
    enabled: known,
  });
  const appointment = detailQuery.data;
  const patientId = appointment?.patientId ?? "";
  const patientQuery = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsApi.getById(patientId),
    enabled: maySeePatients && patientId !== "",
    staleTime: 5 * 60 * 1000,
  });

  const calendar = (calendarsQuery.data ?? []).find((c) => c.id === calendarId);
  const patientName = patientQuery.data
    ? (patientQuery.data.fullName ?? `${patientQuery.data.firstName} ${patientQuery.data.lastName}`)
    : (appointment?.unregisteredName ?? null);
  const when = appointment ? `${formatPragueTime(appointment.startUtc)}–${formatPragueTime(appointment.endUtc)}` : "";
  const self: EntityRef | null = useMemo(
    () =>
      appointment && calendarId
        ? { kind: "appointment", id: appointment.id, calendarId, label: `${appointment.activityName || "Termín"} ${formatPragueTime(appointment.startUtc)}` }
        : null,
    [appointment, calendarId],
  );

  /* Recents: once the appointment has loaded (ids and a label, nothing else). */
  useEffect(() => {
    if (self !== null) rememberOpened(self);
  }, [self]);

  if (!known) {
    return (
      <PageFrame title="Termín" purpose="Odkaz na termín">
        <Alert severity="warning">{t("booking.appointmentLink.missing")}</Alert>
      </PageFrame>
    );
  }

  const status = appointment ? APPOINTMENT_STATUS_WORD[statusName(appointment.status) ?? ""] : undefined;
  const related: EntityRef[] = [];
  if (appointment && appointment.patientId !== "") related.push({ kind: "patient", id: appointment.patientId, label: patientName ?? "Pacient" });
  if (appointment && appointment.activityName) related.push({ kind: "activity", id: appointment.activityId, label: appointment.activityName });
  const missing = appointment?.paperwork?.missing ?? [];

  return (
    <PageFrame
      title={appointment ? appointment.activityName || "Termín" : "Termín"}
      purpose={appointment ? `${formatLongPragueDate(appointment.startUtc)} · ${when}${calendar ? ` · ${calendar.name}` : ""}` : "Načítám termín…"}
      titleAddon={self !== null ? <PinButton entity={self} /> : undefined}
      badges={status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : undefined}
      primaryAction={appointment ? { label: "Otevřít detail", onClick: () => setOpen(true) } : undefined}
    >
      <Shelf
        id="appointment"
        title="Termín"
        layout="board"
        loading={detailQuery.isPending}
        error={detailQuery.isError ? "Termín se nepodařilo načíst." : false}
        onRetry={() => void detailQuery.refetch()}
        viewAll={appointment ? { to: "/planovani", state: { date: pragueDateKey(appointment.startUtc) }, label: "V kalendáři" } : undefined}
      >
        {appointment && (
          <Stack spacing={1.25} sx={{ p: 2 }}>
            <Fact label="Kdy" value={`${formatLongPragueDate(appointment.startUtc)}, ${when}`} />
            <Fact label="Kalendář" value={calendar?.name ?? "—"} />
            {/* A registered patient is a card under "Související"; a slot without one says the name it was taken under. */}
            {appointment.patientId === "" ? <Fact label="Pacient" value={patientName ?? "Bez pacienta"} /> : null}
            {appointment.note ? <Fact label="Poznámka" value={appointment.note} /> : null}
            {/* Only when the register answered: `null` is "not looked", never "all in order". */}
            {appointment.paperwork ? (
              <Fact
                label={t("booking.paperwork.line")}
                value={
                  missing.length === 0 ? (
                    t("booking.paperwork.ready")
                  ) : (
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
                      {missing.map((code) => (
                        <StatusChip key={code} tone="beige" size="sm">
                          {isKnownPaperworkReason(code) ? t(`booking.paperwork.${code}`) : t("booking.paperwork.unknown", { code })}
                        </StatusChip>
                      ))}
                    </Stack>
                  )
                }
              />
            ) : null}
          </Stack>
        )}
      </Shelf>

      {appointment && (
        <Shelf
          id="related"
          title="Související"
          layout="row"
          minCardWidth={260}
          count={related.length}
          empty={related.length === 0}
          emptyState={{ text: "Termín nemá pacienta ani činnost v nabídce.", action: { label: "V kalendáři", to: "/planovani", state: { date: pragueDateKey(appointment.startUtc) } } }}
        >
          {related.map((e) => (
            <EntityCard key={`${e.kind}:${e.id}`} entity={e} subtitle={e.kind === "patient" ? "Karta pacienta" : "Činnost v nabídce"} />
          ))}
        </Shelf>
      )}

      <Shelf
        id="history"
        title={t("booking.detail.history")}
        count={historyQuery.data?.length}
        layout="board"
        loading={historyQuery.isPending}
        error={historyQuery.isError ? "Historii termínu se nepodařilo načíst." : false}
        onRetry={() => void historyQuery.refetch()}
        empty={(historyQuery.data ?? []).length === 0}
        emptyState={{ text: t("booking.detail.historyEmpty"), action: { label: "Otevřít detail", onClick: () => setOpen(true) } }}
      >
        <Stack component="ul" spacing={0.75} sx={{ listStyle: "none", p: 2, m: 0 }}>
          {[...(historyQuery.data ?? [])]
            .sort((a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime())
            .map((line, index) => (
              <HistoryRow key={`${line.atUtc}-${index}`} line={line} />
            ))}
        </Stack>
      </Shelf>

      <AppointmentDetail
        appointmentId={appointmentId}
        calendarId={calendarId}
        calendar={calendar}
        open={open}
        onClose={() => setOpen(false)}
        onChanged={() => {
          /* The dialog refetches itself; the page reads the same keys, plus the history. */
          void queryClient.invalidateQueries({ queryKey: ["appointment-history", calendarId, appointmentId] });
        }}
      />
    </PageFrame>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>{label}</Typography>
      <Typography component="div" variant="body2" sx={{ fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}
