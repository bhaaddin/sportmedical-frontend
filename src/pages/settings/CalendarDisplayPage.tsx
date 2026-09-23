/* ══════════════════════════════════════════════════════════════
   VZHLED KALENDÁŘE  (route: /nastaveni/vzhled-kalendare)

   How the booking calendar is drawn for everybody at the clinic: which view
   it opens on, how long one row is, which hours a day shows, and the colour
   of the "now" line. They were constants in CalendarGridPage; the owner's
   rule is that they are his to change.

   The choices offered (views, row lengths) come from the server, which also
   refuses anything it cannot draw — this screen keeps no copy of the rules.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CALENDAR_DISPLAY_QUERY_KEY,
  readCalendarDisplay,
  saveCalendarDisplay,
} from '../../api/displaySettings';
import type { CalendarDisplaySettings, CalendarView } from '../../api/displaySettings';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Den',
  week: 'Týden',
  month: 'Měsíc',
};

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

export default function CalendarDisplayPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CALENDAR_DISPLAY_QUERY_KEY, queryFn: readCalendarDisplay });
  /* Unsaved edits over what the server has; null means "nothing changed yet". */
  const [edited, setDraft] = useState<CalendarDisplaySettings | null>(null);
  const [saved, setSaved] = useState(false);


  const save = useMutation({
    mutationFn: saveCalendarDisplay,
    onSuccess: (response) => {
      queryClient.setQueryData(CALENDAR_DISPLAY_QUERY_KEY, response);
      setDraft(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return <Alert severity="error">Nastavení kalendáře se nepodařilo načíst.</Alert>;
  }

  const { views, slotLengths, defaults } = query.data;
  const draft = edited ?? query.data.settings;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const set = <K extends keyof CalendarDisplaySettings>(key: K, value: CalendarDisplaySettings[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Vzhled kalendáře</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Jak se kalendář rezervací kreslí všem v ordinaci. Den se vždy roztáhne tak, aby byla vidět
          pracovní doba i každá rezervace mimo nastavené hodiny.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2.5}>
            <TextField
              select
              label="Výchozí pohled"
              value={draft.defaultView}
              onChange={(event) => set('defaultView', event.target.value as CalendarView)}
              error={errors.defaultView !== undefined}
              helperText={errors.defaultView ?? 'Na čem se kalendář otevře.'}
            >
              {views.map((view) => (
                <MenuItem key={view} value={view}>{VIEW_LABELS[view] ?? view}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Délka řádku"
              value={draft.slotMinutes}
              onChange={(event) => set('slotMinutes', Number(event.target.value))}
              error={errors.slotMinutes !== undefined}
              helperText={errors.slotMinutes ?? 'Kratší řádek = podrobnější, ale delší mřížka.'}
            >
              {slotLengths.map((minutes) => (
                <MenuItem key={minutes} value={minutes}>{minutes} minut</MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label="Den začíná v"
                value={draft.dayStartHour}
                onChange={(event) => set('dayStartHour', Number(event.target.value))}
                error={errors.dayStartHour !== undefined}
                helperText={errors.dayStartHour}
              >
                {HOURS.slice(0, 24).map((hour) => (
                  <MenuItem key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label="Den končí v"
                value={draft.dayEndHour}
                onChange={(event) => set('dayEndHour', Number(event.target.value))}
                error={errors.dayEndHour !== undefined}
                helperText={errors.dayEndHour}
              >
                {HOURS.slice(1).map((hour) => (
                  <MenuItem key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                label="Barva čáry „teď“"
                value={draft.nowLineColor}
                onChange={(event) => set('nowLineColor', event.target.value)}
                error={errors.nowLineColor !== undefined}
                helperText={errors.nowLineColor ?? 'Zápis #RRGGBB, například #D32F2F.'}
                sx={{ flexGrow: 1 }}
              />
              <Box
                component="input"
                type="color"
                aria-label="Vybrat barvu čáry"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.nowLineColor) ? draft.nowLineColor : '#000000'}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  set('nowLineColor', event.target.value.toUpperCase())}
                sx={{ width: 56, height: 56, border: 'none', background: 'none', cursor: 'pointer', p: 0 }}
              />
            </Stack>

            {save.isError && (
              <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert>
            )}
            {saved && !save.isPending && <Alert severity="success">Uloženo. Kalendář se tak kreslí všem.</Alert>}

            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate(draft)}>
                Uložit
              </Button>
              <Button
                color="inherit"
                disabled={save.isPending}
                onClick={() => { setSaved(false); setDraft(defaults); }}
              >
                Vrátit výchozí hodnoty
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
