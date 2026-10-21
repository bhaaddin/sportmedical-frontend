/*
 * PatientRelatedShelf - the ready-made "Související" for a patient's card. It reads the invoices and the clubs itself and
 * takes what the card already loaded (the booking window, the documents), so it adds two requests and no duplicates.
 *
 * Imported by its own path, not through the barrel: it carries the billing, club and document api modules, which a page
 * that only draws shelves should not download.
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/billing';
import type { DayAppointment } from '../../api/bookingContracts';
import { clubsApi } from '../../api/clubs';
import type { PatientDocument } from '../../api/documents';
import { usePermission } from '../../auth/usePermission';
import { RelatedShelf } from './RelatedShelf';
import { patientRelatedGroups } from './related';

/** `upcoming` and `documents` are what the patient's card already loaded. */
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
