/*
 * The frame around one patient: which section is open, and what is still
 * missing.
 *
 * These tests moved here with the banner they guard. It used to live on the
 * overview; it belongs on the frame, because somebody who has walked into the
 * documents section should not lose sight of what the patient still owes.
 *
 * The history is worth keeping with them. The banner decided a requirement was
 * met by testing `status === 'Signed' || 'Active'`, and the server's states are
 * `Pending | SignedOff | Expired | Superseded | Rejected`. Neither string has
 * ever existed, so the test could not pass for any document, for any patient -
 * "Chybí: Výpis" stayed on a card whose výpis was uploaded and signed. A
 * warning that is always on is indistinguishable from one that is stuck.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { DocumentStatus, DocumentTemplate, PatientDocument } from '../../api/documents';

const getById = vi.fn();
const getTemplates = vi.fn();
const getPatientDocuments = vi.fn();
const getConsents = vi.fn();

vi.mock('../../api/patients', () => ({ patientsApi: { getById, getProfile: vi.fn() } }));
vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { getTemplates, getPatientDocuments } };
});
vi.mock('../../api/client', () => ({ default: { get: getConsents } }));

const { default: PatientLayout, missingRequired, activeSection } =
  await import('./PatientLayout');
const { PATIENT_SECTIONS, patientInPath, sectionPath } = await import('./sections');

const VYPIS = 'tmpl-vypis';

const template = (over: Partial<DocumentTemplate> = {}): DocumentTemplate =>
  ({
    id: VYPIS,
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
    ...over,
  }) as DocumentTemplate;

const doc = (status: DocumentStatus, templateId: string | null = VYPIS): PatientDocument =>
  ({ id: 'd1', templateId, status }) as PatientDocument;

beforeEach(() => {
  getById.mockReset().mockResolvedValue({
    id: 'p1', firstName: 'Cesta', lastName: 'Jedna',
    dateOfBirth: '1990-05-15', sex: 'Male', status: 'Active',
  });
  getTemplates.mockReset().mockResolvedValue([template()]);
  getPatientDocuments.mockReset().mockResolvedValue([]);
  getConsents.mockReset().mockResolvedValue({ data: [] });
});

const renderLayout = (path = '/patients/p1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientLayout />}>
          <Route index element={<div>PŘEHLED</div>} />
          <Route path="dokumenty" element={<div>DOKUMENTY</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('what is still missing', () => {
  it('names a required document that is not on file', () => {
    expect(missingRequired([template()], []).map((t) => t.name)).toEqual([
      'Výpis ze zdravotní dokumentace',
    ]);
  });

  /* The case that was broken: uploaded, signed, and still warning. */
  it('is satisfied by a document that is signed off', () => {
    expect(missingRequired([template()], [doc('SignedOff')])).toHaveLength(0);
  });

  it.each<DocumentStatus>(['Pending', 'Expired', 'Superseded', 'Rejected'])(
    'is not satisfied by a document that is %s',
    (status) => {
      expect(missingRequired([template()], [doc(status)])).toHaveLength(1);
    },
  );

  /* A cardiology report carries no template, so it can satisfy nothing. */
  it('is not satisfied by a document belonging to no template', () => {
    expect(missingRequired([template()], [doc('SignedOff', null)])).toHaveLength(1);
  });

  it('is not satisfied by a signed document of some other kind', () => {
    expect(missingRequired([template()], [doc('SignedOff', 'other-template')])).toHaveLength(1);
  });

  it('ignores templates that are not required, and inactive ones', () => {
    expect(missingRequired([template({ requiredForVisit: false })], [])).toHaveLength(0);
    expect(missingRequired([template({ isActive: false })], [])).toHaveLength(0);
  });
});

describe('the banner on screen', () => {
  it('warns when the výpis is missing', async () => {
    renderLayout();
    expect(await screen.findByText(/Chybí: Výpis/)).toBeInTheDocument();
  });

  it('goes out once it is signed off', async () => {
    getPatientDocuments.mockResolvedValue([doc('SignedOff')]);

    renderLayout();
    await screen.findByText('Cesta Jedna');

    expect(screen.queryByText(/Chybí:/)).not.toBeInTheDocument();
  });

  /* It has to follow you into the section, or walking away hides it. */
  it('stays on screen inside the documents section', async () => {
    renderLayout('/patients/p1/dokumenty');

    expect(await screen.findByText(/Chybí: Výpis/)).toBeInTheDocument();
    expect(screen.getByText('DOKUMENTY')).toBeInTheDocument();
  });
});

describe('the sections', () => {
  it('opens the overview by default', async () => {
    renderLayout();
    expect(await screen.findByText('PŘEHLED')).toBeInTheDocument();
  });

  /*
   * Each section has its own address. That is the difference between a page
   * and a panel that slides over a list: this can be linked to, opened in a
   * second tab, and survives a reload.
   */
  it('opens the documents section straight from its address', async () => {
    renderLayout('/patients/p1/dokumenty');
    expect(await screen.findByText('DOKUMENTY')).toBeInTheDocument();
    expect(screen.queryByText('PŘEHLED')).not.toBeInTheDocument();
  });

  /*
   * The sidebar draws these, not this page - inside a patient the
   * application's own menu steps aside. So what is worth holding here is that
   * every section has an address under the patient, which is what makes it a
   * page rather than a panel.
   */
  it('gives every section an address under the patient', () => {
    for (const section of PATIENT_SECTIONS) {
      expect(sectionPath('p1', section)).toMatch(/^\/patients\/p1/);
    }
    expect(sectionPath('p1', PATIENT_SECTIONS[0])).toBe('/patients/p1');
  });

  /* Which addresses put the sidebar inside one person, and which leave it as
     the application's. */
  it('knows the list and a new registration are inside nobody', () => {
    expect(patientInPath('/patients/p1')).toBe('p1');
    expect(patientInPath('/patients/p1/dokumenty')).toBe('p1');
    expect(patientInPath('/patients')).toBeNull();
    expect(patientInPath('/patients/register')).toBeNull();
    expect(patientInPath('/dnes')).toBeNull();
  });

  it('works out which section an address is in', () => {
    expect(activeSection('/patients/p1', 'p1')).toBe('prehled');
    expect(activeSection('/patients/p1/dokumenty', 'p1')).toBe('dokumenty');
    /* Anything unrecognised is the overview rather than nothing, so no address
       can leave every tab unselected. */
    expect(activeSection('/patients/p1/neznama', 'p1')).toBe('prehled');
  });

  it('has a tab for every section and no duplicates', () => {
    const ids = PATIENT_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('a patient who is not there', () => {
  /* A blank frame with tabs would look like a patient with no data. */
  it('says so rather than drawing an empty patient', async () => {
    getById.mockRejectedValue(new Error('404'));

    renderLayout();

    expect(await screen.findByText(/Tenhle pacient neexistuje/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
