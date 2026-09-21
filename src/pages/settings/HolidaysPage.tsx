/* ══════════════════════════════════════════════════════════════
   SVÁTKY A VOLNO  (route: /svatky)

   The clinic's year: which days are off, and which of them it works anyway.

   ── Why this screen exists ──

   The thirteen Czech public holidays were computed inside the source and
   reachable from nowhere. A clinic could not add a company day off, could not
   say it works on 28. října, and could not even SEE why a day was closed —
   availability simply offered no times and gave no reason. Somebody looking at
   an empty Monday in April had to read the code to find Velikonoční pondělí.

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
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import UndoIcon from '@mui/icons-material/Undo';
import EditIcon from '@mui/icons-material/Edit';
import { holidaysApi } from '../../api/holidays';
import type { ClinicHoliday } from '../../api/holidays';
import { errorText } from '../../components/booking/errorText';
import { useTranslation } from 'react-i18next';

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

/** What the row is, in one word the owner can scan. */
function StatusChip({ holiday }: { holiday: ClinicHoliday }) {
  if (holiday.isAmended && !holiday.isHoliday) {
    return <Chip size="small" color="success" label="Pracujeme" />;
  }

  if (holiday.isAmended) {
    return <Chip size="small" color="warning" label="Naše volno" />;
  }

  return <Chip size="small" variant="outlined" label="Státní svátek" />;
}

export default function HolidaysPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(thisYear);
  const [editing, setEditing] = useState<{ date: string; name: string; isHoliday: boolean } | null>(null);

  const holidays = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.year(year),
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
    mutationFn: (date: string) => holidaysApi.reset(date),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['holidays', year] }),
  });

  const rows = holidays.data ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Svátky a volno
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Státní svátky zavírají ordinaci samy. Tady můžete říct, že v některý
        pracujete, nebo přidat vlastní volno.
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

      {save.error !== null && (
        <Alert severity="error" sx={{ mb: 2 }}>{errorText(save.error, t)}</Alert>
      )}
      {reset.error !== null && (
        <Alert severity="error" sx={{ mb: 2 }}>{errorText(reset.error, t)}</Alert>
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
        {rows.map((holiday) => (
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

              {/*
                No Tooltip. MUI gives the tooltip's text to the button as its
                accessible name, so a screen reader announced "V tento den
                pracujeme" for a button labelled "Pracujeme" -- and the test
                that looks for the button by its label could not find it. The
                label already says what the button does.
              */}
              <Button
                size="small"
                variant="outlined"
                disabled={save.isPending}
                onClick={() => save.mutate({
                  date: holiday.date,
                  isHoliday: !holiday.isHoliday,
                  // The reason travels with the decision. Both directions get a
                  // default the owner can overwrite, because a row with no word
                  // beside it is a row nobody can explain later.
                  name: holiday.isHoliday
                    ? 'Pracujeme'
                    : holiday.name || 'Volno',
                })}
              >
                {holiday.isHoliday ? 'Pracujeme' : 'Máme volno'}
              </Button>

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
                    disabled={reset.isPending}
                    onClick={() => reset.mutate(holiday.date)}
                  >
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </CardContent>
          </Card>
        ))}
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
