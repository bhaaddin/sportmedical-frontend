/*
 * Faktury - one patient's invoices, in the same table style as Fakturace.
 *
 * `GET /api/billing/invoices?patientId=` answers only this person's documents.
 * "Vystavit doklad" goes to Fakturace with the patient already chosen; a row
 * goes there too, scrolled to and opened.
 *
 * Three layouts: a card per invoice on a phone ("Vystavit doklad" pinned at
 * the bottom), number and amount on an iPad, every column on a desktop.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { billingApi } from '../../api/billing';
import type { Invoice } from '../../api/billing';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../../components/ui/PinnedActionBar';
import { useIsPhone } from '../../layout/useDevice';
import { czDate, czk } from '../billing/money';
import { itemsLabel, statusOf } from '../billing/invoiceView';

export default function PatientInvoicesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const phone = useIsPhone();

  const query = useQuery({
    queryKey: ['patient', id, 'invoices'],
    queryFn: () => billingApi.getInvoices({ patientId: id }),
    enabled: id !== undefined,
  });

  const now = new Date();
  const invoices = [...(query.data ?? [])].sort(
    (a, b) => Date.parse(b.issueDateUtc) - Date.parse(a.issueDateUtc),
  );

  const openInvoice = (inv: Invoice) => navigate('/billing', { state: { invoiceId: inv.id } });

  const columns: DataColumn<Invoice>[] = [
    {
      key: 'number',
      header: 'Číslo',
      tablet: true,
      cell: (inv) => <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{inv.invoiceNumber}</Box>,
    },
    {
      key: 'items',
      header: 'Položky',
      cell: (inv) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 320 }} title={itemsLabel(inv)}>
          {itemsLabel(inv)}
        </Typography>
      ),
    },
    { key: 'date', header: 'Datum', cell: (inv) => <Box sx={{ whiteSpace: 'nowrap' }}>{czDate(inv.issueDateUtc)}</Box> },
    {
      key: 'amount',
      header: 'Částka',
      align: 'right',
      tablet: true,
      cell: (inv) => (
        <Box sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {czk(inv.totalCzk)}
          {inv.status === 'PartiallyPaid' && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              zbývá {czk(inv.remainingCzk)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'status',
      header: 'Stav',
      tablet: true,
      cell: (inv) => <StatusChip tone={statusOf(inv, now).tone}>{statusOf(inv, now).label}</StatusChip>,
    },
  ];

  const issue = (
    <Button
      variant="contained"
      onClick={() => navigate('/billing', { state: { patientId: id } })}
      sx={{ minHeight: 44 }}
    >
      Vystavit doklad
    </Button>
  );

  return (
    <Stack spacing={2}>
      <SoftCard>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box>
            <SectionLabel sx={{ mb: 0.25 }}>Faktury</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Doklady vystavené tomuto pacientovi, od nejnovějšího.
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          {!phone && issue}
        </Stack>
      </SoftCard>

      <AsyncSection
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={invoices.length === 0}
        isSettled={!query.isLoading}
        emptyText="Tomuto pacientovi zatím nebyl vystaven žádný doklad."
        onRetry={() => void query.refetch()}
      >
        <ResponsiveDataList
          rows={invoices}
          rowKey={(inv) => inv.id}
          columns={columns}
          onRowClick={openInvoice}
          ariaLabel="Faktury pacienta"
          renderCard={(inv) => {
            const st = statusOf(inv, now);
            return (
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{inv.invoiceNumber}</Typography>
                  <StatusChip tone={st.tone}>{st.label}</StatusChip>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {czDate(inv.issueDateUtc)} · {itemsLabel(inv)}
                </Typography>
                <Typography sx={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {czk(inv.totalCzk)}
                  {inv.status === 'PartiallyPaid' && (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                      zbývá {czk(inv.remainingCzk)}
                    </Typography>
                  )}
                </Typography>
              </Stack>
            );
          }}
        />
      </AsyncSection>

      {phone && <PinnedActionBar label="Vystavit doklad">{issue}</PinnedActionBar>}
    </Stack>
  );
}
