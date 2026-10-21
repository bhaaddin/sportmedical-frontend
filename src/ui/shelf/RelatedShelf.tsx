/*
 * RelatedShelf - "Související": one card per kind of thing a page's subject is connected to, each naming the first few as
 * connected chips (a click opens them, a rest shows a peek), saying how many there are in all, and - when there are none -
 * offering the next action instead of a blank.
 *
 *   <RelatedShelf groups={patientRelatedGroups({...})}>{extra cards}</RelatedShelf>
 *
 * `PatientRelatedShelf` is the ready-made one for a patient's card: it reads the invoices and the clubs itself and takes
 * what the card already loaded (the booking window, the documents), so it adds two requests and no duplicates.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/billing';
import type { DayAppointment } from '../../api/bookingContracts';
import { clubsApi } from '../../api/clubs';
import type { PatientDocument } from '../../api/documents';
import { usePermission } from '../../auth/usePermission';
import { EntityChip } from './EntityLink';
import { Shelf } from './Shelf';
import { patientRelatedGroups, type RelatedGroup } from './related';
import { MUTED_SX, TARGET_SX, cardSurface } from './shelfStyle';

export function RelatedCard({ group }: { group: RelatedGroup }) {
  return (
    <Box role="listitem" data-card="related" data-related={group.id} data-state={group.status} sx={(t) => ({ ...cardSurface(t, false), p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 })}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 700 }}>{group.title}</Typography>
        {group.status === 'ready' && (
          <Typography component="span" aria-label={`Počet: ${group.total}`} sx={{ ...MUTED_SX, fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{group.total}</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {group.status === 'ready' && group.viewAll !== undefined && group.total > group.entities.length && (
          <Button component={RouterLink} to={group.viewAll.to} state={group.viewAll.state} size="small" aria-label={`Zobrazit vše: ${group.title}`} sx={{ ...TARGET_SX, fontSize: 12.5, px: 0.75 }}>
            Zobrazit vše
          </Button>
        )}
      </Box>

      {group.status === 'loading' && (
        <Box aria-busy="true" aria-label={`${group.title}: načítám`}><Skeleton height={28} width="80%" /><Skeleton height={28} width="60%" /></Box>
      )}
      {group.status === 'error' && <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>Nepodařilo se načíst.</Typography>}

      {group.status === 'ready' && (
        group.total === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
            <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>{group.empty}</Typography>
            {group.emptyAction !== undefined && (
              <Button component={RouterLink} to={group.emptyAction.to} state={group.emptyAction.state} size="small" variant="outlined" sx={TARGET_SX}>
                {group.emptyAction.label}
              </Button>
            )}
          </Box>
        ) : (
          <Box role="list" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
            {group.entities.map((e) => (
              <Box component="span" role="listitem" key={`${e.kind}:${e.id}`} sx={{ display: 'inline-flex', maxWidth: '100%' }}><EntityChip entity={e} /></Box>
            ))}
            {group.notes.map((n) => (
              <Typography key={n} component="span" role="listitem" sx={{ ...MUTED_SX, fontSize: 13, alignSelf: 'center' }}>{n}</Typography>
            ))}
          </Box>
        )
      )}
    </Box>
  );
}

export function RelatedShelf({ groups, title = 'Související', hint, children }: { groups: RelatedGroup[]; title?: string; hint?: string; children?: ReactNode }) {
  return (
    <Shelf id="related" title={title} hint={hint} layout="grid" minCardWidth={252} stagger={false}>
      {groups.map((g) => <RelatedCard key={g.id} group={g} />)}
      {children}
    </Shelf>
  );
}

/** A patient's related shelf. `upcoming` and `documents` are what the patient's card already loaded. */
export function PatientRelatedShelf({
  patientId, upcoming, documents, children,
}: {
  patientId: string;
  upcoming: readonly DayAppointment[] | null;
  /** `null` until the card has them: an empty list is a real answer, "nothing yet" is not. */
  documents: readonly PatientDocument[] | null;
  children?: ReactNode;
}) {
  const mayBill = usePermission('billing.manage');
  const invoices = useQuery({
    queryKey: ['shelf', 'patient-invoices', patientId],
    queryFn: () => billingApi.getInvoices({ patientId }),
    enabled: mayBill,
    staleTime: 60_000,
    retry: false,
  });
  const clubs = useQuery({ queryKey: ['shelf', 'clubs'], queryFn: () => clubsApi.getAll(), staleTime: 5 * 60_000, retry: false });
  const groups = patientRelatedGroups({
    patientId,
    upcoming: { data: upcoming, loading: upcoming === null },
    invoices: mayBill ? { data: invoices.data, loading: invoices.isPending, error: invoices.isError } : { hidden: true },
    documents: { data: documents, loading: documents === null },
    clubs: { data: clubs.data, loading: clubs.isPending, error: clubs.isError },
  });
  return <RelatedShelf groups={groups}>{children}</RelatedShelf>;
}
