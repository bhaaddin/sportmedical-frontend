/* ══════════════════════════════════════════════════════════════
   VZHLED KALENDÁŘE  (route: /nastaveni/vzhled-kalendare)

   How the booking calendar is drawn for everybody at the clinic: which view
   it opens on, how long one row is, which hours a day shows, the colour of
   the "now" line, what the card on a booked block shows, and the clinic-wide
   lunch. They were constants in CalendarGridPage; the owner's rule is that
   they are his to change.

   The choices offered (views, row lengths, the hover facts) come from the
   server, which also refuses anything it cannot draw — this screen keeps no
   copy of the rules.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CALENDAR_DISPLAY_QUERY_KEY,
  readCalendarDisplay,
  saveCalendarDisplay,
} from '../../api/displaySettings';
import type {
  CalendarDisplaySettings,
  CalendarView,
  HoverFieldCatalogueEntry,
} from '../../api/displaySettings';
import { moveKey } from './patientFieldOrder';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Den',
  week: 'Týden',
  month: 'Měsíc',
};

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

/** `4 řádky na hodinu`, in the right Czech plural. */
function rowsPerHourLabel(slotMinutes: number): string {
  const rows = 60 / slotMinutes;
  const word = rows === 1 ? 'řádek' : rows < 5 ? 'řádky' : 'řádků';
  return `${rows} ${word} na hodinu`;
}

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

  const { views, slotLengths, defaults, hoverFieldCatalogue } = query.data;
  const draft = edited ?? query.data.settings;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const set = <K extends keyof CalendarDisplaySettings>(key: K, value: CalendarDisplaySettings[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };

  const lunchOn = draft.lunchFrom !== '' || draft.lunchTo !== '';
  const byKey = new Map(hoverFieldCatalogue.map((entry) => [entry.key, entry]));
  const shownHover = draft.hoverFields
    .map((key) => byKey.get(key))
    .filter((entry): entry is HoverFieldCatalogueEntry => entry !== undefined);
  const hiddenHover = hoverFieldCatalogue.filter((entry) => !draft.hoverFields.includes(entry.key));

  const sensitiveTag = (entry: HoverFieldCatalogueEntry) =>
    entry.sensitive ? (
      <Typography component="span" sx={{ ml: 1, fontSize: 12, color: 'warning.dark' }}>
        citlivý údaj
      </Typography>
    ) : null;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Vzhled kalendáře</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Jak se kalendář rezervací kreslí všem v ordinaci. Den se vždy roztáhne tak, aby byla vidět
          pracovní doba i každá rezervace mimo nastavené hodiny.
        </Typography>
      </Box>

      <Stack spacing={3} sx={{ maxWidth: 760 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Mřížka</Typography>
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
                helperText={
                  errors.slotMinutes ??
                  'Na kolik řádků se hodina rozdělí: 15 minut = čtyři řádky na hodinu. Kratší řádek = podrobnější, ale delší mřížka.'
                }
              >
                {slotLengths.map((minutes) => (
                  <MenuItem key={minutes} value={minutes}>
                    {minutes} minut ({rowsPerHourLabel(minutes)})
                  </MenuItem>
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
                  helperText={errors.dayStartHour ?? 'První hodina, kterou mřížka ukáže.'}
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
                  helperText={errors.dayEndHour ?? 'Hodina, kterou mřížka končí.'}
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
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Obědová pauza</Typography>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              Přestávka celé ordinace. Platí pro každý pracovní den, který nemá v Pracovní době
              vlastní přestávku; v kalendáři se kreslí červeně a objednat se do ní nedá.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={lunchOn}
                  onChange={(event) => {
                    setSaved(false);
                    setDraft(
                      event.target.checked
                        ? { ...draft, lunchFrom: defaults.lunchFrom || '12:00', lunchTo: defaults.lunchTo || '12:30' }
                        : { ...draft, lunchFrom: '', lunchTo: '' },
                    );
                  }}
                />
              }
              label="Ordinace má společnou obědovou pauzu"
            />
            <Stack direction="row" spacing={2} sx={{ mt: 1.5, alignItems: 'flex-start' }}>
              <TextField
                type="time"
                label="Od"
                value={draft.lunchFrom}
                disabled={!lunchOn}
                onChange={(event) => set('lunchFrom', event.target.value)}
                error={errors.lunch !== undefined}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 140 }}
              />
              <TextField
                type="time"
                label="Do"
                value={draft.lunchTo}
                disabled={!lunchOn}
                onChange={(event) => set('lunchTo', event.target.value)}
                error={errors.lunch !== undefined}
                helperText={
                  errors.lunch ??
                  (lunchOn
                    ? 'Vlastní přestávka v řádku Pracovní doby má přednost.'
                    : 'Bez společné pauzy platí jen přestávky zapsané u jednotlivých dnů.')
                }
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 320 }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">Karta po najetí na termín</Typography>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              Co se ukáže, když se v kalendáři podrží myš na objednaném termínu — v tomto pořadí.
              Pojišťovnu a datum narození uvidí jen účet s oprávněním k citlivým údajům, i když jsou
              zde zapnuté.
            </Typography>
            {errors.hoverFields ? <Alert severity="error" sx={{ mb: 2 }}>{errors.hoverFields}</Alert> : null}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Zobrazené ({shownHover.length})</Typography>
            {shownHover.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 1 }}>
                Nic — karta ukáže jen čas a činnost, jako blok sám.
              </Typography>
            ) : null}
            <Stack divider={<Divider flexItem />}>
              {shownHover.map((entry, index) => (
                <Stack key={entry.key} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                  <Typography sx={{ width: 28, color: 'text.secondary' }}>{index + 1}.</Typography>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {entry.label}
                      {sensitiveTag(entry)}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{entry.help}</Typography>
                  </Box>
                  <Tooltip title="Výš">
                    <span>
                      <IconButton
                        aria-label={`Posunout ${entry.label} výš`}
                        size="small"
                        disabled={index === 0}
                        onClick={() => set('hoverFields', moveKey(draft.hoverFields, entry.key, -1))}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Níž">
                    <span>
                      <IconButton
                        aria-label={`Posunout ${entry.label} níž`}
                        size="small"
                        disabled={index === shownHover.length - 1}
                        onClick={() => set('hoverFields', moveKey(draft.hoverFields, entry.key, 1))}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Checkbox
                    checked
                    slotProps={{ input: { 'aria-label': `Zobrazit ${entry.label}` } }}
                    onChange={() => set('hoverFields', draft.hoverFields.filter((key) => key !== entry.key))}
                  />
                </Stack>
              ))}
            </Stack>

            {hiddenHover.length > 0 ? (
              <>
                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Skryté ({hiddenHover.length})</Typography>
                <Stack divider={<Divider flexItem />}>
                  {hiddenHover.map((entry) => (
                    <Stack key={entry.key} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography sx={{ color: 'text.secondary' }}>
                          {entry.label}
                          {sensitiveTag(entry)}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{entry.help}</Typography>
                      </Box>
                      <Checkbox
                        checked={false}
                        slotProps={{ input: { 'aria-label': `Zobrazit ${entry.label}` } }}
                        onChange={() => set('hoverFields', [...draft.hoverFields, entry.key])}
                      />
                    </Stack>
                  ))}
                </Stack>
              </>
            ) : null}
          </CardContent>
        </Card>

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
    </Box>
  );
}
