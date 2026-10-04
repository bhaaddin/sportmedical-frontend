/*
 * Činnosti of one služba: every value editable in place, nothing hard-coded.
 *
 * One card per činnost on every width (a table cannot hold ten controls on a
 * tablet); the controls wrap into a grid that is one column on a phone and
 * wider as the screen grows. Each change is one `PUT` of the whole činnost
 * (`activityToInput`), so what is not shown travels back untouched.
 * A činnost is archived, never deleted.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { activitiesApi, activityToInput } from '../../../api/activities';
import { servicesApi } from '../../../api/services';
import type { ServiceItem } from '../../../api/services';
import { documentsApi } from '../../../api/documents';
import { serviceColorsApi, SERVICE_COLORS_QUERY_KEY } from '../../../api/serviceColors';
import type { Activity, ActivityInput } from '../../../api/bookingContracts';
import type { ClinicService } from '../../../api/clinicServices';
import { usePermission } from '../../../auth/usePermission';
import { AsyncSection } from '../../../components/booking/AsyncSection';
import { errorText } from '../../../components/booking/errorText';
import { SoftCard } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import ActivityExtrasDialog from '../../cenik/ActivityExtrasDialog';
import { useDevice } from '../../../layout/useDevice';
import { kc } from './format';

export const ACTIVITIES_KEY = ['activities'] as const;
export const PRICE_ITEMS_KEY = ['services'] as const;
const STALE = 5 * 60 * 1000;

export const QUESTIONNAIRE_LABEL: Record<Activity['questionnaireRequirement'], string> = {
  NotAsked: 'Neptáme se',
  Optional: 'Nepovinný',
  Required: 'Povinný',
};

/** One činnost, one change. Shared by the činnosti and the rules sections. */
export function useActivityPatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activity, patch }: { activity: Activity; patch: Partial<ActivityInput> }) =>
      activitiesApi.update(activity.id, activityToInput(activity, patch)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACTIVITIES_KEY }),
        queryClient.invalidateQueries({ queryKey: ['cenik', 'activities'] }),
        queryClient.invalidateQueries({ queryKey: ['clinic-services'] }),
      ]);
    },
  });
}

export function useServiceActivities(serviceId: string) {
  const query = useQuery({ queryKey: ACTIVITIES_KEY, queryFn: activitiesApi.list, staleTime: STALE });
  const all = query.data?.activities ?? [];
  const mine = all.filter((a) => a.clinicServiceId === serviceId).sort((a, b) => a.sortOrder - b.sortOrder);
  return { query, all, mine };
}

export function usePriceItems() {
  return useQuery({ queryKey: PRICE_ITEMS_KEY, queryFn: servicesApi.getAll, staleTime: STALE });
}

/** A whole-number field that saves when it loses focus, and only when it is a valid, changed value. */
function NumberField({
  label, value, min, suffix, disabled, onCommit,
}: {
  label: string; value: number; min: number; suffix?: string; disabled?: boolean; onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setText(String(value)); }
  const parsed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
  const invalid = parsed === null || parsed < min;
  const commit = () => {
    if (invalid) { setText(String(value)); return; }
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <TextField
      size="small"
      label={label}
      value={text}
      disabled={disabled}
      error={invalid}
      helperText={invalid ? `Celé číslo od ${min}` : suffix}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      fullWidth
    />
  );
}

