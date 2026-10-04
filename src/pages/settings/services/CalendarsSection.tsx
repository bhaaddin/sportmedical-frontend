/*
 * Kalendáře of one služba: which calendars run it and on which weekdays they
 * work. Working days are read from the calendar's current schedule period;
 * they are changed on the working-hours screen, which this section links to.
 */
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { calendarsApi } from '../../../api/calendars';
import { workingHoursApi } from '../../../api/workingHours';
import type { Calendar } from '../../../api/bookingContracts';
import type { ClinicService } from '../../../api/clinicServices';
import { AsyncSection } from '../../../components/booking/AsyncSection';
import { SoftCard } from '../../../components/ui';
import { TYPE } from '../../../components/settings/settingsStyle';
import { pragueDateKey } from '../../../utils/time';
import { DAY_NAMES, DAY_ORDER } from './format';

/** The weekdays a calendar works in its period valid today (or, failing that, its latest one). */
function WorkingDays({ calendarId }: { calendarId: string }) {
  const days = useQuery({
    queryKey: ['calendar-working-days', calendarId],
    retry: false,
    queryFn: async () => {
      const periods = await workingHoursApi.listPeriods(calendarId);
      const today = pragueDateKey(new Date());
      const current = periods.find((p) => p.validFrom <= today && (p.validTo === null || p.validTo >= today))
        ?? [...periods].sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
      if (current === undefined) return null;
      const hours = await workingHoursApi.listWorkingHours(calendarId, current.id);
      return new Set(hours.filter((h) => h.isActive).map((h) => h.dayOfWeek));
    },
  });

  if (days.isLoading) return <Typography sx={TYPE.caption}>Načítám pracovní dny…</Typography>;
  if (days.isError) return <Typography sx={TYPE.caption}>Pracovní dny se nepodařilo načíst.</Typography>;
  if (days.data === null || days.data === undefined || days.data.size === 0) {
    return <Typography sx={TYPE.caption}>Pracovní doba není nastavená.</Typography>;
  }
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }} aria-label="Pracovní dny">
      {DAY_ORDER.map((d) => (
        <Chip
          key={d}
          size="small"
          label={DAY_NAMES[d]}
          color={days.data?.has(d) ? 'primary' : 'default'}
          variant={days.data?.has(d) ? 'filled' : 'outlined'}
        />
      ))}
    </Stack>
  );
}

export default function CalendarsSection({ service }: { service: ClinicService }) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const mine: Calendar[] = (query.data ?? [])
    .filter((c) => c.clinicServiceId === service.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ ...TYPE.caption, flex: 1, minWidth: 200 }}>
          Kalendář provozuje jednu službu. Přiřazení změníte tlačítkem Upravit u služby v seznamu.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/working-hours')} sx={{ minHeight: 44 }}>Pracovní doba</Button>
        <Button variant="outlined" onClick={() => navigate('/calendars')} sx={{ minHeight: 44 }}>Všechny kalendáře</Button>
      </Stack>

      <AsyncSection
        isLoading={query.isLoading}
        isSettled={query.isSuccess || query.isError}
        error={query.error}
        isEmpty={mine.length === 0}
        emptyText="Tuhle službu zatím neprovozuje žádný kalendář, takže ji nejde objednat. Přiřaďte kalendář v úpravě služby."
        onRetry={() => void query.refetch()}
        skeletonRows={2}
      >
        <Stack spacing={2}>
          {mine.some((c) => !c.isActive) && (
            <Alert severity="info">Neaktivní kalendář službu nenabízí.</Alert>
          )}
          {mine.map((c) => (
            <SoftCard key={c.id} data-testid={`calendar-${c.id}`}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color }} />
                <Typography sx={TYPE.sectionTitle}>{c.name}</Typography>
                <Chip size="small" variant="outlined" color={c.isActive ? 'success' : 'default'} label={c.isActive ? 'Aktivní' : 'Neaktivní'} />
              </Stack>
              {c.location !== '' && <Typography sx={{ ...TYPE.caption, mb: 1 }}>{c.location}</Typography>}
              <Typography sx={{ ...TYPE.label, mb: 0.75 }}>Pracovní dny</Typography>
              <WorkingDays calendarId={c.id} />
            </SoftCard>
          ))}
        </Stack>
      </AsyncSection>
    </Stack>
  );
}
