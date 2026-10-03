/* ══════════════════════════════════════════════════════════════
   BARVY SLUŽEB  (route: /nastaveni/barvy-sluzeb)

   One colour per služba, shades of it for its činnosti, the same everywhere:
   the calendar, its legend, the chips.

     1. Paleta        GET/PUT /api/v1/settings/service-colors  { palette }
                      at least six #RRGGBB colours; a new služba takes the next
                      one automatically (the server does it)
     2. Služby        the colour of each (ClinicService.colorHex) - the swatch
                      opens the palette and saves that služba at once
     3. Činnosti      drawn in shades of their služba (effectiveColorHex); a
                      činnost may have a colour of its own (colorHex) and
                      "Použít odstín služby" takes it back

   "Uložit" belongs to the palette. Colouring a služba or a činnost is saved the
   moment it is picked - there is nothing half-done to leave behind.
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { Alert, Box, Button, Popover, Skeleton, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { SERVICE_COLORS_QUERY_KEY, serviceColorsApi } from '../../api/serviceColors';
import { clinicServicesApi, type ClinicService } from '../../api/clinicServices';
import { activitiesApi, activityToInput } from '../../api/activities';
import type { Activity } from '../../api/bookingContracts';
import { useDevice } from '../../layout/useDevice';
import { DESIGN, SoftCard } from '../../components/ui';
import { TYPE, settingsLine } from '../../components/settings/settingsStyle';
import { SettingsAsideCard, SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import { PaletteEditor } from './colors/PaletteEditor';
import { PaletteChoice } from './colors/PaletteChoice';
import { ServiceColorList } from './colors/ServiceColorList';
import {
  drawnColor, hasPaletteErrors, normalizeHex, paletteSignature, toRows, validatePalette, type PaletteRow,
} from './colors/colorLogic';

const LIST_KEY = ['settings', 'service-colors', 'services'] as const;
const ACTIVITIES_KEY = ['settings', 'service-colors', 'activities'] as const;

type Target = { kind: 'service'; service: ClinicService } | { kind: 'activity'; activity: Activity };

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
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['settings', 'service-colors', 'services'] });
    void queryClient.invalidateQueries({ queryKey: ['settings', 'service-colors', 'activities'] });
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

  const palette = saved?.palette ?? [];
  const services = servicesQuery.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const target = popover?.target ?? null;

  const preview = rows === null ? null : (
    <LegendPreview palette={rows.map((r) => r.hex).filter((h) => h !== '')} services={services} activities={activities} />
  );

  const rowErrors = attempted ? errors : { rows: {}, general: null };

  return (
    <SettingsScreen
      title="Barvy služeb"
      subtitle="Každá služba má svou barvu, její činnosti jsou v odstínech téže barvy — stejně v kalendáři, legendách i štítcích."
      scope="service-colors"
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
              Klepnutím na barvu služby ji změníte. Činnosti mají odstín služby; klepnutím na činnost jí dáte vlastní barvu.
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

          <Popover
            open={popover !== null}
            anchorEl={popover?.anchor ?? null}
            onClose={() => setPopover(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            slotProps={{ paper: { sx: { p: 2, maxWidth: 'min(92vw, 360px)' } } }}
          >
            {target !== null && (
              <Stack spacing={1.5}>
                <Typography sx={TYPE.itemName}>
                  {target.kind === 'service' ? `Barva služby ${target.service.name}` : `Barva činnosti ${target.activity.name}`}
                </Typography>
                <PaletteChoice
                  palette={palette}
                  value={target.kind === 'service' ? target.service.colorHex : target.activity.colorHex ?? null}
                  onPick={(hex) => {
                    if (target.kind === 'service') colorService.mutate({ service: target.service, hex });
                    else colorActivity.mutate({ activity: target.activity, hex });
                    setPopover(null);
                  }}
                  onClear={target.kind === 'activity' ? () => { colorActivity.mutate({ activity: target.activity, hex: null }); setPopover(null); } : undefined}
                />
              </Stack>
            )}
          </Popover>
        </Stack>
      )}
    </SettingsScreen>
  );
}
