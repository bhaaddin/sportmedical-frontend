import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { usePermission } from '../auth/usePermission';
import type { DayAppointment } from '../api/bookingContracts';
import DayOverviewPage from './booking/DayOverviewPage';
import { FitPage } from '../components/ui/fit';
import { pragueDateKey } from '../utils/time';
import { useAttention } from '../ui/shelf/useAttention';
import { AttentionList, ClubsList, TodayHero, WeekChart } from './overview/Blocks';
import { overviewClubOrdersQuery, overviewWeekQuery } from './overview/queries';
import { attentionBlock, clubsBlock, dayOf, statusOf, todayBlock, weekBlock, weekRange } from './overview/model';

/*
 * Přehled (the start screen) - Stage 4, R18. The owner's rule: "it has to be CLEAR; if it is not clear it is not needed".
 *
 * It answers exactly four questions, each in one calm block (the fifth - the quick actions - is the top action bar's):
 *
 *   Dnes                    how many bookings today, who is next, who waits now
 *   Vyžaduje pozornost      the top 3 of what needs a person (the clubs have their own block)
 *   Tento týden             one small load chart, seven bars, today marked
 *   Kluby k vyřízení        the count and the top 3 club requests
 *
 * Everything the screen used to carry (five figure cards, the patient lookup box, today's two lists, pinned and recent,
 * new patients, "Otevřít kalendář") is gone from it: the lookup is Ctrl+K and the top bar's Hledat, the lists are one
 * click away behind "Dnešní přehled", the register is Pacienti. docs/stage4-2026-10.md has the before/after and the counts.
 *
 * Every word and number is decided in `overview/model.ts` (pure, tested); `overview/Blocks.tsx` only draws it. A source that
 * failed is said ("nepodařilo se načíst" + retry), never drawn as zero or as "vše vyřízeno".
 */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dobré ráno';
  if (h < 17) return 'Dobrý den';
  return 'Dobrý večer';
}

/* ── Dashboard: a doctor lands on their day; the owner/admin get the overview. ── */
export default function Dashboard() {
  let role = '';
  try {
    role = JSON.parse(localStorage.getItem('user') || '{}').role || '';
  } catch {
    /* private mode / cleared storage — fall through to the full overview */
  }
  if (role === 'Staff') return <DayOverviewPage />;
  return <OwnerDashboard />;
}

function OwnerDashboard() {
  const canSeePatients = usePermission('patients.view');
  let user: { firstName?: string } = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    /* an overview without a name is still an overview */
  }

  /* "Now" moves once a minute: "who is next" must not stay on somebody who has begun. */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = pragueDateKey(now);
  const { from, to } = weekRange(now);

  /* ONE request for the Prague week: it answers Dnes (today's rows) and Tento týden (the seven bars). */
  const weekQuery = useQuery({ ...overviewWeekQuery(from, to), refetchInterval: 60_000, retry: false });
  const clubOrders = useQuery({ ...overviewClubOrdersQuery(), retry: false });

  const todayRows: DayAppointment[] = useMemo(() => (weekQuery.data ?? []).filter((a) => dayOf(a) === today), [weekQuery.data, today]);
  /* The day rows already carry the registered patient's name (patientName), so no per-patient request is made (speed-fe-2). */
  const patientNames = useMemo(() => {
    const names: Record<string, string> = {};
    if (!canSeePatients) return names;
    for (const a of todayRows) if (a.patientId !== '' && a.patientName) names[a.patientId] = a.patientName;
    return names;
  }, [canSeePatients, todayRows]);

  /* A failed week must not leave the attention model waiting for today's list for ever: it reads "no rows" and the failure counts. */
  const attention = useAttention(weekQuery.isError ? [] : weekQuery.data === undefined ? null : todayRows, patientNames);

  const weekStatus = statusOf(weekQuery);
  const nameOf = (a: DayAppointment): string => a.patientName || 'Pacient';
  const registered = (a: DayAppointment): boolean => canSeePatients && a.patientId !== '' && !!a.patientName;

  const day = todayBlock(weekStatus, weekQuery.data, now, nameOf, registered);
  const week = weekBlock(weekStatus, weekQuery.data, now);
  const attn = attentionBlock({
    groups: attention.groups,
    loading: attention.loading && !weekQuery.isError,
    failed: attention.failed + (weekQuery.isError ? 1 : 0),
  });
  const clubs = clubsBlock(statusOf(clubOrders), clubOrders.data);

  const retryWeek = () => void weekQuery.refetch();
  const date = now.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <FitPage data-overview="">
      <Box component="header" data-ov="header" sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: { xs: 1.5, md: 4 } }}>
        <Typography component="h1" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {getGreeting()}, {user.firstName || 'Doktore'}
        </Typography>
        <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>{date.charAt(0).toUpperCase() + date.slice(1)}</Typography>
      </Box>

      <Box
        data-ov-grid=""
        sx={{
          display: 'grid',
          gap: { xs: 2, sm: 5, md: 7 },
          width: '100%',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.5fr) minmax(300px, 1fr)' },
          alignItems: 'stretch',
          flex: { md: '1 1 0' },
          minHeight: 0,
          pb: { xs: 0, md: 1 },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 5, md: 6 }, minWidth: 0, minHeight: 0 }}>
          <TodayHero block={day} onRetry={retryWeek} />
          <WeekChart block={week} onRetry={retryWeek} />
        </Box>
        <Box
          sx={(t) => ({
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 2, sm: 5, md: 5 },
            minWidth: 0,
            alignSelf: 'start',
            [t.breakpoints.up('md')]: { borderLeft: '1px solid', borderColor: t.palette.divider, pl: 7 },
          })}
        >
          <AttentionList block={attn} onRetry={attention.retry} />
          <ClubsList block={clubs} onRetry={() => void clubOrders.refetch()} />
        </Box>
      </Box>
    </FitPage>
  );
}
