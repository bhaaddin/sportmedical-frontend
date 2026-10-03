/*
 * One činnost under its price-list row: the colour it is drawn in, its name, how
 * long it takes, how many it serves at once and how many documents it asks for -
 * and "Upravit činnost" for whoever may change the clinic's settings.
 */
import { Box, Button, Stack, Typography } from '@mui/material';
import type { Activity } from '../../api/bookingContracts';
import { StatusChip } from '../../components/ui';
import { TYPE } from '../../components/settings/settingsStyle';

const NBSP = ' ';

export function documentsText(count: number): string {
  if (count === 0) return 'bez dokumentů';
  return `${count}${NBSP}${count === 1 ? 'dokument' : count >= 2 && count <= 4 ? 'dokumenty' : 'dokumentů'}`;
}

export default function ActivityLine({
  activity, color, onEdit,
}: {
  activity: Activity;
  /** The colour the činnost is drawn in - its own, or the shade of its služba. */
  color: string | null;
  /** Given only to somebody who may change it. */
  onEdit?: () => void;
}) {
  const capacity = activity.parallelCapacity ?? 1;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5, minHeight: 44 }}>
      <Box
        role="img"
        aria-label={color === null ? `Činnost ${activity.name} nemá barvu` : `Barva činnosti ${activity.name}: ${color}`}
        sx={{ width: 14, height: 14, borderRadius: '4px', flexShrink: 0, bgcolor: color ?? 'transparent', border: color === null ? '1px dashed' : 'none', borderColor: 'text.disabled' }}
      />
      <Box sx={{ minWidth: 0, flex: '1 1 160px' }}>
        <Typography sx={[TYPE.itemName, { fontSize: 14 }]}>{activity.name}</Typography>
        <Typography sx={TYPE.caption}>{activity.durationMinutes}{NBSP}min</Typography>
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        <StatusChip size="sm">Souběžně{NBSP}{capacity}×</StatusChip>
        <StatusChip size="sm" tone={activity.requiredDocumentTemplateIds.length > 0 ? 'beige' : 'grey'}>
          {documentsText(activity.requiredDocumentTemplateIds.length)}
        </StatusChip>
      </Stack>
      {onEdit !== undefined && (
        <Button size="small" variant="text" aria-label={`Upravit činnost ${activity.name}`} onClick={onEdit} sx={{ minHeight: 44, minWidth: 44 }}>
          Upravit činnost
        </Button>
      )}
    </Stack>
  );
}
