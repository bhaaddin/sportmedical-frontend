/*
 * Faktury - one patient's invoices, in the same table style as Fakturace.
 *
 * `GET /api/billing/invoices?patientId=` answers only this person's documents.
 * "Vystavit doklad" goes to Fakturace with the patient already chosen; a row
 * (or its number, a connected link with a peek) goes there too, scrolled to and
 * opened.
 *
 * Built as shelves inside the patient card's frame (docs/ui-shelf-system.md):
 * "K úhradě" - what this patient still owes and which invoices are past due (the
 * same `isOverdue` as Fakturace), drawn only when something is open - and
 * "Faktury", the whole list, with an empty state that offers the next action.
 *
 * Three layouts: a card per invoice on a phone, number and amount on an iPad,
 * every column on a desktop. "Vystavit doklad" stands in the shelf's header on
 * all three (the card's own "Objednat termín" is the one pinned on a phone).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { billingApi } from '../../api/billing';
import type { Invoice } from '../../api/billing';
import { StatusChip } from '../../components/ui';
import { ResponsiveDataList } from '../../components/ui/ResponsiveDataList';
import type { DataColumn } from '../../components/ui/ResponsiveDataList';
import { AttentionCard, EntityLink, MetricCard, Shelf, entityTarget } from '../../ui/shelf';
import { overdueInvoices } from '../../ui/shelf/attention';
import { czDate, czk } from '../billing/money';
import { doklady, isOpen, itemsLabel, statusOf } from '../billing/invoiceView';

export default function PatientInvoicesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['patient', id, 'invoices'],
    queryFn: () => billingApi.getInvoices({ patientId: id }),
    enabled: id !== undefined,
  });

  const now = useMemo(() => new Date(), []);
  const invoices = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Date.parse(b.issueDateUtc) - Date.parse(a.issueDateUtc)),
    [query.data],
  );
  const open = invoices.filter(isOpen);
  const owed = open.reduce((sum, inv) => sum + inv.remainingCzk, 0);
  const overdue = useMemo(() => {
    const group = overdueInvoices({ now, invoices });
    return group === null ? null : { ...group, action: { label: 'Otevřít ve Fakturaci', to: '/billing', state: { filter: 'overdue' } } };
  }, [now, invoices]);

  const openInvoice = (inv: Invoice) => {
    const target = entityTarget({ kind: 'invoice', id: inv.id });
    navigate(target.to, { state: target.state });
  };
  const issueState = { patientId: id };

  const numberLink = (inv: Invoice) => (
    <EntityLink entity={{ kind: 'invoice', id: inv.id, label: inv.invoiceNumber }} onNavigate={(e) => e.stopPropagation()} />
  );

  const columns: DataColumn<Invoice>[] = [
    {
      key: 'number',
      header: 'Číslo',
      tablet: true,
      cell: (inv) => <Box sx={{ whiteSpace: 'nowrap' }}>{numberLink(inv)}</Box>,
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
    <Button variant="outlined" onClick={() => navigate('/billing', { state: issueState })} sx={{ minHeight: 44 }}>
      Vystavit doklad
    </Button>
  );

  return (
    <Stack spacing={3}>
      {open.length > 0 && (
        <Shelf id="due" title="K úhradě" count={open.length} countTone="red" layout="row" minCardWidth={260} stagger={false}>
          <MetricCard
            label="Zbývá zaplatit"
            value={owed}
            format={czk}
            tone="red"
            hint={`${doklady(open.length)} k úhradě${overdue === null ? '' : `, ${overdue.count} po splatnosti`}`}
          />
          {overdue !== null && <AttentionCard group={overdue} />}
        </Shelf>
      )}

      <Shelf
        id="invoices"
        title="Faktury"
        hint="Od nejnovějšího"
        count={query.isSuccess ? invoices.length : undefined}
        layout="free"
        loading={query.isLoading}
        error={query.isError ? 'Faktury se nepodařilo načíst.' : false}
        onRetry={() => void query.refetch()}
        empty={query.isSuccess && invoices.length === 0}
        emptyState={{
          text: 'Tomuto pacientovi zatím nebyl vystaven žádný doklad.',
          action: { label: 'Vystavit doklad', to: '/billing', state: issueState },
        }}
        controls={query.isSuccess && invoices.length > 0 ? issue : undefined}
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
      </Shelf>

    </Stack>
  );
}
