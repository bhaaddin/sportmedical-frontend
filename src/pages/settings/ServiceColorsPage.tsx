/* ══════════════════════════════════════════════════════════════
   BARVY  (route: /nastaveni/barvy-sluzeb)

   Every colour of the calendar is the owner's to change here, the same everywhere
   it is drawn (the board, the mini calendar, month tile, lists, legends, chips):

     0. Plánovač      the tint of the planner stage (R15d) - follows the accent
                      until one is picked; kept in this browser (ThemePrefs)

     1. Paleta        GET/PUT /api/v1/settings/service-colors  { palette }
                      at least six #RRGGBB colours; a new služba takes the next
                      one automatically (the server does it)
     2. Služby        the colour of each (ClinicService.colorHex) - the swatch
                      opens the palette and saves that služba at once
     3. Činnosti      drawn in shades of their služba (effectiveColorHex); a
                      činnost may have a colour of its own (colorHex) and
                      "Použít výchozí barvu" takes it back

   "Uložit" belongs to the palette. Colouring a služba or a činnost is saved the
   moment it is picked - there is nothing half-done to leave behind.
   ══════════════════════════════════════════════════════════════ */

import { useContext, useMemo, useState } from 'react';
import { Alert, Box, Button, Popover, Skeleton, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SERVICE_COLORS_QUERY_KEY, serviceColorsApi } from '../../api/serviceColors';
import { clinicServicesApi, type ClinicService } from '../../api/clinicServices';
import { calendarsApi, calendarToInput } from '../../api/calendars';
import { activitiesApi, activityToInput } from '../../api/activities';
import type { Activity, Calendar } from '../../api/bookingContracts';
import { DEFAULT_ACCENT, ThemePrefsContext } from '../../themePrefs';
import { CALENDAR_DISPLAY_QUERY_KEY, readCalendarDisplay, saveCalendarDisplay } from '../../api/displaySettings';
import { usePermission } from '../../auth/usePermission';
import { PlannerTintEditor, TINT_TEXT } from './colors/PlannerTintEditor';
import { CalendarColorList, defaultCalendarColor } from './colors/CalendarColorList';
import { useDevice } from '../../layout/useDevice';
import { DESIGN, SoftCard } from '../../components/ui';
import { TYPE, settingsLine } from '../../components/settings/settingsStyle';
import { SettingsAsideCard, SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import { PaletteEditor } from './colors/PaletteEditor';
import { ActivityColorEditor } from './colors/ActivityColorEditor';
import { invalidateColorCaches } from '../../colors/invalidateColors';
import { activityColor } from '../../colors/activityColor';
import { ServiceColorList } from './colors/ServiceColorList';
import {
  drawnColor, hasPaletteErrors, normalizeHex, paletteSignature, toRows, validatePalette, type PaletteRow,
} from './colors/colorLogic';

const LIST_KEY = ['settings', 'service-colors', 'services'] as const;
const ACTIVITIES_KEY = ['settings', 'service-colors', 'activities'] as const;

const CALENDARS_KEY = ['settings', 'service-colors', 'calendars'] as const;

type Target =
  | { kind: 'service'; service: ClinicService }
  | { kind: 'activity'; activity: Activity }
  | { kind: 'calendar'; calendar: Calendar };

/** A služba's default colour: the palette colour at its position among the služby (wrapping). */
function defaultServiceColor(services: readonly ClinicService[], service: ClinicService, palette: readonly string[], fallback: string): string {
  const order = [...services].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'));
  const usable = palette.map((c) => normalizeHex(c)).filter((c) => c !== '');
  const index = Math.max(0, order.findIndex((s) => s.id === service.id));
  return usable.length === 0 ? fallback : usable[index % usable.length]!;
}

/** The calendar legend as it will look: each služba, its colour, its činnosti in their shades. */
function LegendPreview({ palette, services, activities }: { palette: string[]; services: ClinicService[]; activities: Activity[] }) {
  const fallback = DESIGN.faint;
  const active = services.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const swatch = (color: string, size = 14) => (
    <Box aria-hidden component="span" sx={{ width: size, height: size, borderRadius: size > 14 ? '5px' : '4px', flexShrink: 0, bgcolor: color, display: 'inline-block' }} />
  );
  return (
    <Stack spacing={2}>
      <Box>
        <Typography sx={TYPE.label}>Paleta</Typography>
        <Box aria-label="Náhled palety" role="img" sx={{ display: 'flex', mt: 0.75, borderRadius: 2, overflow: 'hidden', height: 28, border: '1px solid', borderColor: settingsLine }}>
          {palette.map((hex, i) => <Box key={`${hex}-${i}`} sx={{ flex: 1, bgcolor: normalizeHex(hex) }} />)}
        </Box>
      </Box>
      <Box>
        <Typography sx={TYPE.label}>Legenda kalendáře</Typography>
        {active.length === 0 ? (
          <Typography sx={[TYPE.caption, { mt: 0.75 }]}>Až budou služby, uvidíte je tady v barvách.</Typography>
        ) : (
          <Box component="ul" aria-label="Legenda služeb" sx={{ listStyle: 'none', m: 0, mt: 0.75, p: 0, display: 'grid', gap: 1 }}>
            {active.map((s) => (
              <Box component="li" key={s.id}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {swatch(s.colorHex ?? fallback, 18)}
                  <Typography sx={TYPE.itemName}>{s.name}</Typography>
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.5, pl: 3.5 }}>
                  {activities.filter((a) => a.clinicServiceId === s.id && a.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
                    <Stack key={a.id} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      {swatch(drawnColor(a, s.colorHex, fallback))}
                      <Typography sx={TYPE.caption}>{a.name}</Typography>
                    </Stack>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

export default function ServiceColorsPage() {
  const queryClient = useQueryClient();
  const device = useDevice();

  const paletteQuery = useQuery({ queryKey: SERVICE_COLORS_QUERY_KEY, queryFn: serviceColorsApi.get, retry: false });
  const servicesQuery = useQuery({ queryKey: LIST_KEY, queryFn: clinicServicesApi.list, retry: false });
  const activitiesQuery = useQuery({ queryKey: ACTIVITIES_KEY, queryFn: async () => (await activitiesApi.list()).activities, retry: false });
  const calendarsQuery = useQuery({ queryKey: CALENDARS_KEY, queryFn: calendarsApi.list, retry: false });
  /* outside the application's provider (a test, a lab) the page still draws: no tint of its own, the default accent */
  const prefs = useContext(ThemePrefsContext);
  const accent = prefs?.accent ?? DEFAULT_ACCENT;
  const plannerTint = prefs?.plannerTint ?? null;
  const setPlannerTint = prefs?.setPlannerTint;
  /*
   * The tint is the clinic's when the server keeps it (`plannerTintColor` present) and this person may change clinic settings:
   * a pick is saved for everybody and this browser's own tint is dropped. Otherwise it stays per browser, as before.
   */
  const mayManageClinic = usePermission('settings.clinic.manage');
  const displayQuery = useQuery({ queryKey: CALENDAR_DISPLAY_QUERY_KEY, queryFn: readCalendarDisplay, staleTime: 5 * 60 * 1000, retry: false });
  const clinicTintKept = displayQuery.data !== undefined && displayQuery.data.settings.plannerTintColor !== undefined;
  const clinicWide = mayManageClinic && clinicTintKept;
  const clinicTint = displayQuery.data?.settings.plannerTintColor ?? null;
  const editorTint = clinicWide ? clinicTint : plannerTint;
  const saveTint = useMutation({
    mutationFn: (hex: string | null) => saveCalendarDisplay({ ...displayQuery.data!.settings, plannerTintColor: hex ?? '' }),
    onSuccess: (next) => {
      queryClient.setQueryData(CALENDAR_DISPLAY_QUERY_KEY, next);
      setPlannerTint?.(null);
      toast.success(TINT_TEXT.savedClinic);
    },
    onError: (error) => toast.error(problemMessageOf(error, TINT_TEXT.saveFailed)),
  });
  const pickTint = (hex: string | null) => {
    if (clinicWide) saveTint.mutate(hex);
    else setPlannerTint?.(hex);
  };

  const saved = paletteQuery.data;
  const baseRows = useMemo<PaletteRow[] | null>(() => (saved === undefined ? null : toRows(saved.palette)), [saved]);
  const [edits, setEdits] = useState<PaletteRow[] | null>(null);
  const rows = edits ?? baseRows;
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [serverRowErrors, setServerRowErrors] = useState<string | null>(null);

  const dirty = baseRows !== null && edits !== null && paletteSignature(edits) !== paletteSignature(baseRows);
  const errors = rows === null ? { rows: {}, general: null } : validatePalette(rows);

  const savePalette = useMutation({
    mutationFn: (palette: string[]) => serviceColorsApi.put({ palette }),
    onSuccess: (next) => {
      queryClient.setQueryData(SERVICE_COLORS_QUERY_KEY, next);
      setEdits(null);
      setAttempted(false);
      setFailure(null);
      setServerRowErrors(null);
      toast.success('Paleta uložena');
    },
    onError: (error) => {
      const fields = Object.values(fieldErrorsOf(error));
      setServerRowErrors(fields.length > 0 ? fields.join(' ') : null);
      setFailure(problemMessageOf(error, 'Paletu se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const submit = () => {
    setAttempted(true);
    if (rows === null || hasPaletteErrors(errors)) return;
    savePalette.mutate(rows.map((r) => normalizeHex(r.hex)));
  };
  const discard = () => { setEdits(null); setAttempted(false); setFailure(null); setServerRowErrors(null); };

  /* ── Colouring a služba or a činnost: saved at once ── */
  const [popover, setPopover] = useState<{ anchor: HTMLElement; target: Target } | null>(null);
  /* A colour changed: every screen that draws a činnost or a služba refreshes (board, club windows, mini calendar, lists, legends). */
  const refresh = () => {
    void invalidateColorCaches(queryClient);
  };
  const colorService = useMutation({
    mutationFn: ({ service, hex }: { service: ClinicService; hex: string }) =>
      clinicServicesApi.update(service.id, { name: service.name, description: service.description, sortOrder: service.sortOrder, colorHex: hex }),
    onSuccess: refresh,
    onError: (error) => toast.error(problemMessageOf(error, 'Barvu služby se nepodařilo uložit.')),
  });
  const colorActivity = useMutation({
    mutationFn: ({ activity, hex }: { activity: Activity; hex: string | null }) =>
      activitiesApi.update(activity.id, activityToInput(activity, { colorHex: hex })),
    onSuccess: refresh,
    onError: (error) => toast.error(problemMessageOf(error, 'Barvu činnosti se nepodařilo uložit.')),
  });

  const colorCalendar = useMutation({
    mutationFn: ({ calendar, hex }: { calendar: Calendar; hex: string }) => calendarsApi.update(calendar.id, calendarToInput(calendar, { color: hex })),
    onSuccess: refresh,
    onError: (error) => toast.error(problemMessageOf(error, 'Barvu kalendáře se nepodařilo uložit.')),
  });

  const palette = saved?.palette ?? [];
  const calendars = calendarsQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const target = popover?.target ?? null;

  const preview = rows === null ? null : (
    <LegendPreview palette={rows.map((r) => r.hex).filter((h) => h !== '')} services={services} activities={activities} />
  );

  const rowErrors = attempted ? errors : { rows: {}, general: null };

  return (
    <SettingsScreen
      title="Barvy"
      subtitle="Barva plánovače, každé služby, činnosti i kalendáře — stejná v kalendáři, mini kalendáři, oknech klubů, legendách i štítcích. Nic není pevně dané: vše změníte, uvidíte náhled a můžete se vrátit k výchozí barvě."
      scope="calendar"
      save={{ dirty, saving: savePalette.isPending, onSave: submit, onDiscard: discard }}
      loading={rows === null && !paletteQuery.isError}
      error={paletteQuery.isError ? 'Paletu barev se nepodařilo načíst.' : undefined}
      onRetry={() => void paletteQuery.refetch()}
      aside={device === 'desktop' && preview !== null ? preview : undefined}
      asideTitle="Náhled legendy"
    >
      {rows === null ? null : (
        <Stack spacing={2.5}>
          {failure !== null && <Alert severity="error">{failure}{serverRowErrors !== null ? ` ${serverRowErrors}` : ''}</Alert>}

          <SoftCard component="section" aria-labelledby="barvy-planovac">
            <Typography id="barvy-planovac" component="h2" sx={TYPE.sectionTitle}>{TINT_TEXT.title}</Typography>
            <Box sx={{ mt: 1 }}>
              <PlannerTintEditor
                key={editorTint ?? 'follow'}
                value={editorTint ?? accent}
                followed={editorTint === null}
                palette={palette}
                onChange={pickTint}
              />
              <Typography data-testid="tint-scope" sx={[TYPE.caption, { mt: 1 }]}>
                {clinicWide ? TINT_TEXT.scopeClinic : clinicTintKept ? TINT_TEXT.scopeBrowserNoRight : TINT_TEXT.scopeBrowser}
              </Typography>
              {clinicWide && plannerTint !== null ? (
                <Alert severity="info" sx={{ mt: 1 }} data-testid="tint-browser-own"
                  action={<Button color="inherit" size="small" onClick={() => setPlannerTint?.(null)} sx={{ minHeight: 44 }}>{TINT_TEXT.useClinic}</Button>}>
                  {TINT_TEXT.browserOwn(plannerTint)}
                </Alert>
              ) : null}
            </Box>
          </SoftCard>

          <Box sx={{ display: 'grid', gap: 2.5, alignItems: 'start', gridTemplateColumns: device === 'tablet' ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
            <SoftCard component="section" aria-labelledby="barvy-paleta">
              <Typography id="barvy-paleta" component="h2" sx={TYPE.sectionTitle}>Paleta</Typography>
              <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2, maxWidth: 720 }]}>
                Z palety se barví nové služby — nová služba dostane barvu automaticky, později ji můžete změnit. Nejméně 6 barev.
              </Typography>
              <PaletteEditor rows={rows} errors={rowErrors} onChange={(next) => { setEdits(next); setFailure(null); }} />
            </SoftCard>
            {device !== 'desktop' && preview !== null && <SettingsAsideCard title="Náhled legendy">{preview}</SettingsAsideCard>}
          </Box>

          <SoftCard component="section" aria-labelledby="barvy-sluzby">
            <Typography id="barvy-sluzby" component="h2" sx={TYPE.sectionTitle}>Služby a činnosti</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2, maxWidth: 720 }]}>
              Klepnutím na barvu služby ji změníte. Každá činnost má svou výraznou výchozí barvu, která se nemění; klepnutím na činnost jí
              dáte vlastní barvu z palety nebo jakoukoli jinou, uvidíte náhled a můžete se vrátit k výchozí barvě.
            </Typography>
            {servicesQuery.isError || activitiesQuery.isError ? (
              <Alert severity="error" action={<Button color="inherit" size="small" sx={{ minHeight: 44 }} onClick={() => { void servicesQuery.refetch(); void activitiesQuery.refetch(); }}>Zkusit znovu</Button>}>
                Služby a činnosti se nepodařilo načíst.
              </Alert>
            ) : servicesQuery.isPending || activitiesQuery.isPending ? (
              <Box aria-busy="true" aria-label="Načítám služby"><Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} /></Box>
            ) : (
              <ServiceColorList
                services={services}
                activities={activities}
                fallback={DESIGN.faint}
                onService={(anchor, service) => setPopover({ anchor, target: { kind: 'service', service } })}
                onActivity={(anchor, activity) => setPopover({ anchor, target: { kind: 'activity', activity } })}
              />
            )}
          </SoftCard>

          <SoftCard component="section" aria-labelledby="barvy-kalendare">
            <Typography id="barvy-kalendare" component="h2" sx={TYPE.sectionTitle}>Kalendáře</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 2, maxWidth: 720 }]}>
              Barva záhlaví sloupce, štítku a pilulky kalendáře na tabuli. Klepnutím na barvu ji změníte; výchozí je barva z palety podle pořadí.
            </Typography>
            {calendarsQuery.isError ? (
              <Alert severity="error" action={<Button color="inherit" size="small" sx={{ minHeight: 44 }} onClick={() => void calendarsQuery.refetch()}>Zkusit znovu</Button>}>
                Kalendáře se nepodařilo načíst.
              </Alert>
            ) : calendarsQuery.isPending ? (
              <Box aria-busy="true" aria-label="Načítám kalendáře"><Skeleton variant="rounded" height={64} sx={{ borderRadius: 3 }} /></Box>
            ) : (
              <CalendarColorList
                calendars={calendars}
                palette={palette}
                fallback={DESIGN.faint}
                onPick={(anchor, calendar) => setPopover({ anchor, target: { kind: 'calendar', calendar } })}
              />
            )}
          </SoftCard>

          <Popover
            open={popover !== null}
            anchorEl={popover?.anchor ?? null}
            onClose={() => setPopover(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            slotProps={{ paper: { sx: { p: 2, maxWidth: 'min(92vw, 400px)' } } }}
          >
            {target !== null && target.kind === 'activity' && (
              <ActivityColorEditor
                key={target.activity.id}
                activityName={target.activity.name}
                palette={palette}
                value={target.activity.colorHex ?? null}
                fallback={activityColor({ id: target.activity.id }, services.find((s) => s.id === target.activity.clinicServiceId)?.colorHex ?? null)}
                busy={colorActivity.isPending}
                onChange={(hex) => { colorActivity.mutate({ activity: target.activity, hex }); setPopover(null); }}
              />
            )}
            {target !== null && target.kind === 'service' && (
              <ActivityColorEditor
                key={target.service.id}
                subject="služba"
                activityName={target.service.name}
                palette={palette}
                value={target.service.colorHex}
                fallback={defaultServiceColor(services, target.service, palette, DESIGN.faint)}
                resetHint="Vrátí barvu z palety podle pořadí služby"
                busy={colorService.isPending}
                onChange={(hex) => {
                  colorService.mutate({ service: target.service, hex: hex ?? defaultServiceColor(services, target.service, palette, DESIGN.faint) });
                  setPopover(null);
                }}
              />
            )}
            {target !== null && target.kind === 'calendar' && (
              <ActivityColorEditor
                key={target.calendar.id}
                subject="kalendář"
                activityName={target.calendar.name}
                palette={palette}
                value={target.calendar.color}
                fallback={defaultCalendarColor(calendars, target.calendar, palette, DESIGN.faint)}
                resetHint="Vrátí barvu z palety podle pořadí kalendáře"
                busy={colorCalendar.isPending}
                onChange={(hex) => {
                  colorCalendar.mutate({ calendar: target.calendar, hex: hex ?? defaultCalendarColor(calendars, target.calendar, palette, DESIGN.faint) });
                  setPopover(null);
                }}
              />
            )}
          </Popover>
        </Stack>
      )}
    </SettingsScreen>
  );
}
