/* ══════════════════════════════════════════════════════════════
   HODNOCENÍ PACIENTŮ  (route: /hodnoceni-pacientu)

   The private staff review of patient feedback (plan 23.06): everything the
   patients answered, newest first. Nothing here is published — publication, if
   ever wanted, is a separate decision, never automatic.
   ══════════════════════════════════════════════════════════════ */

import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { FEEDBACK_QUERY_KEY, listFeedback } from '../api/feedback';

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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Hodnocení pacientů</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Co pacienti napsali po dokončené návštěvě. Soukromé — nic se nikde nezveřejňuje.
        </Typography>
      </Box>

      {entries.length === 0 ? (
        <Alert severity="info">Zatím žádné hodnocení. Pozvánka se posílá po dokončení návštěvy.</Alert>
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip label={`${entries.length} hodnocení`} />
            {average !== null ? (
              <Chip color="primary" label={`průměr ${average.toFixed(1)} / 5`} />
            ) : null}
          </Stack>

          {entries.map((entry) => (
            <Card key={entry.id} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <Rating value={entry.rating ?? 0} readOnly />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {entry.submittedAtUtc ? when(entry.submittedAtUtc) : '—'}
                  </Typography>
                  <Typography
                    variant="body2"
                    component={RouterLink}
                    to={`/patients/${entry.patientId}`}
                    sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none' }}
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
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
