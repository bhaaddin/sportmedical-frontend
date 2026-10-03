/*
 * The ODBĚRATEL cell: a patient links to their card, a club to the clubs
 * screen with that club open, a group is its plain name - each with a small
 * chip saying Osoba / Skupina / Tým.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import type { Invoice } from '../../api/billing';
import { StatusChip } from '../ui';
import { RECIPIENT_LABEL, customerOf, recipientTypeOf } from '../../pages/billing/invoiceView';

export default function InvoiceCustomer({ invoice, wrap = false }: { invoice: Invoice; wrap?: boolean }) {
  const type = recipientTypeOf(invoice);
  const name = customerOf(invoice);
  const linkSx = { color: 'primary.main', fontWeight: 600 };

  let who: React.ReactNode = name;
  if (type === 'Person' && invoice.patientId) {
    who = (
      <Link component={RouterLink} to={`/patients/${invoice.patientId}`} underline="hover" sx={linkSx}>
        {name || 'Pacient'}
      </Link>
    );
  } else if (type === 'Team' && invoice.clubId) {
    who = (
      <Link component={RouterLink} to="/clubs" state={{ clubId: invoice.clubId }} underline="hover" sx={linkSx}>
        {name || 'Klub'}
      </Link>
    );
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
