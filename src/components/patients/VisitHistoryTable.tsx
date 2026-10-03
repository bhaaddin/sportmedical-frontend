/*
 * HISTORIE NÁVŠTĚV - the visits that happened, newest first (design-15):
 * date · činnost · price · Zaplaceno / Nezaplaceno.
 *
 * The price is the činnost's current price off the price list, by name,
 * because the appointment list carries the name and nothing else about
 * money; an invoice for the same patient on the same day overrides it with
 * what was actually charged and says whether it was paid. No invoice, no
 * chip - "Nezaplaceno" is a claim, and a visit nobody invoiced is not one.
 *
 * Drawn as the board draws it (P-Pacient): rows of date, činnost, price, chip.
 * The rows wrap on their own, so one markup serves a phone, an iPad and a
 * desktop - nothing to turn into cards, nothing that scrolls sideways.
 */
import { Box, Typography } from '@mui/material';
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
    <SoftCard>
      <SectionLabel>Historie návštěv</SectionLabel>
      {visits.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Zatím žádná návštěva.
        </Typography>
      ) : (
        <Box component="ol" aria-label="Historie návštěv" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {visits.map((visit) => {
            const invoice = invoiceForVisit(visit, invoices);
            const price = invoice === null ? priceOf(visit.eventName) : invoice.totalCzk;
            const paid = invoice === null ? null : invoice.remainingCzk <= 0;
            return (
              <Box
                component="li"
                key={visit.id}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1.75,
                  alignItems: 'center',
                  py: 1.5,
                  minHeight: 44,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 600, minWidth: 92, fontVariantNumeric: 'tabular-nums' }}>
                  {formatPragueDate(visit.startTime)}
                </Typography>
                <Typography sx={{ fontSize: 14, flex: '999 1 160px', minWidth: 0 }}>
                  {visit.eventName === '' ? 'Termín' : visit.eventName}
                </Typography>
                <Typography sx={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatCzk(price)}
                </Typography>
                {paid === null ? (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>—</Typography>
                ) : (
                  <StatusChip tone={paid ? 'green' : 'red'}>{paid ? 'Zaplaceno' : 'Nezaplaceno'}</StatusChip>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </SoftCard>
  );
}

export default VisitHistoryTable;
