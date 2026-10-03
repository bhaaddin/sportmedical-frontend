/* ══════════════════════════════════════════════════════════════
   HODNOCENÍ PACIENTŮ  (route: /hodnoceni-pacientu)

   The private staff review of patient feedback (plan 23.06): everything the
   patients answered, newest first. Nothing here is published — publication, if
   ever wanted, is a separate decision, never automatic.

   Three layouts: a phone gets one card per answer, a tablet a table with
   rating, comment and date, the desktop adds the link to the patient's card.
   ══════════════════════════════════════════════════════════════ */

import { Box, Grid, Rating, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FEEDBACK_QUERY_KEY, listFeedback, type FeedbackEntry } from '../api/feedback';
import { KpiCard } from '../components/ui';
import { SettingsScreen } from './settings/SettingsFrame';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { LoadError, PageSkeleton } from './sports/LoadStates';

const when = (utc: string): string =>
  new Date(utc).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

type Entry = FeedbackEntry;

const patientLink = (entry: Entry) => (
  <Typography
    variant="body2"
    component={RouterLink}
    to={`/patients/${entry.patientId}`}
    onClick={(event: React.MouseEvent) => event.stopPropagation()}
    sx={{
      color: 'primary.main', fontWeight: 600, textDecoration: 'none', display: 'inline-flex',
      alignItems: 'center', minHeight: { xs: 44, md: 'auto' }, '&:hover': { textDecoration: 'underline' },
    }}
  >
    Karta pacienta
  </Typography>
);

const comment = (entry: Entry) =>
  entry.comment ? (
    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{entry.comment}</Typography>
  ) : (
    <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Bez komentáře.</Typography>
  );

export default function FeedbackReviewPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: FEEDBACK_QUERY_KEY, queryFn: listFeedback });

  const title = 'Hodnocení pacientů';
  const sentence = 'Co pacienti napsali po dokončené návštěvě — soukromé, nic se nikde nezveřejňuje';

  if (query.isPending) {
    return (
      <SettingsScreen title={title} subtitle={sentence} aside={false} related={false}>
        <PageSkeleton kpis={2} rows={4} />
      </SettingsScreen>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SettingsScreen title={title} subtitle={sentence} aside={false} related={false}>
        <LoadError what="Hodnocení" onRetry={() => void query.refetch()} />
      </SettingsScreen>
    );
  }

  const entries = query.data;
  const average =
    entries.length === 0
      ? null
      : entries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / entries.length;

  const columns: DataColumn<Entry>[] = [
    {
      key: 'rating', header: 'Hodnocení', tablet: true, width: 150,
      cell: (e) => <Rating value={e.rating ?? 0} readOnly size="small" />,
    },
    { key: 'comment', header: 'Komentář', tablet: true, cell: comment },
    {
      key: 'when', header: 'Odesláno', tablet: true,
      cell: (e) => <Box sx={{ whiteSpace: 'nowrap' }}>{e.submittedAtUtc ? when(e.submittedAtUtc) : '—'}</Box>,
    },
    { key: 'patient', header: 'Pacient', align: 'right', cell: patientLink },
  ];

  return (
    <SettingsScreen title={title} subtitle={sentence} aside={false} related={false}>
      {entries.length > 0 && (
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Hodnocení" value={entries.length} hint="odpovědí celkem" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard
            label="Průměr"
            value={average !== null ? `${average.toFixed(1).replace('.', ',')} / 5` : '—'}
            hint="hvězdiček"
            tone="primary"
          />
        </Grid>
      </Grid>
      )}

      <ResponsiveDataList
        ariaLabel="Hodnocení pacientů"
        rows={entries}
        rowKey={(e) => e.id}
        columns={columns}
        onRowClick={(e) => navigate(`/patients/${e.patientId}`)}
        empty="Zatím žádné hodnocení. Pozvánka se připraví po dokončení návštěvy."
        renderCard={(e) => (
          <Stack spacing={1}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Rating value={e.rating ?? 0} readOnly />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {e.submittedAtUtc ? when(e.submittedAtUtc) : '—'}
              </Typography>
            </Stack>
            {comment(e)}
            <Box>{patientLink(e)}</Box>
          </Stack>
        )}
      />
    </SettingsScreen>
  );
}
