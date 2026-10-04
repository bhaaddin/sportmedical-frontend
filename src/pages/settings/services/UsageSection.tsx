/*
 * Použití: how much this služba is in use right now. Read-only, from the
 * endpoints that already exist: the day range (appointments of the next
 * 60 days booked on its činnosti) and the club orders that name it.
 */
import { Box, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../../api/appointments';
import { clubOrdersApi, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import type { ClinicService } from '../../../api/clinicServices';
import { AsyncSection } from '../../../components/booking/AsyncSection';
import { SoftCard } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import { addDaysToDateOnly, pragueDateKey } from '../../../utils/time';
import { useServiceActivities } from './ActivitiesSection';

export const USAGE_DAYS = 60;
const CANCELLED = 4;
const OPEN_ORDER = ['Invited', 'Requested', 'Confirmed'] as const;

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <SoftCard tone="soft" sx={{ flex: 1, minWidth: 200 }}>
      <Typography sx={TYPE.label}>{label}</Typography>
      <Typography sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2 }} aria-label={`${label}: ${value}`}>{value}</Typography>
      <Typography sx={TYPE.caption}>{hint}</Typography>
    </SoftCard>
  );
}

export default function UsageSection({ service }: { service: ClinicService }) {
  const { query: activitiesQuery, mine } = useServiceActivities(service.id);
  const from = pragueDateKey(new Date());
  const to = addDaysToDateOnly(from, USAGE_DAYS - 1);

  const appointments = useQuery({
    queryKey: ['service-usage', 'appointments', from],
    queryFn: () => appointmentsApi.range(from, to),
    retry: false,
  });
  const orders = useQuery({
    queryKey: ['service-usage', 'club-orders'],
    queryFn: () => clubOrdersApi.list(),
    retry: false,
  });

  const ids = new Set(mine.map((a) => a.id));
  const upcoming = (appointments.data ?? []).filter((a) => ids.has(a.activityId) && a.status !== CANCELLED);
  const perActivity = mine
    .map((a) => ({ a, n: upcoming.filter((x) => x.activityId === a.id).length }))
    .filter((x) => x.n > 0);
  const myOrders = (orders.data ?? []).filter(
    (o) => o.serviceId === service.id && (OPEN_ORDER as readonly string[]).includes(o.status),
  );

  const loading = appointments.isLoading || orders.isLoading || activitiesQuery.isLoading;
  const failed = appointments.error ?? orders.error ?? activitiesQuery.error;

  return (
    <AsyncSection
      isLoading={loading}
      isSettled={!loading}
      error={failed}
      isEmpty={false}
      emptyText=""
      onRetry={() => { void appointments.refetch(); void orders.refetch(); void activitiesQuery.refetch(); }}
      skeletonRows={2}
    >
      <Stack spacing={2}>
        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Stat label="Nadcházející termíny" value={upcoming.length} hint={`příštích ${USAGE_DAYS} dní, bez zrušených`} />
          <Stat label="Otevřené objednávky klubů" value={myOrders.length} hint="pozvané, vyžádané a potvrzené" />
        </Stack>

        {perActivity.length > 0 && (
          <SoftCard>
            <Typography sx={{ ...TYPE.sectionTitle, mb: 1 }}>Termíny podle činnosti</Typography>
            <Stack spacing={0.5}>
              {perActivity.map(({ a, n }) => (
                <Stack key={a.id} direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography>{a.name}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{n}</Typography>
                </Stack>
              ))}
            </Stack>
          </SoftCard>
        )}

        {myOrders.length > 0 && (
          <SoftCard>
            <Typography sx={{ ...TYPE.sectionTitle, mb: 1 }}>Objednávky klubů</Typography>
            <Stack spacing={0.5}>
              {myOrders.map((o) => (
                <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography>{o.clubName}</Typography>
                  <Typography sx={TYPE.caption}>{ORDER_STATUS_LABEL[o.status]} · {o.totalSeats} míst</Typography>
                </Box>
              ))}
            </Stack>
          </SoftCard>
        )}

        <Typography sx={TYPE.caption}>
          Archivace služby termíny ani objednávky nemaže — jen se přestane nabízet pro nové.
        </Typography>
      </Stack>
    </AsyncSection>
  );
}
