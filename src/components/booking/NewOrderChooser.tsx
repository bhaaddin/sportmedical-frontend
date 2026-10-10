import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import Close from "@mui/icons-material/Close";
import ArrowBack from "@mui/icons-material/ArrowBack";
import BoltOutlined from "@mui/icons-material/BoltOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { appointmentsApi } from "../../api/appointments";
import { activitiesApi } from "../../api/activities";
import { calendarsApi } from "../../api/calendars";
import { clinicServicesApi, type ClinicService } from "../../api/clinicServices";
import type { Activity } from "../../api/bookingContracts";
import { useDevice } from "../../layout/useDevice";
import { DESIGN } from "../ui";
import { addDaysToDateOnly, pragueDateKey, toDateOnly } from "../../utils/time";
import { NEXT_FREE_HORIZON_DAYS } from "./grid/nextFreeSlot";
import { pragueClock } from "./NewAppointmentDialog.logic";
import { NewAppointmentDialog } from "./NewAppointmentDialog";

/**
 * "Nová objednávka": what the desk does first is choose the služba; then there
 * are two ways on.
 *
 *  - **Rychlá registrace** - the booking drawer opens in quick-registration
 *    mode on the next free slot of that služba (found with the same
 *    availability API the drawer itself trusts, 6.1).
 *  - **Vybrat v kalendáři** - the calendar, filtered to that služba.
 *
 * A club order is not started here: it has its own entry (the calendar's "Klubová objednávka", Kluby).
 *
 * A small dialog on a desktop or a tablet, a bottom sheet on a phone. Nothing
 * here is a price or a clinic's own text: services, colours and the slot all
 * come from the API.
 */

const TEXT = {
  title: "Nová objednávka",
  chooseService: "Vyberte službu",
  chosen: (name: string) => `Služba: ${name}`,
  otherService: "Jiná služba",
  quick: "Rychlá registrace",
  quickHint: "Nejbližší volný termín, nový pacient se zapíše rovnou.",
  calendar: "Vybrat v kalendáři",
  calendarHint: "Otevře kalendář jen s touto službou.",
  searching: "Hledám nejbližší volný termín…",
  none: (name: string, days: number) =>
    `Pro službu „${name}“ není v následujících ${days} dnech volný termín. Zkuste kalendář.`,
  searchFailed: "Volný termín se nepodařilo zjistit. Zkuste to prosím znovu, nebo vyberte v kalendáři.",
  noServices: "Zatím tu není žádná aktivní služba.",
  loadFailed: "Služby se nepodařilo načíst.",
  retry: "Zkusit znovu",
  close: "Zavřít",
};

interface FoundQuickSlot {
  calendarId: string;
  activityId: string;
  date: string;
  time: string;
  end: string;
}

/**
 * The earliest start the server offers for any činnost of the služba, on any of
 * the calendars that run it, from now to the horizon. `null` when there is none.
 */
export async function findNextFreeForService(
  serviceId: string,
  calendars: readonly { id: string; isActive: boolean; clinicServiceId: string | null }[],
  activities: readonly Activity[],
  now: Date = new Date(),
  horizonDays: number = NEXT_FREE_HORIZON_DAYS,
): Promise<FoundQuickSlot | null> {
  const runs = calendars.filter((c) => c.isActive && c.clinicServiceId === serviceId);
  const offers = activities.filter((a) => a.isActive && a.clinicServiceId === serviceId);
  if (runs.length === 0 || offers.length === 0) return null;

  const from = toDateOnly(now);
  const to = addDaysToDateOnly(from, horizonDays - 1);
  const nowMs = now.getTime();

  const answers = await Promise.all(
    runs.flatMap((calendar) =>
      offers.map(async (activity) => {
        const slots = await appointmentsApi.getAvailability(calendar.id, activity.id, from, to);
        return slots
          .filter((slot) => Date.parse(slot.startUtc) > nowMs)
          .map((slot) => ({ calendarId: calendar.id, activityId: activity.id, slot }));
      }),
    ),
  );

  let best: { calendarId: string; activityId: string; slot: { startUtc: string; endUtc: string } } | null = null;
  for (const candidate of answers.flat()) {
    if (best === null || Date.parse(candidate.slot.startUtc) < Date.parse(best.slot.startUtc)) {
      best = candidate;
    }
  }
  if (best === null) return null;
  return {
    calendarId: best.calendarId,
    activityId: best.activityId,
    date: pragueDateKey(best.slot.startUtc),
    time: pragueClock(best.slot.startUtc),
    end: pragueClock(best.slot.endUtc),
  };
}

export interface NewOrderChooserProps {
  open: boolean;
  onClose: () => void;
}

