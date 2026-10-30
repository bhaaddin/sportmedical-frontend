/* ══════════════════════════════════════════════════════════════
   SVÁTKY A VOLNO  (route: /svatky)

   The clinic's year: which days are off, and which of them it works anyway.

   ── The rule the owner set ──

   A holiday is closed: nobody can book, the day is switched off. Only when the
   administrator says "Pracujeme v tento den" do the calendars' own working
   hours apply that day, and only then can anybody be booked. On a working
   holiday the web can still be kept out ("Online objednávky vypnuty") while
   the desk books as usual.

   ── Why this screen exists ──

   The thirteen Czech public holidays were computed inside the source and
   reachable from nowhere. A clinic could not add a company day off, could not
   say it works on 28. října, and could not even SEE why a day was closed.

   ── What it does not do ──

   Closing ONE calendar for a day is not here. That is a výjimka, it belongs to
   a calendar, and it can also change the hours or name a stand-in. This screen
   answers what the DATE is for the whole clinic.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import { SettingsScreen } from './SettingsFrame';
import { isRealDate } from '../../utils/clinicDayRules';
import { Shelf, TARGET_SX } from '../../ui/shelf';
import { SettingsItemCard } from '../booking/SettingsItemCard';
import EditIcon from '@mui/icons-material/Edit';
import { holidaysApi } from '../../api/holidays';
import { FIELD_LIMITS, HOLIDAY_YEAR_MAX, HOLIDAY_YEAR_MIN } from '../../api/fieldLimits';
import type { ClinicHoliday } from '../../api/holidays';
import { calendarsApi } from '../../api/calendars';
import { workingHoursApi } from '../../api/workingHours';
import { errorText } from '../../components/booking/errorText';
import { useTranslation } from 'react-i18next';
import {
  onlinePlan,
  onlineState,
  workingSwitchAction,
  type CalendarExceptions,
} from './holidayDay';

/** The clinic's own time zone, so "today" is the clinic's today. */
const thisYear = (): number =>
  Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }).slice(0, 4));

const czechDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

/** What the row is, in words the owner can scan. */
function StatusChip({ holiday }: { holiday: ClinicHoliday }) {
  if (!holiday.isHoliday) {
    return <Chip size="small" color="success" label="Pracujeme" />;
  }

  if (holiday.isStatutory) {
    return <Chip size="small" variant="outlined" color="error" label="Státní svátek – zavřeno" />;
  }

  return <Chip size="small" color="warning" label="Naše volno – zavřeno" />;
}

