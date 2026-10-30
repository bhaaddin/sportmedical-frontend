/*
 * "QR Platba" of one invoice: the picture the patient scans in the bank app,
 * and the same facts to read out or copy - amount, variable symbol, account.
 * The server draws the code; this only shows it. Nothing here is a secret.
 */
import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import toast from 'react-hot-toast';
import type { PaymentQr } from '../../api/payments';
import { czk } from '../../pages/billing/money';

const qrSource = (qr: PaymentQr): string | null => {
  if (qr.qrPngBase64) return `data:image/png;base64,${qr.qrPngBase64}`;
  if (qr.qrSvg) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.qrSvg)}`;
  return null;
};

function CopyRow({ label, value, copyText }: { label: string; value: string; copyText?: string }) {
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(copyText ?? value);
      toast.success(`${label} zkopírován`);
    } catch {
      toast.error('Kopírování se nepovedlo');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{label}</Typography>
        <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</Typography>
      </Box>
      <Button size="small" variant="text" disabled={busy} onClick={() => void copy()} aria-label={`Kopírovat: ${label}`}
        startIcon={<ContentCopy fontSize="small" />} sx={{ minHeight: 44, flexShrink: 0 }}>
        Kopírovat
      </Button>
    </Box>
  );
}

export default function PaymentQrPanel({ qr }: { qr: PaymentQr }) {
  const src = qrSource(qr);
  return (
    <Stack spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'stretch' } }} data-testid="payment-qr">
      {src && (
        <Box sx={{ alignSelf: 'center', p: 1.5, borderRadius: 2, bgcolor: 'common.white', border: '1px solid', borderColor: 'divider' }}>
          <Box component="img" src={src} alt="QR Platba" sx={{ display: 'block', width: 192, height: 192 }} />
        </Box>
      )}
      <CopyRow label="Částka" value={czk(qr.amountCzk)} copyText={String(qr.amountCzk)} />
      <CopyRow label="Variabilní symbol" value={qr.variableSymbol} />
      <CopyRow label="Účet (IBAN)" value={qr.iban} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Platba čeká na připsání. Až peníze přijdou, potvrdíte ji v přehledu Platby.
      </Typography>
    </Stack>
  );
}
