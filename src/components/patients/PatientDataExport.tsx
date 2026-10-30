/*
 * "Exportovat údaje pacienta" (GDPR čl. 15 a 20, NET-14): everything the clinic holds about one patient as one JSON file.
 * `GET /api/patients/{id}/export` is behind `patients.export` and writes the audit row `patient.exported` itself; this
 * button only asks, and asks once more first because the file carries identifiers. An older server answers 404 - the
 * person is told calmly, nothing breaks. Nothing from the file is read, logged or kept here.
 */
import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { FileDownloadOutlined } from '@mui/icons-material';
import client from '../../api/client';
import { usePermission } from '../../auth/usePermission';
import { download, fileNameFromDisposition } from '../../utils/download';
import { ExportGate } from '../ui/ExportGate';
import { TARGET_SX } from '../../ui/shelf';

export function PatientDataExport({ patientId }: { patientId: string }) {
  const may = usePermission('patients.export');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!may) return null;

  const run = async () => {
    setBusy(true);
    await download(
      { kind: 'patient-export', fileName: 'pacient-export.json', failureMessage: 'Výpis se nepodařilo vytvořit. Server ho možná zatím neumí.' },
      {
        kind: 'fetch',
        fetch: async () => {
          const res = await client.get(`/api/patients/${encodeURIComponent(patientId)}/export`, { responseType: 'blob' });
          const header = (res.headers as Record<string, unknown> | undefined)?.['content-disposition'];
          const fileName = fileNameFromDisposition(typeof header === 'string' ? header : null) ?? undefined;
          return { blob: res.data as Blob, ...(fileName !== undefined ? { fileName } : {}) };
        },
      },
    );
    setBusy(false);
    setAsking(false);
  };

  return (
    <>
      <ExportGate>
        {(blocked) => (
          <Button variant="outlined" startIcon={<FileDownloadOutlined />} disabled={blocked} onClick={() => setAsking(true)} sx={TARGET_SX}>
            Exportovat údaje pacienta
          </Button>
        )}
      </ExportGate>
      <Dialog open={asking} onClose={busy ? undefined : () => setAsking(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Exportovat údaje pacienta</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vznikne jeden soubor se vším, co o pacientovi ordinace eviduje (výpis podle GDPR). Obsahuje rodné číslo a další identifikátory,
            proto s ním nakládejte opatrně. Export se zapíše do auditního logu.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsking(false)} disabled={busy} sx={{ minHeight: 44 }}>Zrušit</Button>
          <Button variant="contained" onClick={() => void run()} disabled={busy} sx={{ minHeight: 44 }}>{busy ? 'Připravuji…' : 'Exportovat'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PatientDataExport;
