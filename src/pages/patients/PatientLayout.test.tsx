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
const checkRequired = vi.fn();
const getConsents = vi.fn();

vi.mock('../../api/patients', () => ({ patientsApi: { getById, getProfile: vi.fn() } }));
vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { getTemplates, getPatientDocuments, checkRequired } };
});
vi.mock('../../api/client', () => ({ default: { get: getConsents } }));

const { default: PatientLayout } =
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
    description: '',
    isActive: true,
    ...over,
  }) as DocumentTemplate;

/* One thing one appointment asks for, the way `/check` answers now. */
const need = (over: Record<string, unknown> = {}) => ({
  templateId: VYPIS,
  templateName: 'Výpis ze zdravotní dokumentace',
  serviceName: 'Sportovní lékařské prohlídky',
  appointmentId: 'a1',
  startUtc: '2026-09-24T08:00:00Z',
  standing: 'Valid',
  ...over,
});

const doc = (
  status: DocumentStatus,
  templateId: string | null = VYPIS,
  reportDate: string | null = null,
): PatientDocument => ({ id: 'd1', templateId, status, reportDate }) as PatientDocument;

beforeEach(() => {
  getById.mockReset().mockResolvedValue({
    id: 'p1', firstName: 'Cesta', lastName: 'Jedna',
    dateOfBirth: '1990-05-15', sex: 'Male', status: 'Active',
  });
  getTemplates.mockReset().mockResolvedValue([template()]);
  getPatientDocuments.mockReset().mockResolvedValue([]);
  checkRequired.mockReset().mockResolvedValue({ allRequiredPresent: true, requirements: [] });
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

/*
 * Three states, where there used to be two and a silence.
 *
 * The card decided this itself until 14. 9. 2026: it filtered templates on
 * `requiredForVisit`, split them on `firstVisitOnly`, and counted a výpis's
 * year with its own copy of the rule. The server then stopped sending both
 * flags - they moved onto the rule, where "only the first time" is one
 * service's decision rather than a property of a document kind - and the
 * filter matched nothing. The section vanished on every patient, with no
 * error. That is what these replace.
 *
 * The requirement is per APPOINTMENT now. Not unioned across every rule: that
 * is the bug the owner had removed two days earlier, when a person booked for
 * a blood draw was told their medical record was missing.
 */
describe('what the appointments ask for', () => {
  it('names the service and the day, not just the document', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: false, requirements: [need({ standing: 'Missing' })],
    });

    renderLayout();

    expect(await screen.findByText(/Chybí doklady k objednaným termínům/)).toBeInTheDocument();
    expect(screen.getByText(/Sportovní lékařské prohlídky/)).toBeInTheDocument();
    expect(screen.getByText(/Výpis ze zdravotní dokumentace/)).toBeInTheDocument();
  });

  it('goes quiet once the server says it is valid', async () => {
    checkRequired.mockResolvedValue({ allRequiredPresent: true, requirements: [need()] });
    getPatientDocuments.mockResolvedValue([doc('SignedOff')]);

    renderLayout();
    await screen.findByText('Cesta Jedna');

    expect(screen.queryByText(/Chybí doklady/)).not.toBeInTheDocument();
    expect(screen.getByText(/jsou v pořádku/)).toBeInTheDocument();
  });

  /*
   * The third state, and the whole reason for the rewrite. No appointment that
   * asks for anything is not "everything is in order" - and for three days
   * both were the same blank space.
   */
  it('says plainly when nothing is asked for at all', async () => {
    checkRequired.mockResolvedValue({ allRequiredPresent: true, requirements: [] });

    renderLayout();

    expect(await screen.findByText(/Nemá objednaný termín/)).toBeInTheDocument();
    expect(screen.queryByText(/Chybí doklady/)).not.toBeInTheDocument();
  });

  /*
   * An unanswered request is not an empty answer. Saying "nothing is required"
   * while the question is still in flight states it of every patient for a
   * moment, including the ones who are missing something.
   */
  it('says neither while the answer is still on its way', async () => {
    checkRequired.mockRejectedValue(new Error('offline'));

    renderLayout();
    await screen.findByText('Cesta Jedna');

    expect(screen.queryByText(/Nemá objednaný termín/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chybí doklady/)).not.toBeInTheDocument();
  });

  /* A rule that refuses rather than warns is a different sentence, because it
     is a different thing to do about it. */
  it('says when the missing document stops the booking', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: false,
      requirements: [need({ standing: 'Missing', blocksBooking: true })],
    });

    renderLayout();

    expect(await screen.findByText(/bez kterého nejde objednat/)).toBeInTheDocument();
  });

  /* It has to follow you into the section, or walking away hides it. */
  it('stays on screen inside the documents section', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: false, requirements: [need({ standing: 'Missing' })],
    });

    renderLayout('/patients/p1/dokumenty');

    expect(await screen.findByText(/Chybí doklady k objednaným termínům/)).toBeInTheDocument();
    expect(screen.getByText('DOKUMENTY')).toBeInTheDocument();
  });

  /*
   * The validity is the server's answer, read out rather than computed. This
   * screen's own copy of "a výpis lasts a year" is gone, and so is the reason
   * three places disagreed about one date.
   */
  it('reads out the date the server gave, and invents none', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: true,
      requirements: [need({ validUntil: '2027-03-04' })],
    });
    getPatientDocuments.mockResolvedValue([doc('SignedOff')]);

    renderLayout();

    expect(await screen.findByText(/platí do 4\. 3\. 2027/)).toBeInTheDocument();
  });

  /*
   * Amber, not red. The document still covers that appointment - the server
   * keeps `allRequiredPresent` true - so this is the cheap moment to renew it,
   * not an alarm. A false alarm is the one people learn to ignore.
   */
  it('keeps a document that is about to run out apart from a missing one', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: true,
      requirements: [need({ standing: 'ExpiringSoon', validUntil: '2026-10-04' })],
    });

    renderLayout();

    expect(await screen.findByText(/Brzy skončí platnost/)).toBeInTheDocument();
    expect(screen.queryByText(/Chybí doklady/)).not.toBeInTheDocument();
    expect(screen.queryByText(/jsou v pořádku/)).not.toBeInTheDocument();
  });

  /*
   * A standing this screen has not met is a name somebody added. Clearing a
   * patient on it would be the quiet failure this rewrite exists to undo.
   */
  it('raises rather than clears on a standing it does not know', async () => {
    checkRequired.mockResolvedValue({
      allRequiredPresent: true, requirements: [need({ standing: 'SomethingNew' })],
    });

    renderLayout();

    expect(await screen.findByText(/Chybí doklady/)).toBeInTheDocument();
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

