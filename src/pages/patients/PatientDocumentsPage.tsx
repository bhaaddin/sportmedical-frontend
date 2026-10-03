/*
 * One patient's documents, on their own address.
 *
 * Everything on this page is about the patient in the URL. There is no
 * patient picker, because arriving here already answered that question.
 *
 * Etapa 2 (decision 6): no document is "required" by default any more. Which
 * documents an appointment asks for is set per činnost in the admin, and an
 * empty list is the ordinary state - said plainly, never drawn as a warning.
 * So this page shows what is on file - each document with the template it was
 * filed under - and, separately, what the booked appointments still ask for
 * (usually nothing). The legal consents stay on and have their own line in the
 * card's header.
 *
 * The lists stay apart on purpose: a document filed under a template answers
 * "what does the clinic hold of this person", a report from another doctor
 * answers "what else is going on with them", and a report must never be
 * counted as a document an appointment asked for.
 */
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import MedicalReports, { isMedicalReport } from '../../components/documents/MedicalReports';
import DocumentActions from '../../components/documents/DocumentActions';
import UploadDocumentDialog from '../../components/documents/UploadDocumentDialog';
import type { DocumentStatus, DocumentTemplate, PatientDocument } from '../../api/documents';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { useIsPhone } from '../../layout/useDevice';
import { formatDateOnly } from '../../utils/time';
import {
  NOTHING_REQUIRED_TEXT, expiringSoon, requirementLine, stillMissing, validityText,
} from './paperworkStanding';
import type { PatientContext } from './PatientLayout';

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, { text: string; tone: ChipTone }> = {
  SignedOff: { text: 'Přijato', tone: 'green' },
  Pending: { text: 'Čeká na kontrolu', tone: 'beige' },
  Expired: { text: 'Prošlé', tone: 'grey' },
  Superseded: { text: 'Nahrazeno', tone: 'grey' },
  Rejected: { text: 'Odmítnuto', tone: 'red' },
  Invalidated: { text: 'Neplatné', tone: 'red' },
};

export default function PatientDocumentsPage() {
  const { patient, documents, templates, requirements, reloadDocuments } = useOutletContext<PatientContext>();
  const phone = useIsPhone();
  /* `null` closed, a template for a document filed under it, `'report'` for
     one from another doctor - which carries no template. */
  const [uploading, setUploading] = useState<DocumentTemplate | null | 'report'>(null);
  const [pickedTemplate, setPickedTemplate] = useState('');

  const activeTemplates = templates.filter((t) => t.isActive);
  const templateById = new Map(templates.map((t) => [t.id, t] as const));
  const filed = documents
    .filter((d) => !isMedicalReport(d))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));

  const date = (iso: string) => formatDateOnly(iso.slice(0, 10));
  const missing = requirements === null ? [] : stillMissing(requirements);
  const expiring = requirements === null ? [] : expiringSoon(requirements);
  const chosen = activeTemplates.find((t) => t.id === pickedTemplate) ?? null;

  const renderRow = (doc: PatientDocument) => {
    const template = doc.templateId === null ? undefined : templateById.get(doc.templateId);
    const status = DOCUMENT_STATUS_LABEL[doc.status] ?? { text: doc.status, tone: 'grey' as ChipTone };
    const validity = doc.expiryAt ? `platí do ${date(doc.expiryAt)}` : null;
    return (
      <Stack
        key={doc.id}
        data-testid="patient-document"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
            {doc.templateName ?? template?.name ?? 'Dokument'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {`Šablona: ${template?.name ?? doc.templateName ?? '—'}`}
            {` · nahráno ${date(doc.uploadedAt)}`}
            {validity === null ? '' : ` · ${validity}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusChip tone={status.tone}>{status.text}</StatusChip>
          <DocumentActions
            document={doc}
            patientDocuments={documents}
            patientName={patient.firstName}
            onChanged={reloadDocuments}
          />
        </Stack>
      </Stack>
    );
  };

  return (
    <Stack spacing={2.5}>
      <SoftCard>
        <SectionLabel sx={{ mb: 0.25 }}>Dokumenty pacienta</SectionLabel>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Co klinika o pacientovi uložila, vždy s šablonou, pod kterou to je založené.
        </Typography>

        {filed.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
            Pacient zatím nemá žádný uložený dokument.
          </Typography>
        ) : (
          filed.map(renderRow)
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', alignItems: { sm: 'center' } }}
        >
          <TextField
            select
            size="small"
            label="Šablona dokumentu"
            value={pickedTemplate}
            onChange={(e) => setPickedTemplate(e.target.value)}
            sx={{ minWidth: { sm: 280 }, flex: { sm: 1 } }}
            slotProps={{ input: { sx: { minHeight: phone ? 44 : undefined } } }}
          >
            {activeTemplates.length === 0 && <MenuItem disabled value="">Žádná šablona není nastavená</MenuItem>}
            {activeTemplates.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            disabled={chosen === null}
            onClick={() => chosen !== null && setUploading(chosen)}
            sx={{ minHeight: 44 }}
          >
            Nahrát dokument
          </Button>
        </Stack>
      </SoftCard>

      <SoftCard>
        <SectionLabel sx={{ mb: 0.75 }}>K objednaným termínům</SectionLabel>
        {requirements === null && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zjišťuji, co termíny vyžadují…</Typography>
        )}
        {requirements !== null && requirements.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {NOTHING_REQUIRED_TEXT}
          </Typography>
        )}
        {missing.map((r) => (
          <Typography
            key={`${r.appointmentId}-${r.templateId}`}
            variant="body2"
            sx={{ color: 'error.main', fontWeight: 600, py: 0.25 }}
          >
            {`Chybí: ${requirementLine(r, date)}`}
            {r.blocksBooking === true ? ' — bez něj nejde objednat' : ''}
          </Typography>
        ))}
        {expiring.map((r) => {
          const until = validityText(r, date);
          return (
            <Typography key={`e-${r.appointmentId}-${r.templateId}`} variant="body2" sx={{ py: 0.25 }}>
              {`Brzy skončí platnost: ${requirementLine(r, date)}${until === null ? '' : ` — ${until}`}`}
            </Typography>
          );
        })}
        {requirements !== null && requirements.length > 0 && missing.length === 0 && expiring.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Doklady k objednaným termínům jsou v pořádku.
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          Zákonné souhlasy (zpracování údajů a souhlas se zákrokem) se potvrzují vždy a jsou v hlavičce karty.
        </Typography>
      </SoftCard>

      <MedicalReports
        documents={documents}
        patientName={patient.firstName}
        onChanged={reloadDocuments}
        onAdd={() => setUploading('report')}
      />

      {uploading !== null && (
        <UploadDocumentDialog
          open
          onClose={() => setUploading(null)}
          patientId={patient.id}
          template={uploading === 'report' ? null : uploading}
          onUploaded={reloadDocuments}
        />
      )}
    </Stack>
  );
}
