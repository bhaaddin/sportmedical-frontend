/*
 * Posudky on the patient card: listed from the API with the result in Czech,
 * issued through the dialog only by somebody with documents.manage, refused
 * in the browser for what the server would refuse anyway (a restriction-less
 * "fit with restrictions"), and the PDF fetched from the server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const list = vi.fn();
const issue = vi.fn();
const pdf = vi.fn();

vi.mock('../../api/posudky', async () => {
  const actual = await vi.importActual<typeof import('../../api/posudky')>('../../api/posudky');
  return { ...actual, posudkyApi: { list, issue, pdf } };
});

const outletContext = { patient: { id: 'p1', firstName: 'Řehoř', lastName: 'Šťastný' } };
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useOutletContext: () => outletContext };
});

const { default: PatientPosudkyPage } = await import('./PatientPosudkyPage');
const { defaultValidUntil } = await import('../../api/posudky');

const posudek = (over: Record<string, unknown> = {}) => ({
  id: 'x1',
  patientId: 'p1',
  type: 'ZakladniProhlidka',
  typeText: 'Základní prohlídka',
  result: 'FitWithRestrictions',
  resultText: 'způsobilý s omezením',
  restrictions: 'Bez kontaktních sportů 6 týdnů.',
  sport: 'Fotbal',
  club: 'SK Slavia',
  reportDate: '2026-09-26',
  validUntil: '2027-09-26',
  isValidToday: true,
  practitioner: 'MUDr. Alena Horská',
  note: null,
  createdAt: '2026-09-26T08:00:00Z',
  ...over,
});

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'documents.view', 'documents.manage']));
  list.mockReset().mockResolvedValue([posudek()]);
  issue.mockReset().mockResolvedValue(posudek({ id: 'x2' }));
  pdf.mockReset();
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PatientPosudkyPage />
    </QueryClientProvider>,
  );

describe('the list', () => {
  it('shows each certificate with its result, doctor and validity', async () => {
    renderPage();

    expect(await screen.findByText('Základní prohlídka · Fotbal (SK Slavia)')).toBeInTheDocument();
    expect(screen.getByText('způsobilý s omezením')).toBeInTheDocument();
    expect(screen.getByText(/MUDr. Alena Horská/)).toBeInTheDocument();
    expect(screen.getByText(/platí do 26. 9. 2027/)).toBeInTheDocument();
    expect(screen.getByText('Omezení: Bez kontaktních sportů 6 týdnů.')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('p1');
  });

  it('marks a certificate whose validity has ended', async () => {
    list.mockResolvedValue([posudek({ isValidToday: false, validUntil: '2025-01-01' })]);
    renderPage();

    expect(await screen.findByText('Platnost skončila')).toBeInTheDocument();
  });

  it('says so when there is none', async () => {
    list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Pacient zatím nemá žádný posudek.')).toBeInTheDocument();
  });
});

describe('issuing', () => {
  it('is not offered without documents.manage', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'documents.view']));
    renderPage();

    await screen.findByText('způsobilý s omezením');
    expect(screen.queryByRole('button', { name: 'Vystavit posudek' })).not.toBeInTheDocument();
  });

  it('refuses a restriction-less "fit with restrictions" before the server has to', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Vystavit posudek' }));

    await user.type(screen.getByLabelText(/Sport \/ činnost/), 'Fotbal');
    await user.click(screen.getByLabelText(/Výsledek/));
    await user.click(await screen.findByRole('option', { name: 'Způsobilý s omezením' }));
    const buttons = screen.getAllByRole('button', { name: 'Vystavit posudek' });
    await user.click(buttons[buttons.length - 1]);

    expect(await screen.findByText('U výsledku „způsobilý s omezením“ napište, jaké omezení platí.')).toBeInTheDocument();
    expect(issue).not.toHaveBeenCalled();
  });

  it('sends what the doctor filled in and reloads the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Vystavit posudek' }));

    await user.type(screen.getByLabelText(/Sport \/ činnost/), 'Hokej');
    await user.type(screen.getByLabelText(/Klub/), 'HC Kladno');
    const buttons = screen.getAllByRole('button', { name: 'Vystavit posudek' });
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(issue).toHaveBeenCalledWith('p1', {
      type: 'ZakladniProhlidka',
      result: 'Fit',
      restrictions: undefined,
      sport: 'Hokej',
      club: 'HC Kladno',
      validUntil: defaultValidUntil(),
      note: undefined,
    }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});

describe('the PDF', () => {
  it('is fetched from the server for the row', async () => {
    pdf.mockResolvedValue({ blob: new Blob(['%PDF']), fileName: 'posudek-stastny-rehor-20260926.pdf' });
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'PDF' }));

    await waitFor(() => expect(pdf).toHaveBeenCalledWith('p1', 'x1'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });
});

describe('defaultValidUntil', () => {
  it('is one year on, as yyyy-mm-dd', () => {
    expect(defaultValidUntil(new Date(2026, 8, 26))).toBe('2027-09-26');
  });
});