function ActivityCard({
  activity, index, count, priceItems, saving, canEdit, onPatch, onMove, onExtras, onArchive, onRestore, onDetail,
}: {
  activity: Activity;
  index: number;
  count: number;
  priceItems: readonly ServiceItem[];
  saving: boolean;
  canEdit: boolean;
  onPatch: (patch: Partial<ActivityInput>) => void;
  onMove: (delta: -1 | 1) => void;
  onExtras: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDetail: () => void;
}) {
  const device = useDevice();
  const price = priceItems.find((p) => p.id === activity.serviceItemId) ?? null;
  const colour = activity.effectiveColorHex ?? activity.colorHex ?? activity.color;
  const disabled = saving || !canEdit || !activity.isActive;
  const columns = device === 'phone' ? '1fr' : device === 'tablet' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';

  return (
    <SoftCard sx={{ opacity: activity.isActive ? 1 : 0.8 }} data-testid={`activity-${activity.id}`}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: colour, flexShrink: 0 }} />
        <Typography sx={{ ...TYPE.sectionTitle, flex: 1, minWidth: 140 }}>{activity.name}</Typography>
        {!activity.isActive && <Chip size="small" variant="outlined" label="Archivovaná" />}
        {activity.isActive && (
          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Posunout výš">
              <span>
                <IconButton aria-label={`Posunout činnost ${activity.name} výš`} disabled={!canEdit || saving || index === 0} onClick={() => onMove(-1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Posunout níž">
              <span>
                <IconButton aria-label={`Posunout činnost ${activity.name} níž`} disabled={!canEdit || saving || index === count - 1} onClick={() => onMove(1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: 2, alignItems: 'start' }}>
        <NumberField
          label="Délka"
          suffix="minut"
          min={1}
          value={activity.durationMinutes}
          disabled={disabled}
          onCommit={(v) => onPatch({ durationMinutes: v })}
        />
        <NumberField
          label="Souběžná kapacita"
          suffix="naráz"
          min={1}
          value={activity.parallelCapacity ?? 1}
          disabled={disabled}
          onCommit={(v) => onPatch({ parallelCapacity: v })}
        />
        <TextField
          select
          size="small"
          label="Cena z ceníku"
          value={activity.serviceItemId ?? ''}
          disabled={disabled}
          onChange={(e) => onPatch({ serviceItemId: e.target.value === '' ? null : e.target.value })}
          helperText={
            price === null ? 'Bez ceny' : (
              <>
                {price.listPriceCzk != null && <s>{kc(price.listPriceCzk)} </s>}
                {kc(price.priceCzk)}
              </>
            )
          }
          fullWidth
        >
          <MenuItem value="">Bez ceny</MenuItem>
          {priceItems.filter((p) => p.isActive || p.id === activity.serviceItemId).map((p) => (
            <MenuItem key={p.id} value={p.id}>{p.name} — {kc(p.priceCzk)}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Dotazník"
          value={activity.questionnaireRequirement}
          disabled={disabled}
          onChange={(e) => onPatch({ questionnaireRequirement: e.target.value as Activity['questionnaireRequirement'] })}
          fullWidth
        >
          {(Object.keys(QUESTIONNAIRE_LABEL) as Activity['questionnaireRequirement'][]).map((k) => (
            <MenuItem key={k} value={k}>{QUESTIONNAIRE_LABEL[k]}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center', columnGap: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={activity.isPubliclyBookable}
              disabled={disabled}
              onChange={(e) => onPatch({ isPubliclyBookable: e.target.checked })}
            />
          }
          label="Objednat může i pacient na webu"
        />
        <FormControlLabel
          control={
            <Switch
              checked={activity.isActive}
              disabled={saving || !canEdit}
              onChange={(e) => (e.target.checked ? onRestore() : onArchive())}
            />
          }
          label="Aktivní"
        />
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<TuneIcon />} onClick={onExtras} disabled={!canEdit} sx={{ minHeight: 40 }}>
          Barva a dokumenty
        </Button>
        <Button size="small" onClick={onDetail} disabled={!canEdit} sx={{ minHeight: 40 }}>
          Celý formulář
        </Button>
        {activity.isActive ? (
          <Button
            size="small"
            startIcon={<ArchiveOutlinedIcon />}
            aria-label={`Archivovat činnost ${activity.name}`}
            disabled={!canEdit || saving}
            onClick={onArchive}
            sx={{ minHeight: 40 }}
          >
            Archivovat
          </Button>
        ) : (
          <Button
            size="small"
            startIcon={<UnarchiveOutlinedIcon />}
            aria-label={`Obnovit činnost ${activity.name}`}
            disabled={!canEdit || saving}
            onClick={onRestore}
            sx={{ minHeight: 40 }}
          >
            Obnovit
          </Button>
        )}
      </Stack>
    </SoftCard>
  );
}

export default function ActivitiesSection({ service }: { service: ClinicService }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = usePermission('settings.clinic.manage');
  const { query, mine } = useServiceActivities(service.id);
  const priceQuery = usePriceItems();
  const patch = useActivityPatch();
  const [showArchived, setShowArchived] = useState(false);
  const [extras, setExtras] = useState<Activity | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['cenik', 'document-templates'],
    queryFn: () => documentsApi.getTemplates(),
    retry: false,
    enabled: canEdit && extras !== null,
  });
  const paletteQuery = useQuery({
    queryKey: SERVICE_COLORS_QUERY_KEY, queryFn: serviceColorsApi.get, retry: false, enabled: canEdit && extras !== null,
  });

  const active = mine.filter((a) => a.isActive);
  const archived = mine.filter((a) => !a.isActive);
  const priceItems = priceQuery.data ?? [];

  const archive = useMutation({
    mutationFn: (a: Activity) => activitiesApi.remove(a.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVITIES_KEY }),
  });
  const restore = useMutation({
    mutationFn: (a: Activity) => activitiesApi.restore(a.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVITIES_KEY }),
  });

  /* Reordering swaps the two sort orders; equal orders are pulled apart first so the swap does something. */
  const move = (a: Activity, delta: -1 | 1) => {
    const i = active.findIndex((x) => x.id === a.id);
    const other = active[i + delta];
    if (other === undefined) return;
    const aOrder = a.sortOrder === other.sortOrder ? other.sortOrder + delta : other.sortOrder;
    patch.mutate({ activity: a, patch: { sortOrder: aOrder } });
    patch.mutate({ activity: other, patch: { sortOrder: a.sortOrder } });
  };

  const busy = patch.isPending || archive.isPending || restore.isPending;
  const failure = patch.error ?? archive.error ?? restore.error;

  const addActivity = () => navigate('/activities', { state: { clinicServiceId: service.id } });

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ ...TYPE.caption, flex: 1, minWidth: 200 }}>
          Každá činnost patří pod jednu službu. Změna se uloží hned po opuštění pole.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addActivity} disabled={!canEdit} sx={{ minHeight: 44 }}>
          Přidat činnost
        </Button>
      </Stack>

      {failure !== null && failure !== undefined && <Alert severity="error">{errorText(failure, t)}</Alert>}

      <AsyncSection
        isLoading={query.isLoading}
        isSettled={query.isSuccess || query.isError}
        error={query.error}
        isEmpty={mine.length === 0}
        emptyText="Tahle služba zatím nemá žádnou činnost. Bez činnosti se nedá nic objednat — přidejte první."
        onRetry={() => void query.refetch()}
        skeletonRows={2}
      >
        <Stack spacing={2}>
          {priceQuery.isError && (
            <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => void priceQuery.refetch()}>Zkusit znovu</Button>}>
              Ceník se nepodařilo načíst, ceny činností teď nevidíte.
            </Alert>
          )}
          {active.map((a, i) => (
            <ActivityCard
              key={a.id}
              activity={a}
              index={i}
              count={active.length}
              priceItems={priceItems}
              saving={busy}
              canEdit={canEdit}
              onPatch={(p) => patch.mutate({ activity: a, patch: p })}
              onMove={(d) => move(a, d)}
              onExtras={() => setExtras(a)}
              onArchive={() => archive.mutate(a)}
              onRestore={() => restore.mutate(a)}
              onDetail={() => navigate('/activities')}
            />
          ))}
          {archived.length > 0 && (
            <Box>
              <Button
                color="inherit"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                sx={{ color: 'text.secondary', fontWeight: 600, minHeight: 44 }}
              >
                {`Archivované činnosti (${archived.length})`}
              </Button>
              {showArchived && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {archived.map((a, i) => (
                    <ActivityCard
                      key={a.id}
                      activity={a}
                      index={i}
                      count={archived.length}
                      priceItems={priceItems}
                      saving={busy}
                      canEdit={canEdit}
                      onPatch={() => undefined}
                      onMove={() => undefined}
                      onExtras={() => undefined}
                      onArchive={() => archive.mutate(a)}
                      onRestore={() => restore.mutate(a)}
                      onDetail={() => undefined}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </AsyncSection>

      {extras !== null && (
        <ActivityExtrasDialog
          activity={extras}
          serviceColor={service.colorHex}
          templates={(templatesQuery.data ?? []).filter((x) => x.isActive)}
          templatesFailed={templatesQuery.isError}
          palette={paletteQuery.data?.palette ?? []}
          onClose={() => setExtras(null)}
          onSaved={() => { void queryClient.invalidateQueries({ queryKey: ACTIVITIES_KEY }); setExtras(null); }}
        />
      )}
    </Stack>
  );
}
