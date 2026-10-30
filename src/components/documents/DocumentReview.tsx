/*
 * "Přijmout / Odmítnout" for a document the PATIENT sent (NET-14): it counts only after a member of staff has looked at
 * it. The server records who reviewed it; `POST /api/documents/{id}/review?accepted=…` (documents.manage). Nothing here
 * names a file or reads its content.
 */
import { useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { documentsApi, type PatientDocument } from '../../api/documents';
import { usePermission } from '../../auth/usePermission';
import { TARGET_SX } from '../../ui/shelf';

/** True while a document the patient sent still waits for a decision. */
export const awaitsReview = (doc: Pick<PatientDocument, 'status' | 'source'>): boolean => doc.source === 'Patient' && doc.status === 'Pending';

export function DocumentReview({ document: doc, onChanged }: { document: PatientDocument; onChanged: () => void }) {
  const may = usePermission('documents.manage');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!may || !awaitsReview(doc)) return null;

  const decide = async (accepted: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await documentsApi.review(doc.id, accepted);
      onChanged();
    } catch {
      setError(accepted ? 'Dokument se nepodařilo přijmout. Zkuste to prosím znovu.' : 'Dokument se nepodařilo odmítnout. Zkuste to prosím znovu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button size="small" variant="contained" disabled={busy} onClick={() => void decide(true)} sx={TARGET_SX}>Přijmout</Button>
      <Button size="small" variant="outlined" color="inherit" disabled={busy} onClick={() => void decide(false)} sx={{ ...TARGET_SX, borderColor: 'divider' }}>Odmítnout</Button>
      {error !== null && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
    </Box>
  );
}

export default DocumentReview;
