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
import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import MedicalReports, { isMedicalReport } from '../../components/documents/MedicalReports';
import DocumentActions from '../../components/documents/DocumentActions';
import UploadDocumentDialog from '../../components/documents/UploadDocumentDialog';
import type { AppointmentRequirementDto, DocumentStatus, DocumentTemplate, PatientDocument } from '../../api/documents';
import { StatusChip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { useIsPhone } from '../../layout/useDevice';
import { MUTED_SX, Shelf, TARGET_SX } from '../../ui/shelf';
import { formatDateOnly } from '../../utils/time';
import {
  NOTHING_REQUIRED_TEXT, expiringSoon, requirementLine, stillMissing, validityText,
} from './paperworkStanding';
import type { PatientContext } from './PatientLayout';
import { ShelfRow } from './ShelfRow';

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, { text: string; tone: ChipTone }> = {
  SignedOff: { text: 'Přijato', tone: 'green' },
  Pending: { text: 'Čeká na kontrolu', tone: 'beige' },
  Expired: { text: 'Prošlé', tone: 'grey' },
  Superseded: { text: 'Nahrazeno', tone: 'grey' },
  Rejected: { text: 'Odmítnuto', tone: 'red' },
  Invalidated: { text: 'Neplatné', tone: 'red' },
};

/** The row's small icon buttons (DocumentActions) are 44 px under 1280. */
const ROW_TARGETS = { '& .MuiIconButton-root': { '@media (max-width: 1279.95px)': { minWidth: 44, minHeight: 44 } } } as const;

export default function PatientDocumentsPage() {
  const { patient, documents, documentsKnown, templates, requirements, reloadDocuments } = useOutletContext<PatientContext>();
  const phone = useIsPhone();
  /* `null` closed, a template for a document filed under it, `'report'` for
     one from another doctor - which carries no template. */
  const [uploading, setUploading] = useState<DocumentTemplate | null | 'report'>(null);
  const [pickedTemplate, setPickedTemplate] = useState('');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const activeTemplates = templates.filter((t) => t.isActive);
  const templateById = new Map(templates.map((t) => [t.id, t] as const));
  const filed = documents
    .filter((d) => !isMedicalReport(d))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
  const reportCount = documents.filter(isMedicalReport).length;
  /* The card reads the documents itself; until they are back an empty list is "not yet", not "none". A context without
     the flag (older callers) counts as read. */
  const known = documentsKnown !== false;

  const date = (iso: string) => formatDateOnly(iso.slice(0, 10));
  const missing = requirements === null ? [] : stillMissing(requirements);
  const expiring = requirements === null ? [] : expiringSoon(requirements);
  const chosen = activeTemplates.find((t) => t.id === pickedTemplate) ?? null;
  const toDo = missing.length + expiring.length;

  /* "Co chybí" -> one press: the upload for exactly the template the appointment asks for. */
  const uploadFor = (r: AppointmentRequirementDto) => {
    const template = activeTemplates.find((t) => t.id === r.templateId);
    return template === undefined ? undefined : () => setUploading(template);
  };
  const focusPicker = () => pickerRef.current?.querySelector<HTMLElement>('[role="combobox"]')?.focus();

  const requirementRow = (r: AppointmentRequirementDto, kind: 'missing' | 'expiring' | 'fine') => {
    const until = validityText(r, date);
    const upload = kind === 'fine' ? undefined : uploadFor(r);
    const detail = kind === 'missing'
      ? (r.blocksBooking === true ? 'Chybí — bez něj nejde objednat' : 'Chybí')
      : `${kind === 'expiring' ? 'Brzy skončí platnost' : 'V pořádku'}${until === null ? '' : ` — ${until}`}`;
    return (
      <ShelfRow
        key={`${kind}-${r.appointmentId}-${r.templateId}`}
        testId="requirement"
        tone={kind === 'missing' ? 'red' : kind === 'expiring' ? 'beige' : undefined}
        title={requirementLine(r, date)}
        detail={detail}
        trailing={upload !== undefined ? (
          <Button size="small" variant={kind === 'missing' ? 'contained' : 'outlined'} startIcon={<CloudUpload />} onClick={upload} sx={TARGET_SX}>
            Nahrát
          </Button>
        ) : undefined}
      />
    );
  };

  const renderRow = (doc: PatientDocument) => {
    const template = doc.templateId === null ? undefined : templateById.get(doc.templateId);
    const status = DOCUMENT_STATUS_LABEL[doc.status] ?? { text: doc.status, tone: 'grey' as ChipTone };
    const validity = doc.expiryAt ? `platí do ${date(doc.expiryAt)}` : null;
    return (
      <ShelfRow
        key={doc.id}
        testId="patient-document"
        title={doc.templateName ?? template?.name ?? 'Dokument'}
        detail={`Šablona: ${template?.name ?? doc.templateName ?? '—'} · nahráno ${date(doc.uploadedAt)}${validity === null ? '' : ` · ${validity}`}`}
        trailing={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...ROW_TARGETS }}>
            <StatusChip tone={status.tone}>{status.text}</StatusChip>
            <DocumentActions
              document={doc}
              patientDocuments={documents}
              patientName={patient.firstName}
              onChanged={reloadDocuments}
            />
          </Box>
        )}
      />
    );
  };

  return (
    <Stack spacing={3} data-shelf-section="dokumenty">
      {/* ── Co chybí: what the booked appointments still ask for, each with its upload ── */}
      <Box>
        <Shelf
          id="missing"
          title="Co chybí"
          hint="K objednaným termínům"
          count={requirements === null ? undefined : toDo}
          countTone={missing.length > 0 ? 'red' : 'beige'}
          layout="list"
          stagger={false}
          loading={requirements === null}
          empty={requirements !== null && requirements.length === 0}
          emptyState={{ text: NOTHING_REQUIRED_TEXT }}
        >
          {missing.map((r) => requirementRow(r, 'missing'))}
          {expiring.map((r) => requirementRow(r, 'expiring'))}
          {requirements !== null && toDo === 0 && requirements.map((r) => requirementRow(r, 'fine'))}
        </Shelf>
        <Typography variant="caption" sx={{ ...MUTED_SX, display: 'block', mt: 1 }}>
          Zákonné souhlasy (zpracování údajů a souhlas se zákrokem) se potvrzují vždy a jsou v hlavičce karty.
        </Typography>
      </Box>

      {/* ── Dokumenty: what the clinic holds, each with the template it is filed under ── */}
      <Shelf
        id="documents"
        title="Dokumenty"
        hint="Vždy se šablonou, pod kterou jsou založené"
        count={known ? filed.length : undefined}
        layout="list"
        stagger={false}
        loading={!known}
        empty={filed.length === 0}
        emptyState={{
          text: 'Pacient zatím nemá žádný uložený dokument.',
          ...(activeTemplates.length > 0 ? { action: { label: 'Vybrat šablonu', onClick: focusPicker } } : {}),
        }}
      >
        {filed.map(renderRow)}
      </Shelf>

      {/* ── Nahrát: a template, then the file ── */}
      <Shelf id="upload" title="Nahrát dokument" layout="board" stagger={false}>
        <Stack
          ref={pickerRef}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ p: 2, alignItems: { sm: 'center' } }}
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
      </Shelf>

      {/* ── Lékařské zprávy: from other doctors, never counted as a required document ── */}
      <Shelf
        id="reports"
        title="Lékařské zprávy"
        hint="Od jiných lékařů, nepočítají se mezi povinné"
        count={known ? reportCount : undefined}
        layout="board"
        stagger={false}
        loading={!known}
        empty={reportCount === 0}
        emptyState={{ text: 'Zatím tu žádná zpráva není.', action: { label: 'Přidat zprávu', onClick: () => setUploading('report') } }}
        controls={reportCount > 0 ? (
          <Button size="small" variant="outlined" onClick={() => setUploading('report')} sx={TARGET_SX}>Přidat zprávu</Button>
        ) : undefined}
      >
        <MedicalReports
          bare
          documents={documents}
          patientName={patient.firstName}
          onChanged={reloadDocuments}
          onAdd={() => setUploading('report')}
        />
      </Shelf>

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
