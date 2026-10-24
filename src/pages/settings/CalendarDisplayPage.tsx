/* ══════════════════════════════════════════════════════════════
   VZHLED KALENDÁŘE  (route: /nastaveni/vzhled-kalendare)

   How the booking calendar is drawn for everybody at the clinic: which view
   it opens on, how long one row is, which hours a day shows, and the colour
   of the "now" line. They were constants in CalendarGridPage; the owner's
   rule is that they are his to change.

   The choices offered (views, row lengths) come from the server, which also
   refuses anything it cannot draw — this screen keeps no copy of the rules.
   ══════════════════════════════════════════════════════════════ */

import { FIELD_EDGE } from '../../theme';
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
  hoverChoices,
  readCalendarDisplay,
  saveCalendarDisplay,
} from '../../api/displaySettings';
import type { CalendarDisplaySettings, CalendarView } from '../../api/displaySettings';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import { BookingSlotsCard } from './BookingSlotsCard';
import { SingleWorkerCard } from './SingleWorkerCard';
import { DEFAULT_HOLIDAY_COLOR, holidayColorProblem } from '../../colors/dayLock';

const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Den',
  week: 'Týden',
  month: 'Měsíc',
};

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

/** What is wrong with the default lunch break, in words, or null. Both empty is allowed (no default lunch). */
export function lunchBreakProblem(from: string, to: string): string | null {
  const a = from.trim().slice(0, 5);
  const b = to.trim().slice(0, 5);
  if (a === '' && b === '') return null;
  if (a === '' || b === '') return 'Obědová pauza potřebuje začátek i konec, nebo obě pole prázdná.';
  return b <= a ? 'Obědová pauza musí končit později, než začne.' : null;
}

export default function CalendarDisplayPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CALENDAR_DISPLAY_QUERY_KEY, queryFn: readCalendarDisplay });
  /* Unsaved edits over what the server has; null means "nothing changed yet". */
  const [edited, setDraft] = useState<CalendarDisplaySettings | null>(null);
  const [saved, setSaved] = useState(false);
  /* The lunch break is checked when Uložit is pressed, not while the second box is still empty. */
  const [lunchTried, setLunchTried] = useState(false);


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
    return <SettingsScreen title="Kalendář a mřížka" subtitle={sentence} scope="calendar" loading>{null}</SettingsScreen>;
  }

  if (query.isError || !query.data) {
    return (
      <SettingsScreen title="Kalendář a mřížka" subtitle={sentence} scope="calendar" error="Nastavení kalendáře se nepodařilo načíst." onRetry={() => { void query.refetch(); }}>
        {null}
      </SettingsScreen>
    );
  }

  const { views, slotLengths, defaults } = query.data;
  const draft = edited ?? query.data.settings;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const lunchProblem = lunchBreakProblem(draft.lunchFrom ?? '', draft.lunchTo ?? '');
  /* R6: the holiday colour must read (AA text on it) and stand out from a closed day's grey; a failing colour is refused here, not saved. */
  const holidayProblem = holidayColorProblem(draft.holidayColor);
  const set = <K extends keyof CalendarDisplaySettings>(key: K, value: CalendarDisplaySettings[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };

  return (
    <SettingsScreen
      title="Kalendář a mřížka"
      subtitle="Jak se kalendář kreslí všem v ordinaci — den se roztáhne tak, aby byla vidět pracovní doba i každá rezervace mimo ni"
      /* The server files the calendar's settings under "calendar" (measured: "Kalendář: výchozí pohled …"); the catalogue id found nothing. */
      scope="calendar"
      save={{
        dirty: edited !== null,
        saving: save.isPending,
        onSave: () => {
          setLunchTried(true);
          if (lunchProblem === null && holidayProblem === null) save.mutate(draft);
        },
        onDiscard: () => { setSaved(false); setLunchTried(false); setDraft(null); },
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

            {/*
              * The clinic's default lunch break. Measured on the dev API: it is the break every day of the timetable
              * gets while its working-hours row names none (a row with its own break overrides it), and both
              * boxes empty means no default lunch. It rides in this same PUT and had no box on this screen.
              */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                type="time"
                label="Výchozí oběd od"
                value={draft.lunchFrom ?? ''}
                onChange={(event) => set('lunchFrom', event.target.value)}
                error={(lunchTried && lunchProblem !== null) || errors.lunch !== undefined}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth
                type="time"
                label="Výchozí oběd do"
                value={draft.lunchTo ?? ''}
                onChange={(event) => set('lunchTo', event.target.value)}
                error={(lunchTried && lunchProblem !== null) || errors.lunch !== undefined}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Typography variant="caption" color={(lunchTried && lunchProblem !== null) || errors.lunch !== undefined ? 'error' : 'text.secondary'} sx={{ mt: -1.5 }}>
              {(lunchTried ? lunchProblem : null) ?? errors.lunch ?? 'Pauza, kterou má každý pracovní den, dokud mu řádek pracovní doby nepřidělí vlastní. Obě pole prázdná = žádný výchozí oběd.'}
            </Typography>

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
                sx={{ width: 56, height: 56, flexShrink: 0, border: '1px solid', borderColor: (t) => FIELD_EDGE[t.palette.mode], borderRadius: 1, background: 'none', cursor: 'pointer', p: 0 }}
              />
            </Stack>

            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <TextField
                label="Barva svátků"
                value={draft.holidayColor}
                onChange={(event) => set('holidayColor', event.target.value)}
                error={errors.holidayColor !== undefined || holidayProblem !== null}
                helperText={errors.holidayColor ?? holidayProblem ?? `Zavřený svátek se v kalendáři vykreslí celý touto barvou (výchozí ${DEFAULT_HOLIDAY_COLOR}, výrazná červená, na všech barevných variantách stejná). Víkendy a zavřené dny jsou klidně šedé.`}
                sx={{ flexGrow: 1 }}
              />
              <Box
                component="input"
                type="color"
                aria-label="Vybrat barvu svátků"
                value={/^#[0-9a-fA-F]{6}$/.test(draft.holidayColor) ? draft.holidayColor : DEFAULT_HOLIDAY_COLOR}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  set('holidayColor', event.target.value.toUpperCase())}
                sx={{ width: 56, height: 56, flexShrink: 0, border: '1px solid', borderColor: (t) => FIELD_EDGE[t.palette.mode], borderRadius: 1, background: 'none', cursor: 'pointer', p: 0 }}
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
                sx={{ width: 56, height: 56, flexShrink: 0, border: '1px solid', borderColor: (t) => FIELD_EDGE[t.palette.mode], borderRadius: 1, background: 'none', cursor: 'pointer', p: 0 }}
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
                {hoverChoices(query.data.hoverFieldCatalogue).map(({ key, label, help }) => {
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
                      label={
                        <>
                          {label}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {help}
                          </Typography>
                        </>
                      }
                    />
                  );
                })}
              </Box>
              {errors.hoverFields !== undefined && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>{errors.hoverFields}</Typography>
              )}
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
      <BookingSlotsCard />
      <SingleWorkerCard />
    </SettingsScreen>
  );
}
