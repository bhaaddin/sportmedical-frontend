/*
 * "Chybí: Výpis ze zdravotní dokumentace" - the banner that never went out.
 *
 * This card decided whether a required document was on file by testing
 * `status === 'Signed' || status === 'Active'`. The server's `DocumentStatus`
 * is `Pending | SignedOff | Expired | Superseded | Rejected`; neither of those
 * two strings has ever been sent, and neither is in the domain enum. So the
 * test could not pass for any document, for any patient, ever - the warning
 * stayed on a card whose výpis was uploaded and signed, and the only way to
 * clear it was to have no requirement at all.
 *
 * Found by walking one patient end to end rather than by reading: register,
 * approve, upload, sign - and the banner did not move, while the server's own
 * summary flipped `hasVypis` to true on the signature. Two things claiming to
 * answer the same question, disagreeing.
 *
 * Every case below was run against the running API first; the strings here are
 * the ones that came back on the wire.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { DocumentStatus } from '../api/documents';

const getById = vi.fn();
const getProfile = vi.fn();
const getByPatient = vi.fn();
const getPatientDocuments = vi.fn();
const getTemplates = vi.fn();

vi.mock('../api/patients', () => ({ patientsApi: { getById, getProfile } }));
vi.mock('../api/diagnostics', () => ({ diagnosticsApi: { getByPatient, downloadPdf: vi.fn() } }));
/* A child with its own calls; this test is about the banner, not consents. */
vi.mock('../components/ConsentManager', () => ({ ConsentManager: () => null }));

vi.mock('../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../api/documents')>('../api/documents');
  return { ...actual, documentsApi: { getPatientDocuments, getTemplates } };
});

const { default: PatientDetails } = await import('./PatientDetails');

const VYPIS_TEMPLATE = '01a0833e-85cb-77a8-9f15-f84c35bf0bd7';

const template = {
  id: VYPIS_TEMPLATE,
  name: 'Výpis ze zdravotní dokumentace',
  type: 'Vypis',
  version: 1,
  fileUrl: '',
  requiredForVisit: true,
  firstVisitOnly: true,
  ageGated: false,
  minimumAge: 0,
  description: '',
  isActive: true,
};

const doc = (status: DocumentStatus) => ({
  id: 'd1',
  patientId: 'p1',
  templateId: VYPIS_TEMPLATE,
  uploadedAt: '2026-09-12T14:24:19Z',
  signedAt: status === 'SignedOff' ? '2026-09-12T14:24:57Z' : null,
  expiryAt: null,
  filePath: 'x.pdf',
  status,
});

beforeEach(() => {
  getById.mockReset().mockResolvedValue({
    id: 'p1', firstName: 'Cesta', lastName: 'Jedna',
    dateOfBirth: '1990-05-15', sex: 'Male', status: 'Active',
  });
  getProfile.mockReset().mockResolvedValue({});
  getByPatient.mockReset().mockResolvedValue([]);
  getTemplates.mockReset().mockResolvedValue([template]);
  getPatientDocuments.mockReset().mockResolvedValue([]);
});

const renderCard = () =>
  render(
    <MemoryRouter initialEntries={['/patients/p1']}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetails />} />
      </Routes>
    </MemoryRouter>,
  );

const banner = () => screen.queryByText(/Chybí: Výpis ze zdravotní dokumentace/);

describe('the missing-paperwork banner', () => {
  it('warns when the required document is not on file at all', async () => {
    renderCard();
    expect(await screen.findByText(/Chybí: Výpis/)).toBeInTheDocument();
  });

  /* The case that was broken: uploaded, signed, and still warning. */
  it('goes out once the document is signed off', async () => {
    getPatientDocuments.mockResolvedValue([doc('SignedOff')]);

    renderCard();
    await screen.findByText('Cesta Jedna');

    expect(banner()).not.toBeInTheDocument();
  });

  it('keeps warning while the document is only uploaded, not signed', async () => {
    getPatientDocuments.mockResolvedValue([doc('Pending')]);

    renderCard();
    expect(await screen.findByText(/Chybí: Výpis/)).toBeInTheDocument();
  });

  /*
   * Expired and Rejected plainly do not satisfy a requirement. Superseded
   * means a newer document exists - and that newer one carries its own status
   * in the same list, so this one must not stand in for it.
   */
  it.each<DocumentStatus>(['Expired', 'Superseded', 'Rejected'])(
    'keeps warning for a document that is %s',
    async (status) => {
      getPatientDocuments.mockResolvedValue([doc(status)]);

      renderCard();
      expect(await screen.findByText(/Chybí: Výpis/)).toBeInTheDocument();
    },
  );

  /*
   * The requirement is per template. A signed document of some other kind used
   * to satisfy every requirement at once - that was fixed before this, and
   * this holds it fixed.
   */
  it('does not let a different signed document stand in for the výpis', async () => {
    getPatientDocuments.mockResolvedValue([
      { ...doc('SignedOff'), templateId: 'some-other-template' },
    ]);

    renderCard();
    expect(await screen.findByText(/Chybí: Výpis/)).toBeInTheDocument();
  });
});
