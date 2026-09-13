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
import { CheckCircle, Error as ErrorIcon, CloudUpload, Shield } from '@mui/icons-material';
import MedicalReports from '../../components/documents/MedicalReports';
import DocumentActions from '../../components/documents/DocumentActions';
import UploadDocumentDialog from '../../components/documents/UploadDocumentDialog';
import { DOCUMENT_SATISFIES_REQUIREMENT } from '../../api/documents';
import type { DocumentTemplate } from '../../api/documents';
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
                  * Three states, not two. A first-visit document that is not
                  * on file is not "Chybí" - measured against the server, a
                  * returning patient with no výpis has nothing missing at all
                  * (`check?isFirstVisit=false` -> allRequiredPresent). Red
                  * here while the banner above says "Při první návštěvě je
                  * potřeba" would be the same screen saying two things about
                  * one document, and the red one would be the wrong one.
                  */}
                {filed !== undefined ? (
                  <Chip icon={<CheckCircle />} label="Hotovo" size="small"
                    sx={{ bgcolor: '#2E7D3214', color: '#2E7D32', fontWeight: 500 }} />
                ) : template.firstVisitOnly ? (
                  <Chip label="Při 1. návštěvě" size="small"
                    sx={{ bgcolor: '#0288D114', color: '#0288D1', fontWeight: 500 }} />
                ) : (
                  <Chip icon={<ErrorIcon />} label="Chybí" size="small"
                    sx={{ bgcolor: '#D32F2F14', color: '#D32F2F', fontWeight: 500 }} />
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
