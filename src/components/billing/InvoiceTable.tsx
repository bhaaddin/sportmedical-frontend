/*
 * The invoices as the board draws them: ČÍSLO · ODBĚRATEL · POLOŽKY · DATUM ·
 * ČÁSTKA · STAV. On an iPad the table has fewer columns - the date moves under
 * the number and the items under the customer - so it fits without scrolling.
 */
import { Fragment } from 'react';
import {
  Box, Collapse, IconButton, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import type { Invoice } from '../../api/billing';
import { StatusChip } from '../ui';
import { czDate, czk } from '../../pages/billing/money';
import { itemsWithDiscount, statusOf } from '../../pages/billing/invoiceView';
import InvoiceActions from './InvoiceActions';
import type { InvoiceActionHandlers } from './InvoiceActions';
import InvoiceCustomer from './InvoiceCustomer';
import InvoiceDetails from './InvoiceDetails';

export type InvoiceSortKey = 'invoiceNumber' | 'customer' | 'issueDateUtc' | 'totalCzk' | 'status';

export default function InvoiceTable({
  invoices,
  now,
  compact,
  sortBy,
  sortDir,
  onSort,
  openId,
  onToggle,
  handlers,
  empty,
}: {
  invoices: Invoice[];
  now: Date;
  /** iPad: fewer columns. */
  compact: boolean;
  sortBy: InvoiceSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: InvoiceSortKey) => void;
  openId: string | null;
  onToggle: (id: string) => void;
  handlers: InvoiceActionHandlers;
  empty: string;
}) {
  const sortable = (key: InvoiceSortKey, label: string) => (
    <TableSortLabel active={sortBy === key} direction={sortBy === key ? sortDir : 'asc'} onClick={() => onSort(key)}>
      {label}
    </TableSortLabel>
  );
  const dir = (key: InvoiceSortKey) => (sortBy === key ? sortDir : false);
  const span = compact ? 5 : 7;

  return (
    <Table aria-label="Doklady">
      <TableHead>
        <TableRow>
          <TableCell sortDirection={dir('invoiceNumber')}>{sortable('invoiceNumber', 'Číslo')}</TableCell>
          <TableCell sortDirection={dir('customer')}>{sortable('customer', 'Odběratel')}</TableCell>
          {!compact && <TableCell>Položky</TableCell>}
          {!compact && <TableCell sortDirection={dir('issueDateUtc')}>{sortable('issueDateUtc', 'Datum')}</TableCell>}
          <TableCell align="right" sortDirection={dir('totalCzk')}>{sortable('totalCzk', 'Částka')}</TableCell>
          <TableCell sortDirection={dir('status')}>{sortable('status', 'Stav')}</TableCell>
          <TableCell align="right">Akce</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {invoices.map((inv) => {
          const st = statusOf(inv, now);
          const open = openId === inv.id;
          const items = itemsWithDiscount(inv);
          return (
            <Fragment key={inv.id}>
              <TableRow id={`invoice-${inv.id}`} hover selected={open}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{inv.invoiceNumber}</Typography>
                  {compact && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{czDate(inv.issueDateUtc)}</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ maxWidth: compact ? 260 : undefined }}>
                  <InvoiceCustomer invoice={inv} wrap={compact} />
                  {compact && (
                    <Typography variant="caption" noWrap title={items} sx={{ color: 'text.secondary', display: 'block' }}>
                      {items}
                    </Typography>
                  )}
                </TableCell>
                {!compact && (
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" noWrap title={items}>{items}</Typography>
                  </TableCell>
                )}
                {!compact && <TableCell sx={{ whiteSpace: 'nowrap' }}>{czDate(inv.issueDateUtc)}</TableCell>}
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {czk(inv.totalCzk)}
                  {inv.status === 'PartiallyPaid' && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      zbývá {czk(inv.remainingCzk)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell><StatusChip tone={st.tone}>{st.label}</StatusChip></TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    <InvoiceActions invoice={inv} handlers={handlers} touch={compact} />
                    <IconButton
                      size="small"
                      onClick={() => onToggle(inv.id)}
                      aria-expanded={open}
                      aria-label={`Platby dokladu ${inv.invoiceNumber}`}
                      sx={compact ? { width: 44, height: 44 } : undefined}
                    >
                      {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={span} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
                  <Collapse in={open} timeout="auto" unmountOnExit>
                    <InvoiceDetails invoice={inv} />
                  </Collapse>
                </TableCell>
              </TableRow>
            </Fragment>
          );
        })}
        {invoices.length === 0 && (
          <TableRow>
            <TableCell colSpan={span} sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary' }}>{empty}</Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
