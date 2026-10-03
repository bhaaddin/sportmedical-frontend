/*
 * Faktury - one patient's invoices, in the same table style as Fakturace.
 *
 * `GET /api/billing/invoices?patientId=` answers only this person's documents.
 * "Vystavit doklad" goes to Fakturace with the patient already chosen; a row
 * goes there too, scrolled to and opened.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { billingApi } from '../../api/billing';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { czDate, czk } from '../billing/money';
import { itemsLabel, statusOf } from '../billing/invoiceView';

export default function PatientInvoicesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['patient', id, 'invoices'],
    queryFn: () => billingApi.getInvoices({ patientId: id }),
    enabled: id !== undefined,
  });

  const now = new Date();
  const invoices = [...(query.data ?? [])].sort(
    (a, b) => Date.parse(b.issueDateUtc) - Date.parse(a.issueDateUtc),
  );

  return (
    <SoftCard sx={{ p: 0, overflow: 'hidden' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2.5, pt: 2.5, pb: 1.5 }}>
        <Box>
          <SectionLabel sx={{ mb: 0.25 }}>Faktury</SectionLabel>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Doklady vystavené tomuto pacientovi, od nejnovějšího.
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate('/billing', { state: { patientId: id } })}
        >
          Vystavit doklad
        </Button>
      </Stack>

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={invoices.length === 0}
        isSettled={!query.isLoading}
        emptyText="Tomuto pacientovi zatím nebyl vystaven žádný doklad."
        onRetry={() => void query.refetch()}
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Číslo</TableCell>
                <TableCell>Položky</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell align="right">Částka</TableCell>
                <TableCell>Stav</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => {
                const st = statusOf(inv, now);
                return (
                  <TableRow
                    key={inv.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate('/billing', { state: { invoiceId: inv.id } })}
                  >
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{inv.invoiceNumber}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="body2" noWrap title={itemsLabel(inv)}>{itemsLabel(inv)}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{czDate(inv.issueDateUtc)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {czk(inv.totalCzk)}
                      {inv.status === 'PartiallyPaid' && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                          zbývá {czk(inv.remainingCzk)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell><StatusChip tone={st.tone}>{st.label}</StatusChip></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </AsyncSection>
    </SoftCard>
  );
}
