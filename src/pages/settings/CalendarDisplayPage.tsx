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
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionLabel, SoftCard } from '../../components/ui';
import { SettingsScreen } from './SettingsFrame';
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

/**
 * The facts the calendar hover can show, and what to call them. The admin ticks
 * which appear (and the order they are ticked in is the order shown), so nothing
 * about the hover is hard-coded — the same list the hover card reads keys from.
 */
const HOVER_FIELD_LABELS: { key: string; label: string }[] = [
  { key: 'patientName', label: 'Jméno pacienta' },
  { key: 'activity', label: 'Činnost' },
  { key: 'price', label: 'Cena' },
  { key: 'registrationStatus', label: 'Stav registrace' },
  { key: 'status', label: 'Stav objednávky' },
  { key: 'phone', label: 'Telefon' },
  { key: 'email', label: 'E-mail' },
  { key: 'birthDate', label: 'Datum narození' },
  { key: 'paperwork', label: 'Podklady' },
];

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

  const sentence = 'Jak se kalendář kreslí všem v ordinaci — den se roztáhne tak, aby byla vidět pracovní doba i každá rezervace mimo ni';

  if (query.isPending) {
    return <SettingsScreen title="Kalendář a mřížka" subtitle={sentence} loading>{null}</SettingsScreen>;
  }

  if (query.isError || !query.data) {
    return (
      <SettingsScreen title="Kalendář a mřížka" subtitle={sentence} error="Nastavení kalendáře se nepodařilo načíst." onRetry={() => { void query.refetch(); }}>
        {null}
      </SettingsScreen>
    );
  }

  const { views, slotLengths, defaults } = query.data;
  const draft = edited ?? query.data.settings;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const set = <K extends keyof CalendarDisplaySettings>(key: K, value: CalendarDisplaySettings[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };

  return (
    <SettingsScreen
      title="Kalendář a mřížka"
      subtitle="Jak se kalendář kreslí všem v ordinaci — den se roztáhne tak, aby byla vidět pracovní doba i každá rezervace mimo ni"
      save={{
        dirty: edited !== null,
        saving: save.isPending,
        onSave: () => save.mutate(draft),
        onDiscard: () => { setSaved(false); setDraft(null); },
      }}
    >
      <SoftCard>
          <Stack spacing={2.5}>
            <SectionLabel sx={{ mb: 0 }}>Pohled a mřížka</SectionLabel>
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

            <Divider />
            <SectionLabel sx={{ mb: 0 }}>Barvy</SectionLabel>

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

            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                label="Barva volných dnů a svátků"
                value={draft.holidayColor}
                onChange={(event) => set('holidayColor', event.target.value)}
                error={errors.holidayColor !== undefined}
                helperText={errors.holidayColor ?? 'Celý den se vykreslí touto barvou. Vyberte si vlastní — třeba jemnou šedou nebo červenou pro svátky.'}
                sx={{ flexGrow: 1 }}
              />
              <Box
                component="input"
                type="color"
                aria-label="Vybrat barvu volných dnů"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.holidayColor) ? draft.holidayColor : '#64748B'}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  set('holidayColor', event.target.value.toUpperCase())}
                sx={{ width: 56, height: 56, border: 'none', background: 'none', cursor: 'pointer', p: 0 }}
              />
            </Stack>

            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                label="Barva obědové pauzy"
                value={draft.lunchColor}
                onChange={(event) => set('lunchColor', event.target.value)}
                error={errors.lunchColor !== undefined}
                helperText={errors.lunchColor ?? 'Pruh oběda v kalendáři se vykreslí touto barvou.'}
                sx={{ flexGrow: 1 }}
              />
              <Box
                component="input"
                type="color"
                aria-label="Vybrat barvu obědové pauzy"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.lunchColor) ? draft.lunchColor : '#E11D48'}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  set('lunchColor', event.target.value.toUpperCase())}
                sx={{ width: 56, height: 56, border: 'none', background: 'none', cursor: 'pointer', p: 0 }}
              />
            </Stack>

            <Divider />

            <Box>
              <SectionLabel sx={{ mb: 0.5 }}>Bublina nad objednávkou</SectionLabel>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                Co ukázat po najetí myší na objednávku
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Vyberte, které údaje se zobrazí v bublině nad termínem. Platí pro celou ordinaci.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
                {HOVER_FIELD_LABELS.map(({ key, label }) => {
                  const on = draft.hoverFields.includes(key);
                  return (
                    <FormControlLabel
                      key={key}
                      control={
                        <Checkbox
                          checked={on}
                          onChange={() =>
                            set(
                              'hoverFields',
                              on
                                ? draft.hoverFields.filter((f) => f !== key)
                                : [...draft.hoverFields, key],
                            )}
                        />
                      }
                      label={label}
                    />
                  );
                })}
              </Box>
            </Box>

            {save.isError && (
              <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert>
            )}
            {saved && !save.isPending && <Alert severity="success">Uloženo. Kalendář se tak kreslí všem.</Alert>}

            <Box>
              <Button
                size="small"
                sx={{ color: 'text.secondary' }}
                disabled={save.isPending}
                onClick={() => { setSaved(false); setDraft(defaults); }}
              >
                Vrátit výchozí hodnoty
              </Button>
            </Box>
          </Stack>
      </SoftCard>
    </SettingsScreen>
  );
}
