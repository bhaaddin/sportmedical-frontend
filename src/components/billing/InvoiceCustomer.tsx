/*
 * The ODBĚRATEL cell: a patient links to their card, a club to its page - each a
 * connected link of the shelf system (one address in `entityTarget`, a peek on a
 * rest, plain text without the permission) - a group is its plain name; each with
 * a small chip saying Osoba / Skupina / Tým.
 */
import { Box } from '@mui/material';
import { EntityLink } from '../../ui/shelf';
import type { Invoice } from '../../api/billing';
import { StatusChip } from '../ui';
import { RECIPIENT_LABEL, customerOf, recipientTypeOf } from '../../pages/billing/invoiceView';

export default function InvoiceCustomer({ invoice, wrap = false }: { invoice: Invoice; wrap?: boolean }) {
  const type = recipientTypeOf(invoice);
  const name = customerOf(invoice);
  let who: React.ReactNode = name;
  if (type === 'Person' && invoice.patientId) {
    who = <EntityLink entity={{ kind: 'patient', id: invoice.patientId, label: name || 'Pacient' }} />;
  } else if (type === 'Team' && invoice.clubId) {
    who = <EntityLink entity={{ kind: 'club', id: invoice.clubId, label: name || 'Klub' }} />;
  } else if (type === 'Group') {
    who = <Box component="span" sx={{ fontWeight: 600 }}>{name}</Box>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
      <Box component="span" sx={{ minWidth: 0 }}>{who}</Box>
      <StatusChip size="sm" tone={type === 'Person' ? 'grey' : type === 'Team' ? 'green' : 'blue'}>
        {RECIPIENT_LABEL[type]}
      </StatusChip>
    </Box>
  );
}
