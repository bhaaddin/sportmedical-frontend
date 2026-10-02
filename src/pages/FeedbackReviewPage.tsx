/* ══════════════════════════════════════════════════════════════
   HODNOCENÍ PACIENTŮ  (route: /hodnoceni-pacientu)

   The private staff review of patient feedback (plan 23.06): everything the
   patients answered, newest first. Nothing here is published — publication, if
   ever wanted, is a separate decision, never automatic.
   ══════════════════════════════════════════════════════════════ */

import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { FEEDBACK_QUERY_KEY, listFeedback } from '../api/feedback';
import { KpiCard, PageHeader, SoftCard } from '../components/ui';

const when = (utc: string): string =>
  new Date(utc).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

export default function FeedbackReviewPage() {
  const query = useQuery({ queryKey: FEEDBACK_QUERY_KEY, queryFn: listFeedback });

  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return <Alert severity="error">Hodnocení se nepodařilo načíst.</Alert>;
  }

  const entries = query.data;
  const average =
    entries.length === 0
      ? null
      : entries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / entries.length;

  return (
    <Box>
      <PageHeader
        title="Hodnocení pacientů"
        subtitle="Co pacienti napsali po dokončené návštěvě · soukromé, nic se nikde nezveřejňuje"
      />

      {entries.length === 0 ? (
        <Alert severity="info">Zatím žádné hodnocení. Pozvánka se posílá po dokončení návštěvy.</Alert>
      ) : (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <KpiCard label="Hodnocení" value={entries.length} hint="odpovědí celkem" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <KpiCard
                label="Průměr"
                value={average !== null ? `${average.toFixed(1)} / 5` : '—'}
                hint="hvězdiček"
                tone="primary"
              />
            </Grid>
          </Grid>

          {entries.map((entry) => (
            <SoftCard key={entry.id}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Rating value={entry.rating ?? 0} readOnly />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {entry.submittedAtUtc ? when(entry.submittedAtUtc) : '—'}
                </Typography>
                <Typography
                  variant="body2"
                  component={RouterLink}
                  to={`/patients/${entry.patientId}`}
                  sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                >
                  Karta pacienta
                </Typography>
              </Stack>
              {entry.comment ? (
                <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>{entry.comment}</Typography>
              ) : (
                <Typography sx={{ mt: 1.5, color: 'text.secondary', fontStyle: 'italic' }}>
                  Bez komentáře.
                </Typography>
              )}
            </SoftCard>
          ))}
        </Stack>
      )}
    </Box>
  );
}