export default function HolidaysPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(thisYear);
  /* `existing`: a day already on the list is renamed, never moved - its date is fixed. */
  const [editing, setEditing] = useState<{ date: string; name: string; isHoliday: boolean; existing: boolean } | null>(null);
  const [blocked, setBlocked] = useState<{ date: string; calendars: string[] } | null>(null);

  const holidays = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.year(year),
  });

  const calendars = useQuery({
    queryKey: ['calendars'],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;

  /* One request per calendar for the whole year; the list endpoint needs the range. */
  const exceptionQueries = useQueries({
    queries: (calendars.data ?? []).map((calendar) => ({
      queryKey: ['exceptions', calendar.id, yearFrom, yearTo],
      queryFn: () => workingHoursApi.listExceptions(calendar.id, yearFrom, yearTo),
    })),
  });

  const exceptionsKnown =
    calendars.isSuccess && exceptionQueries.every((query) => query.isSuccess);
  const perCalendar: CalendarExceptions[] = (calendars.data ?? []).map((calendar, index) => ({
    calendar,
    exceptions: exceptionQueries[index]?.data ?? [],
  }));

  const refreshExceptions = () => queryClient.invalidateQueries({ queryKey: ['exceptions'] });

  /** Online-only exceptions off, or on, for one date across the calendars. */
  const applyOnline = async (holiday: ClinicHoliday, closeOnline: boolean) => {
    const plan = onlinePlan(holiday.date, holiday.name, perCalendar, closeOnline);

    for (const { calendarId, id } of plan.remove) {
      await workingHoursApi.deleteException(calendarId, id);
    }
    for (const { calendarId, input } of plan.create) {
      await workingHoursApi.createException(calendarId, input);
    }

    return plan.blocked;
  };

  const setWorking = useMutation({
    mutationFn: async ({ holiday, working }: { holiday: ClinicHoliday; working: boolean }) => {
      const action = workingSwitchAction(holiday, working);

      // Closing the day again: an online-only exception left behind would
      // reopen it at the desk, so it goes first.
      if (!working) await applyOnline(holiday, false);

      if (action.kind === 'reset') await holidaysApi.reset(holiday.date);
      else await holidaysApi.save(holiday.date, action.isHoliday, action.name);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      await refreshExceptions();
    },
  });

  const setOnline = useMutation({
    mutationFn: ({ holiday, closeOnline }: { holiday: ClinicHoliday; closeOnline: boolean }) =>
      applyOnline(holiday, closeOnline),
    onSuccess: (names, { holiday }) =>
      setBlocked(names.length > 0 ? { date: holiday.date, calendars: names } : null),
    onSettled: refreshExceptions,
  });

  const save = useMutation({
    mutationFn: ({ date, isHoliday, name }: { date: string; isHoliday: boolean; name: string }) =>
      holidaysApi.save(date, isHoliday, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      setEditing(null);
    },
  });

  const reset = useMutation({
    mutationFn: async (holiday: ClinicHoliday) => {
      // Back to the statutory calendar means closed again, so nothing may reopen it.
      await applyOnline(holiday, false);
      await holidaysApi.reset(holiday.date);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      await refreshExceptions();
    },
  });

  const busy = setWorking.isPending || setOnline.isPending || reset.isPending;
  const rows = holidays.data ?? [];
  /* The dialog's own refusal is shown inside the dialog: behind a modal the page banner is out of sight. */
  const failure = setWorking.error ?? setOnline.error ?? reset.error;

  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' });
  const yearReady = !holidays.isPending && !holidays.isError;
  const upcoming = rows.filter((holiday) => holiday.date >= todayKey);
  const past = rows.filter((holiday) => holiday.date < todayKey).reverse();
  const openAdd = () => { save.reset(); setEditing({ date: '', name: '', isHoliday: true, existing: false }); };

  const dayCard = (holiday: ClinicHoliday) => {
    const working = !holiday.isHoliday;
    const online = onlineState(holiday.date, perCalendar);

    return (
      <SettingsItemCard
        key={holiday.date}
        kind="holiday"
        id={holiday.date}
        title={<span style={{ textTransform: 'capitalize' }}>{czechDate(holiday.date)}</span>}
        status={<StatusChip holiday={holiday} />}
        dim={holiday.date < todayKey}
        actions={
          <>
            <Box sx={{ flex: 1 }} />
            <IconButton
              aria-label="Upravit"
              sx={TARGET_SX}
              onClick={() => {
                save.reset();
                setEditing({
                  date: holiday.date,
                  name: holiday.name,
                  isHoliday: holiday.isHoliday,
                  existing: true,
                });
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>

            {/* Only an amended day can be put back; a statutory one is already
                where the law left it. */}
            {holiday.isAmended && (
              <Tooltip title="Zpět na státní kalendář">
                <span>
                  <IconButton
                    aria-label="Vrátit"
                    sx={TARGET_SX}
                    disabled={busy || (!holiday.isHoliday && !exceptionsKnown)}
                    onClick={() => reset.mutate(holiday)}
                  >
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </>
        }
      >
        <span>{holiday.name}</span>
        <FormControlLabel
          sx={{ ...TARGET_SX, mr: 0 }}
          control={
            <Switch
              checked={working}
              /* Closing again has to clear online-only exceptions,
                 so it waits until they are known. */
              disabled={busy || (working && !exceptionsKnown)}
              onChange={(event) =>
                setWorking.mutate({ holiday, working: event.target.checked })}
            />
          }
          label="Pracujeme v tento den"
        />
        {working ? (
          <FormControlLabel
            sx={{ ...TARGET_SX, mr: 0 }}
            control={
              <Switch
                size="small"
                checked={online !== 'open'}
                disabled={busy || !exceptionsKnown}
                onChange={(event) =>
                  setOnline.mutate({ holiday, closeOnline: event.target.checked })}
              />
            }
            label={online === 'partly'
              ? 'Online objednávky vypnuty (jen v některých kalendářích)'
              : 'Online objednávky vypnuty'}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            Zavřeno – nikdo se nemůže objednat.
          </Typography>
        )}
      </SettingsItemCard>
    );
  };

  return (
    <SettingsScreen
      title="Svátky a dovolené"
      subtitle="Ve svátek je ordinace zavřená a nikdo se nemůže objednat; vlastní volno ordinace přidáte sem"
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
        >
          Přidat vlastní volno
        </Button>
      }
    >
      <Shelf id="holidays-year" title="Rok" layout="board">
        <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Pokud v některý svátek pracujete, zapněte u něj <strong>Pracujeme v tento den</strong> – pak
          ten den platí vaše běžná pracovní doba a dá se objednat.
          {' '}<strong>Online objednávky vypnuty</strong> znamená: pracuje se, recepce objednává, ale přes
          internet si ten den nikdo termín nevezme.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button variant="outlined" size="small" sx={TARGET_SX} disabled={year <= HOLIDAY_YEAR_MIN} onClick={() => setYear((y) => y - 1)}>{year - 1}</Button>
          <Typography sx={{ fontWeight: 700, fontSize: 20, px: 1 }}>{year}</Typography>
          <Button variant="outlined" size="small" sx={TARGET_SX} disabled={year >= HOLIDAY_YEAR_MAX} onClick={() => setYear((y) => y + 1)}>{year + 1}</Button>
        </Stack>
        </Box>
      </Shelf>

      <Box sx={{ mt: 2 }}>
        {failure !== null && (
          <Alert severity="error" sx={{ mb: 2 }}>{errorText(failure, t)}</Alert>
        )}

        {(calendars.isError || exceptionQueries.some((query) => query.isError)) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Nepodařilo se načíst výjimky kalendářů, takže teď nejde přepnout online objednávky ani
            znovu zavřít svátek, ve kterém pracujete. Zkuste stránku načíst znovu.
          </Alert>
        )}

        {blocked !== null && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setBlocked(null)}>
            {czechDate(blocked.date)}: v kalendáři {blocked.calendars.join(', ')} už na tento den je
            jiná výjimka, takže tam online objednávky vypnout nešly. Upravte ten den ve Výjimkách.
          </Alert>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/*
          A year with nothing in it cannot happen — the law gives thirteen days —
          so an empty list means the request answered with nothing, which is worth
          saying rather than showing a blank page.
        */}
        <Shelf
          id="holidays-upcoming"
          title="Nadcházející"
          count={yearReady ? upcoming.length : undefined}
          layout="grid"
          minCardWidth={340}
          cardHeight={150}
          loading={holidays.isPending}
          error={holidays.isError ? errorText(holidays.error, t) : false}
          onRetry={() => { void holidays.refetch(); }}
          empty={yearReady && upcoming.length === 0}
          emptyState={{
            text: rows.length === 0
              ? 'Pro tento rok jsme nedostali žádné dny. To by nemělo nastat — státní svátky přidává systém sám. Zkuste stránku načíst znovu.'
              : 'V tomto roce už žádný další den nezbývá.',
            action: { label: 'Přidat vlastní volno', onClick: openAdd },
          }}
        >
          {upcoming.map(dayCard)}
        </Shelf>
        {yearReady && past.length > 0 ? (
          <Shelf id="holidays-past" title="Proběhlé" count={past.length} layout="grid" minCardWidth={340} cardHeight={150}>
            {past.map(dayCard)}
          </Shelf>
        ) : null}
      </Box>

      <Dialog open={editing !== null} onClose={() => { save.reset(); setEditing(null); }} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editing?.existing === true ? 'Upravit den' : 'Přidat vlastní volno'}
        </DialogTitle>
        <DialogContent>
          {editing !== null && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                type="date"
                label="Datum"
                value={editing.date}
                onChange={(event) => setEditing({ ...editing, date: event.target.value })}
                disabled={editing.existing}
                helperText={editing.existing ? 'Datum dne se nemění — přidejte jiný den jako nové volno.' : undefined}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Název"
                placeholder="Firemní volno"
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                helperText="Uvidíte ho v seznamu i v kalendáři."
                slotProps={{ htmlInput: { maxLength: FIELD_LIMITS.holidayName } }}
              />
              {save.error ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { save.reset(); setEditing(null); }}>Zrušit</Button>
          <Button
            variant="contained"
            disabled={editing === null || editing.name.trim() === '' || !isRealDate(editing.date) || save.isPending}
            onClick={() => editing !== null && save.mutate({
              date: editing.date,
              isHoliday: editing.isHoliday,
              name: editing.name.trim(),
            })}
          >
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsScreen>
  );
}
