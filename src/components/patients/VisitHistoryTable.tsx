/*
 * HISTORIE NÁVŠTĚV - the visits that happened, newest first (design-15):
 * date · činnost · price · Zaplaceno / Nezaplaceno.
 *
 * The price is the činnost's current price off the price list, by name,
 * because the appointment list carries the name and nothing else about
 * money; an invoice for the same patient on the same day overrides it with
 * what was actually charged and says whether it was paid. No invoice, no
 * chip - "Nezaplaceno" is a claim, and a visit nobody invoiced is not one.
 */
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import type { Invoice } from '../../api/billing';
import { SectionLabel, SoftCard, StatusChip } from '../ui';
import { formatCzk } from './patientActivity';
import type { PatientAppointment } from './patientActivity';
import { formatPragueDate, pragueDateKey } from '../../utils/time';

/** The invoice issued to this patient on the day of the visit, if any. */
export function invoiceForVisit(
  visit: Pick<PatientAppointment, 'patientId' | 'startTime'>,
  invoices: readonly Invoice[],
): Invoice | null {
  const day = pragueDateKey(visit.startTime);
  return invoices.find(
    (inv) => inv.patientId === visit.patientId && pragueDateKey(inv.issueDateUtc) === day,
  ) ?? null;
}

export function VisitHistoryTable({
  visits,
  invoices,
  priceOf,
}: {
  visits: readonly PatientAppointment[];
  /** Invoices this account may read; empty when it may not. */
  invoices: readonly Invoice[];
  priceOf: (activityName: string) => number | null;
}) {
  return (
    <SoftCard sx={{ p: 0, overflow: 'hidden' }}>
      <SectionLabel sx={{ px: 2.5, pt: 2.5, mb: 1 }}>Historie návštěv</SectionLabel>
      {visits.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', px: 2.5, pb: 2.5 }}>
          Zatím žádná návštěva.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Datum</TableCell>
                <TableCell>Činnost</TableCell>
                <TableCell align="right">Cena</TableCell>
                <TableCell align="right">Platba</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visits.map((visit) => {
                const invoice = invoiceForVisit(visit, invoices);
                const price = invoice === null ? priceOf(visit.eventName) : invoice.totalCzk;
                const paid = invoice === null ? null : invoice.remainingCzk <= 0;
                return (
                  <TableRow key={visit.id}>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatPragueDate(visit.startTime)}
                    </TableCell>
                    <TableCell>{visit.eventName === '' ? 'Termín' : visit.eventName}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatCzk(price)}</TableCell>
                    <TableCell align="right">
                      {paid === null ? (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                      ) : (
                        <StatusChip tone={paid ? 'green' : 'beige'}>{paid ? 'Zaplaceno' : 'Nezaplaceno'}</StatusChip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SoftCard>
  );
}

export default VisitHistoryTable;
