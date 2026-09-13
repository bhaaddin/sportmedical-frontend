/*
 * One patient's documents, on their own address.
 *
 * Everything on this page is about the patient in the URL: what they still owe
 * the clinic, and what other doctors have written about them. There is no
 * patient picker, because arriving here already answered that question - the
 * screen this replaces began by asking you to find the patient again in a
 * dropdown, having been opened from that patient's own card.
 *
 * The two lists are kept apart on purpose. A required document answers "may
 * this person be seen"; a report from another doctor answers "what else is
 * going on with them". A cardiology report counted as the výpis would let the
 * readiness gate pass somebody whose výpis is missing.
 */
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Divider, Stack, Typography,
} from '@mui/material';
import { Error as ErrorIcon, CloudUpload, Shield } from '@mui/icons-material';
import MedicalReports from '../../components/documents/MedicalReports';
import DocumentActions from '../../components/documents/DocumentActions';
import UploadDocumentDialog from '../../components/documents/UploadDocumentDialog';
import { DOCUMENT_SATISFIES_REQUIREMENT } from '../../api/documents';
import type { DocumentTemplate } from '../../api/documents';
import { requiredRowState } from './requiredDocumentRow';
import type { PatientContext } from './PatientLayout';

export default function PatientDocumentsPage() {
  const { patient, documents, templates, reloadDocuments } = useOutletContext<PatientContext>();
  /* `null` closed, a template for a required document, `'report'` for one from
     another doctor - which carries no template, and that absence is what keeps
     it out of the required-document rules. */
  const [uploading, setUploading] = useState<DocumentTemplate | null | 'report'>(null);

  const required = templates.filter((t) => t.isActive && t.requiredForVisit);

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <Shield sx={{ color: '#0D7377' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Povinné dokumenty
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Co musí pacient doložit, než ho můžete vyšetřit.
          </Typography>
          <Divider sx={{ mb: 1 }} />

          {required.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Žádné povinné dokumenty nejsou nastavené.
            </Typography>
          )}

          {required.map((template) => {
            const filed = documents.find(
              (d) =>
                d.templateId === template.id && d.status === DOCUMENT_SATISFIES_REQUIREMENT,
            );

            const row = requiredRowState(template, filed);

            return (
              <Stack
                key={template.id}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center', py: 1.5, flexWrap: 'wrap',
                  borderBottom: '1px solid', borderColor: 'divider',
                }}
              >
                <Box sx={{ minWidth: 220, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {template.name}
                  </Typography>
                  {/* The sentence that tells somebody at the desk what to ask
                      the patient for. */}
                  {template.description !== '' && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {template.description}
                    </Typography>
                  )}
                </Box>

                {/*
                  * The date, not a verdict, and no green tick. See
                  * `requiredDocumentRow.ts` for both reasons - in short, a
                  * card full of green teaches its reader to stop looking, and
                  * "Hotovo" answers a question nobody has.
                  */}
                {row.tone === 'on-file' ? (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary">{row.text}</Typography>
                    {row.detail !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        {row.detail}
                      </Typography>
                    )}
                  </Box>
                ) : row.tone === 'expiring' ? (
                  /* Amber, and only here: still valid, and this is the cheap
                     moment to replace it - while the patient is in the room. */
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ color: '#ED6C02', fontWeight: 500 }}>
                      {row.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#ED6C02' }}>
                      {row.detail}
                    </Typography>
                  </Box>
                ) : row.tone === 'first-visit' ? (
                  <Chip label={row.text} size="small"
                    sx={{ bgcolor: '#0288D114', color: '#0288D1', fontWeight: 500 }} />
                ) : (
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip icon={<ErrorIcon />} label={row.text} size="small"
                      sx={{ bgcolor: '#D32F2F14', color: '#D32F2F', fontWeight: 500 }} />
                    {row.detail !== undefined && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#D32F2F' }}>
                        {row.detail}
                      </Typography>
                    )}
                  </Box>
                )}

                <Button
                  size="small"
                  variant={filed === undefined ? 'contained' : 'text'}
                  startIcon={<CloudUpload />}
                  onClick={() => setUploading(template)}
                  sx={filed === undefined ? { bgcolor: '#0D7377' } : undefined}
                >
                  {filed === undefined ? 'Nahrát' : 'Nahradit'}
                </Button>

                {filed !== undefined && (
                  <DocumentActions
                    document={filed}
                    patientDocuments={documents}
                    patientName={patient.firstName}
                    onChanged={reloadDocuments}
                  />
                )}
              </Stack>
            );
          })}
        </CardContent>
      </Card>

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