export function NewOrderChooser({ open, onClose }: NewOrderChooserProps) {
  const device = useDevice();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [service, setService] = useState<ClinicService | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [slot, setSlot] = useState<FoundQuickSlot | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["clinic-services"],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const services = [...(servicesQuery.data ?? [])]
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  /* Opened again, it starts at the first step. */
  useEffect(() => {
    if (open) return;
    setService(null);
    setSeeking(false);
    setNote(null);
    setSlot(null);
  }, [open]);

  const finish = () => {
    setSlot(null);
    onClose();
  };

  const quickRegistration = async () => {
    if (service === null) return;
    setSeeking(true);
    setNote(null);
    try {
      const [calendars, activities] = await Promise.all([
        queryClient.fetchQuery({ queryKey: ["calendars"], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 }),
        queryClient.fetchQuery({ queryKey: ["activities"], queryFn: activitiesApi.list, staleTime: 5 * 60 * 1000 }),
      ]);
      const found = await findNextFreeForService(service.id, calendars, activities.activities);
      if (found === null) setNote(TEXT.none(service.name, NEXT_FREE_HORIZON_DAYS));
      else setSlot(found);
    } catch {
      setNote(TEXT.searchFailed);
    } finally {
      setSeeking(false);
    }
  };

  const inCalendar = () => {
    if (service === null) return;
    navigate("/planovani", { state: { serviceId: service.id } });
    finish();
  };

  /* The drawer takes over once a slot is found; the chooser is gone behind it. */
  if (slot !== null) {
    return (
      <NewAppointmentDialog
        open
        onClose={finish}
        onBooked={() => {
          void queryClient.invalidateQueries({ queryKey: ["day-range"] });
          void queryClient.invalidateQueries({ queryKey: ["availability"] });
        }}
        initialCalendarId={slot.calendarId}
        initialStart={`${slot.date}T${slot.time}`}
        initialEnd={`${slot.date}T${slot.end}`}
        initialQuick
        initialActivityId={slot.activityId}
        initialServiceId={service?.id}
      />
    );
  }

  const phone = device === "phone";
  const labelId = "new-order-chooser-title";

  const content = (
    <Stack spacing={2}>
      {service === null ? (
        <>
          <Typography variant="body2" color="text.secondary">
            {TEXT.chooseService}
          </Typography>
          {servicesQuery.isError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void servicesQuery.refetch()}>
                  {TEXT.retry}
                </Button>
              }
            >
              {TEXT.loadFailed}
            </Alert>
          ) : servicesQuery.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} aria-label="Načítám služby" />
            </Box>
          ) : services.length === 0 ? (
            <Alert severity="info">{TEXT.noServices}</Alert>
          ) : (
            <Stack spacing={1} role="group" aria-label="Služby">
              {services.map((s) => (
                <ButtonBase
                  key={s.id}
                  onClick={() => {
                    setService(s);
                    setNote(null);
                  }}
                  sx={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: 1.5,
                    px: 2,
                    minHeight: phone ? 56 : 48,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: "divider",
                    textAlign: "left",
                    "&:hover": { bgcolor: "action.hover" },
                    "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" },
                  }}
                >
                  <Box
                    aria-hidden
                    data-testid="service-colour"
                    sx={{
                      width: 12,
                      alignSelf: "stretch",
                      my: 1,
                      borderRadius: 1,
                      bgcolor: s.colorHex ?? DESIGN.faint,
                    }}
                  />
                  <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                </ButtonBase>
              ))}
            </Stack>
          )}
        </>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Box
              aria-hidden
              sx={{ width: 12, height: 24, borderRadius: 1, bgcolor: service.colorHex ?? DESIGN.faint }}
            />
            <Typography sx={{ fontWeight: 700, flex: 1 }}>{TEXT.chosen(service.name)}</Typography>
            <Link
              component="button"
              type="button"
              underline="hover"
              disabled={seeking}
              onClick={() => {
                setService(null);
                setNote(null);
              }}
              sx={{ fontSize: 13, fontWeight: 600 }}
            >
              {TEXT.otherService}
            </Link>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: phone ? "1fr" : "1fr 1fr",
              gap: 1.5,
            }}
          >
            <Button
              variant="contained"
              size="large"
              disabled={seeking}
              onClick={() => void quickRegistration()}
              startIcon={seeking ? <CircularProgress size={18} color="inherit" /> : <BoltOutlined />}
              sx={{ minHeight: 72, flexDirection: "column", gap: 0.25, textTransform: "none", py: 1.5 }}
            >
              <Typography component="span" sx={{ fontWeight: 700 }}>
                {TEXT.quick}
              </Typography>
              <Typography component="span" variant="caption" sx={{ opacity: 0.9 }}>
                {TEXT.quickHint}
              </Typography>
            </Button>
            <Button
              variant="outlined"
              size="large"
              disabled={seeking}
              onClick={inCalendar}
              startIcon={<CalendarMonthOutlined />}
              sx={{ minHeight: 72, flexDirection: "column", gap: 0.25, textTransform: "none", py: 1.5 }}
            >
              <Typography component="span" sx={{ fontWeight: 700 }}>
                {TEXT.calendar}
              </Typography>
              <Typography component="span" variant="caption" color="text.secondary">
                {TEXT.calendarHint}
              </Typography>
            </Button>
          </Box>

          {seeking ? (
            <Typography variant="body2" color="text.secondary" role="status">
              {TEXT.searching}
            </Typography>
          ) : null}
          {note !== null ? <Alert severity="info">{note}</Alert> : null}
        </>
      )}

    </Stack>
  );

  if (phone) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-labelledby": labelId,
            "data-layout": "bottom-sheet",
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "90dvh" },
          } as object,
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", px: 2, pt: 1.5 }}>
          {service !== null ? (
            <IconButton aria-label="Zpět na výběr služby" onClick={() => setService(null)} disabled={seeking}>
              <ArrowBack />
            </IconButton>
          ) : null}
          <Typography id={labelId} variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
            {TEXT.title}
          </Typography>
          <IconButton aria-label={TEXT.close} onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
            <Close />
          </IconButton>
        </Stack>
        <Box sx={{ px: 2, pb: 3, pt: 1, overflowY: "auto" }}>{content}</Box>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby={labelId}>
      <DialogTitle id={labelId} sx={{ fontWeight: 700, display: "flex", alignItems: "center" }}>
        <Box sx={{ flex: 1 }}>{TEXT.title}</Box>
        <IconButton aria-label={TEXT.close} onClick={onClose} edge="end">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>{content}</DialogContent>
    </Dialog>
  );
}

export default NewOrderChooser;
