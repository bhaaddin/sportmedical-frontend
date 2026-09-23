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
import EditIcon from '@mui/icons-material/Edit';
import { holidaysApi } from '../../api/holidays';
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
  const [editing, setEditing] = useState<{ date: string; name: string; isHoliday: boolean } | null>(null);
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
  const failure = setWorking.error ?? setOnline.error ?? reset.error ?? save.error;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Svátky a volno
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Ve svátek je ordinace zavřená a nikdo se nemůže objednat. Pokud v některý svátek pracujete,
        zapněte u něj <strong>Pracujeme v tento den</strong> – pak ten den platí vaše běžná pracovní
        doba a dá se objednat.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        <strong>Online objednávky vypnuty</strong> znamená: pracuje se, recepce objednává, ale přes
        internet si ten den nikdo termín nevezme.
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, alignItems: 'center' }}>
        <Button onClick={() => setYear((y) => y - 1)}>{year - 1}</Button>
        <Typography sx={{ fontWeight: 800, fontSize: 20 }}>{year}</Typography>
        <Button onClick={() => setYear((y) => y + 1)}>{year + 1}</Button>

        <Box sx={{ flex: 1 }} />

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditing({ date: `${year}-01-01`, name: '', isHoliday: true })}
        >
          Přidat vlastní volno
        </Button>
      </Stack>

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

      {holidays.isPending && (
        <Card><CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Načítáme rok…</Typography>
        </CardContent></Card>
      )}

      {holidays.isError && (
        <Alert severity="error">{errorText(holidays.error, t)}</Alert>
      )}

      {/*
        A year with nothing in it cannot happen — the law gives thirteen days —
        so an empty list means the request answered with nothing, which is worth
        saying rather than showing a blank page.
      */}
      {!holidays.isPending && !holidays.isError && rows.length === 0 && (
        <Card><CardContent>
          <Typography variant="body2" color="text.secondary">
            Pro tento rok jsme nedostali žádné dny. To by nemělo nastat — státní
            svátky přidává systém sám. Zkuste stránku načíst znovu.
          </Typography>
        </CardContent></Card>
      )}

      <Stack spacing={1}>
        {rows.map((holiday) => {
          const working = !holiday.isHoliday;
          const online = onlineState(holiday.date, perCalendar);

          return (
            <Card key={holiday.date} variant="outlined">
              <CardContent sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                py: 1.5,
                '&:last-child': { pb: 1.5 },
              }}>
                <Box sx={{ minWidth: 220 }}>
                  <Typography sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                    {czechDate(holiday.date)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {holiday.name}
                  </Typography>
                </Box>

                <StatusChip holiday={holiday} />

                <Box sx={{ flex: 1 }} />

                <Stack sx={{ minWidth: 250 }}>
                  <FormControlLabel
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
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      Zavřeno – nikdo se nemůže objednat.
                    </Typography>
                  )}
                </Stack>

                <IconButton
                  size="small"
                  aria-label="Upravit"
                  onClick={() => setEditing({
                    date: holiday.date,
                    name: holiday.name,
                    isHoliday: holiday.isHoliday,
                  })}
                >
                  <EditIcon fontSize="small" />
                </IconButton>

                {/* Only an amended day can be put back; a statutory one is already
                    where the law left it. */}
                {holiday.isAmended && (
                  <Tooltip title="Zpět na státní kalendář">
                    <IconButton
                      size="small"
                      aria-label="Vrátit"
                      disabled={busy || (!holiday.isHoliday && !exceptionsKnown)}
                      onClick={() => reset.mutate(holiday)}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editing?.name === '' ? 'Přidat vlastní volno' : 'Upravit den'}
        </DialogTitle>
        <DialogContent>
          {editing !== null && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                type="date"
                label="Datum"
                value={editing.date}
                onChange={(event) => setEditing({ ...editing, date: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Název"
                placeholder="Firemní volno"
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                helperText="Uvidíte ho v seznamu i v kalendáři."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditing(null)}>Zrušit</Button>
          <Button
            variant="contained"
            disabled={editing === null || editing.name.trim() === '' || save.isPending}
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
    </Box>
  );
}
