/*
 * Ceník of one služba: the price-list lines its činnosti are billed by.
 * The list price is shown crossed out next to the price; a line's package
 * membership comes from the discount settings. Editing opens the same
 * dialog as the price-list screen - there is one form for a price line.
 */
import { useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { discountSettingsApi } from '../../../api/discounts';
import type { ServiceItem } from '../../../api/services';
import type { ClinicService } from '../../../api/clinicServices';
import { usePermission } from '../../../auth/usePermission';
import { AsyncSection } from '../../../components/booking/AsyncSection';
import { SoftCard } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import ServiceDialog from '../../pricing/ServiceDialog';
import { PRICE_ITEMS_KEY, usePriceItems, useServiceActivities } from './ActivitiesSection';
import { kc } from './format';

export default function PriceSection({ service }: { service: ClinicService }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = usePermission('settings.clinic.manage');
  const { query: activitiesQuery, mine } = useServiceActivities(service.id);
  const priceQuery = usePriceItems();
  const packages = useQuery({ queryKey: ['settings', 'discounts'], queryFn: discountSettingsApi.get, retry: false });
  const [editing, setEditing] = useState<ServiceItem | null>(null);

  const items = priceQuery.data ?? [];
  const lines = items
    .map((item) => ({ item, activities: mine.filter((a) => a.serviceItemId === item.id) }))
    .filter((l) => l.activities.length > 0);
  const unpriced = mine.filter((a) => a.isActive && a.serviceItemId === null);
  const packagePercent = (activityId: string): number | null =>
    packages.data?.packageDiscounts.find((p) => p.activityId === activityId)?.percent ?? null;

  const loading = priceQuery.isLoading || activitiesQuery.isLoading;
  const failed = priceQuery.error ?? activitiesQuery.error;

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ ...TYPE.caption, flex: 1, minWidth: 200 }}>
          Ceny žijí jen v ceníku. Tady vidíte položky, podle kterých se činnosti této služby účtují.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/nastaveni/cenik')} sx={{ minHeight: 44 }}>
          Celý ceník
        </Button>
      </Stack>

      <AsyncSection
        isLoading={loading}
        isSettled={!loading}
        error={failed}
        isEmpty={lines.length === 0 && unpriced.length === 0}
        emptyText="Činnosti této služby zatím nemají žádnou cenu z ceníku."
        onRetry={() => { void priceQuery.refetch(); void activitiesQuery.refetch(); }}
        skeletonRows={2}
      >
        <Stack spacing={2}>
          {unpriced.length > 0 && (
            <Alert severity="warning">
              Bez ceny: {unpriced.map((a) => a.name).join(', ')}. Cenu přiřadíte u činnosti v záložce Činnosti.
            </Alert>
          )}
          {lines.map(({ item, activities }) => (
            <SoftCard key={item.id} data-testid={`price-${item.id}`}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={TYPE.sectionTitle}>{item.name}</Typography>
                    {item.code !== '' && <Chip size="small" variant="outlined" label={item.code} />}
                    {!item.isActive && <Chip size="small" label="Vyřazená" />}
                  </Stack>
                  <Typography sx={TYPE.caption}>{item.durationMinutes} minut</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  {item.listPriceCzk != null && (
                    <Typography sx={{ ...TYPE.caption, textDecoration: 'line-through' }}>{kc(item.listPriceCzk)}</Typography>
                  )}
                  <Typography sx={{ ...TYPE.sectionTitle }}>{kc(item.priceCzk)}</Typography>
                </Box>
                <Button
                  startIcon={<EditIcon />}
                  disabled={!canEdit}
                  aria-label={`Upravit cenu ${item.name}`}
                  onClick={() => setEditing(item)}
                  sx={{ minHeight: 44 }}
                >
                  Upravit
                </Button>
              </Stack>
              <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                {activities.map((a) => {
                  const percent = packagePercent(a.id);
                  return (
                    <Stack key={a.id} direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 14 }}>Účtuje se u činnosti {a.name}</Typography>
                      {percent !== null && <Chip size="small" color="primary" variant="outlined" label={`Balíček −${percent} %`} />}
                      {!a.isActive && <Chip size="small" variant="outlined" label="archivovaná" />}
                    </Stack>
                  );
                })}
              </Stack>
            </SoftCard>
          ))}
        </Stack>
      </AsyncSection>

      {editing !== null && (
        <ServiceDialog
          open
          service={editing}
          existing={items}
          onClose={() => setEditing(null)}
          onSaved={() => { void queryClient.invalidateQueries({ queryKey: PRICE_ITEMS_KEY }); setEditing(null); }}
        />
      )}
    </Stack>
  );
}
