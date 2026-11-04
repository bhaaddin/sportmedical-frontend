/* A red finding of an accepted clip can point at an injury of the same patient: the chip shows the link, the picker makes it. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { Healing } from '@mui/icons-material';
import { StatusChip } from '../../components/ui';
import { usePermission } from '../../auth/usePermission';
import { linkClipToInjury, listPatientInjuries, movementKeys, type ClipDetail, type Flag } from '../../api/movement';
import { formatDate, useMoveT } from '../i18n';
import { canLinkInjury } from '../lib/review';

export function InjuryLink({ clip, flag }: { clip: ClipDetail; flag: Flag }) {
  const { t } = useMoveT();
  const mayReview = usePermission('movement.review');
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const linked = clip.injuryIds ?? [];
  const eligible = canLinkInjury(flag.severity, clip.decisions);
  const injuries = useQuery({ queryKey: ['movement', 'injuries', clip.patientId], queryFn: () => listPatientInjuries(clip.patientId!), enabled: clip.patientId !== null && (anchor !== null || linked.length > 0) });
  const link = useMutation({
    mutationFn: (injuryId: string) => linkClipToInjury(clip.clipId, injuryId),
    onSuccess: () => { setAnchor(null); void qc.invalidateQueries({ queryKey: movementKeys.clip(clip.clipId) }); },
  });
  if (flag.severity !== 'red') return null;
  const name = (id: string) => { const i = injuries.data?.find((x) => x.id === id); return i ? `${i.bodyRegion ?? t('review.injury')}${i.injuryDate ? ` · ${formatDate(i.injuryDate)}` : ''}` : t('review.injury'); };

  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }} data-testid="injury-link">
      {linked.map((id) => <StatusChip key={id} tone="blue" size="sm" testId="injury-chip">{t('review.injury')}: {name(id)}</StatusChip>)}
      {mayReview && (
        <>
          <Button size="small" startIcon={<Healing />} disabled={!eligible} title={eligible ? undefined : t('review.injury.needs_decision')} onClick={(e) => setAnchor(e.currentTarget)} sx={{ minHeight: 44, textTransform: 'none' }}>
            {t('review.injury.link')}
          </Button>
          <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
            <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>{t('review.injury.pick')}</Typography>
            {(injuries.data ?? []).length === 0 && <MenuItem disabled>{t('review.injury.none')}</MenuItem>}
            {(injuries.data ?? []).map((i) => (
              <MenuItem key={i.id} disabled={linked.includes(i.id) || link.isPending} onClick={() => link.mutate(i.id)} sx={{ minHeight: 44 }}>
                <Box>{i.bodyRegion}{i.specificLocation ? `, ${i.specificLocation}` : ''}{i.injuryDate ? ` · ${formatDate(i.injuryDate)}` : ''}</Box>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {link.isError && <Alert severity="warning" role="alert" sx={{ width: '100%' }}>{t('review.injury.failed')}</Alert>}
    </Stack>
  );
}
