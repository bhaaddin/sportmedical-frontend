/* ══════════════════════════════════════════════════════════════
   HODNOCENÍ PACIENTŮ  (route: /hodnoceni-pacientu)

   The private staff review of patient feedback (plan 23.06): everything the
   patients answered, newest first. Nothing here is published — publication, if
   ever wanted, is a separate decision, never automatic.

   Shelves (docs/ui-shelf-system.md): Souhrn (how many, the average), K
   vyřízení (two stars or fewer - somebody should call back; only when there
   are any) and Hodnocení (all of them: a card per answer on a phone, rating,
   comment and date on a tablet, the desktop adds the patient's card).
   ══════════════════════════════════════════════════════════════ */

import { Box, Rating, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FEEDBACK_QUERY_KEY, listFeedback, type FeedbackEntry } from '../api/feedback';
import { usePermission } from '../auth/usePermission';
import { MetricCard, PageFrame, Shelf, entityTarget } from '../ui/shelf';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { ShelfRow } from './patients/ShelfRow';

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

/**
 * The mean of the stars given. An answer without a rating (a comment only) is not a
 * zero-star answer: counting it as 0 dragged the average down.
 */
export function averageRating(entries: readonly Pick<FeedbackEntry, 'rating'>[]): number | null {
  const rated = entries
    .map((entry) => entry.rating)
    .filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating));
  return rated.length === 0 ? null : rated.reduce((sum, rating) => sum + rating, 0) / rated.length;
}

/** Two stars or fewer: the answers somebody should read first, and probably call back. */
export const LOW_RATING = 2;
export const isLow = (entry: Pick<FeedbackEntry, 'rating'>): boolean => typeof entry.rating === 'number' && entry.rating <= LOW_RATING;

const cardOf = (entry: Entry) => entityTarget({ kind: 'patient', id: entry.patientId }).to;

const patientLink = (entry: Entry) => (
  <Typography
    variant="body2"
    component={RouterLink}
    to={cardOf(entry)}
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
  /* The answers carry a patient id, never a name: the link to the card is the one connection, and only for whoever may open it. */
  const mayOpenPatient = usePermission('patients.view');
  const query = useQuery({ queryKey: FEEDBACK_QUERY_KEY, queryFn: listFeedback });

  const entries = query.data ?? [];
  const known = query.data !== undefined && !query.isError;
  const average = averageRating(entries);
  const low = entries.filter(isLow);

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
    ...(mayOpenPatient ? [{ key: 'patient', header: 'Pacient', align: 'right' as const, cell: patientLink }] : []),
  ];

  return (
    <PageFrame
      title="Hodnocení pacientů"
      purpose="Co pacienti napsali po dokončené návštěvě — soukromé, nic se nikde nezveřejňuje"
    >
      {known && entries.length > 0 && (
        <Shelf id="summary" title="Souhrn" layout="row" fill minCardWidth={200} phoneWidth="min(44vw, 200px)" stagger={false}>
          <MetricCard label="Hodnocení" value={entries.length} hint="odpovědí celkem" />
          <MetricCard
            label="Průměr"
            value={average !== null ? `${average.toFixed(1).replace('.', ',')} / 5` : '—'}
            hint="hvězdiček"
            tone="primary"
          />
        </Shelf>
      )}

      {known && low.length > 0 && (
        <Shelf id="low" title="K vyřízení" hint={`${LOW_RATING} hvězdičky a méně: stojí za to se ozvat`} count={low.length} countTone="red" layout="list" stagger={false}>
          {low.map((e) => (
            <ShelfRow
              key={e.id}
              tone="red"
              title={<Rating value={e.rating ?? 0} readOnly size="small" />}
              detail={(
                <>
                  {e.comment ? e.comment : 'Bez komentáře.'}
                  {e.submittedAtUtc ? ` · ${when(e.submittedAtUtc)}` : ''}
                </>
              )}
              trailing={mayOpenPatient ? patientLink(e) : undefined}
            />
          ))}
        </Shelf>
      )}

      <Shelf
        id="answers"
        title="Hodnocení"
        hint="Od nejnovějšího"
        count={known ? entries.length : undefined}
        layout="free"
        stagger={false}
        loading={query.isPending}
        error={query.isError ? 'Hodnocení se nepodařilo načíst.' : false}
        onRetry={() => void query.refetch()}
        empty={known && entries.length === 0}
        emptyState={{ text: 'Zatím žádné hodnocení. Pozvánka se připraví po dokončení návštěvy.' }}
      >
        <ResponsiveDataList
          ariaLabel="Hodnocení pacientů"
          rows={entries}
          rowKey={(e) => e.id}
          columns={columns}
          {...(mayOpenPatient ? { onRowClick: (e: Entry) => navigate(cardOf(e)) } : {})}
          renderCard={(e) => (
            <Stack spacing={1}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                <Rating value={e.rating ?? 0} readOnly />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {e.submittedAtUtc ? when(e.submittedAtUtc) : '—'}
                </Typography>
              </Stack>
              {comment(e)}
              {mayOpenPatient && <Box>{patientLink(e)}</Box>}
            </Stack>
          )}
        />
      </Shelf>
    </PageFrame>
  );
}
