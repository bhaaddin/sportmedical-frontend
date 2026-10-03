/*
 * "Činnosti, které blok zablokuje" - the činnosti of the ticked calendars.
 *
 * Every calendar runs one service, and a service owns its činnosti. Ticking a
 * calendar therefore SHOWS that service's činnosti (grouped under the service
 * name, with its colour) and nothing else; the činnosti of services nobody
 * ticked stay hidden. Nothing is pre-selected - the operator picks each one,
 * because each gets its own seats.
 */
import { Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import type { BlockableActivity } from '../../../api/clubBlocks';

/** The key a calendar or činnost without a service shares. */
export const NO_SERVICE = '__none';
export const serviceKey = (id: string | null | undefined): string => (id === null || id === undefined || id === '' ? NO_SERVICE : id);

export interface PickerService {
  name: string;
  colorHex: string | null;
}

export interface ActivityGroup {
  key: string;
  name: string;
  color: string | null;
  items: BlockableActivity[];
}

/** The činnosti to show: those whose service a ticked calendar runs, grouped by service in the calendars' order. */
export function activityGroups(
  calendars: readonly { clinicServiceId: string | null; name: string; color: string }[],
  activities: readonly BlockableActivity[],
  services: ReadonlyMap<string, PickerService>,
): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const cal of calendars) {
    const key = serviceKey(cal.clinicServiceId);
    const existing = groups.find((g) => g.key === key);
    if (existing !== undefined) {
      /* No service name known: the group is named after the calendars that run it. */
      if (!services.has(key) && key !== NO_SERVICE && !existing.name.split(' · ').includes(cal.name)) existing.name += ` · ${cal.name}`;
      continue;
    }
    const known = services.get(key);
    groups.push({
      key,
      name: known?.name ?? (key === NO_SERVICE ? 'Ostatní činnosti' : cal.name),
      color: known?.colorHex ?? (key === NO_SERVICE ? null : cal.color),
      items: activities.filter((a) => serviceKey(a.clinicServiceId) === key),
    });
  }
  return groups;
}

export function ActivityPicker({
  groups, checked, onToggle, disabled, loading, error, hint,
}: {
  groups: ActivityGroup[];
  checked: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
  loading: boolean;
  error?: string;
  /** Shown instead of the list while no calendar is ticked. */
  hint: string | null;
}) {
  if (loading) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám…</Typography>;
  if (hint !== null) {
    return <Typography variant="body2" sx={{ color: error ? 'error.main' : 'text.secondary' }} data-testid="activities-hint">{error ?? hint}</Typography>;
  }
  return (
    <Box>
      <Box
        role="group"
        aria-label="Činnosti"
        sx={{ border: '1px solid', borderColor: error ? 'error.main' : 'divider', borderRadius: 2.5, maxHeight: 260, overflowY: 'auto', bgcolor: 'background.paper' }}
      >
        {groups.map((group) => (
          <Box key={group.key} data-testid="activity-group" data-service={group.key}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: 'center', px: 1.5, py: 0.75, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}
            >
              {group.color !== null ? (
                <Box component="span" aria-hidden="true" data-swatch={group.color} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: group.color, flexShrink: 0 }} />
              ) : null}
              <Typography component="span" sx={{ fontSize: 13, fontWeight: 700 }}>{group.name}</Typography>
            </Stack>
            {group.items.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', px: 1.5, py: 1 }}>Tato služba zatím nemá žádnou činnost.</Typography>
            ) : (
              group.items.map((a) => (
                <FormControlLabel
                  key={a.id}
                  disabled={disabled}
                  sx={{ display: 'flex', mx: 0, pr: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
                  control={<Checkbox checked={checked.includes(a.id)} onChange={() => onToggle(a.id)} />}
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                      <Box component="span" aria-hidden="true" data-swatch={a.colorHex} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: a.colorHex, flexShrink: 0 }} />
                      <Typography component="span" sx={{ fontSize: 14, fontWeight: 500 }}>{a.name}</Typography>
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{`${a.durationMinutes} min`}</Typography>
                    </Stack>
                  }
                />
              ))
            )}
          </Box>
        ))}
      </Box>
      {error ? <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{error}</Typography> : null}
    </Box>
  );
}
