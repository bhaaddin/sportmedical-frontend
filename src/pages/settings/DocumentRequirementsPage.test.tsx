/*
 * The screen for the rules that decide what a patient has to bring.
 *
 * Until this existed the rules lived only in the database - seeded, never
 * written by anybody at the clinic, and hanging off a price-list category
 * nobody had chosen. Nothing on any screen listed them, so nothing on any
 * screen could be wrong about them either. That is the failure this repository
 * keeps finding: not a broken thing, an invisible one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const listRules = vi.fn();
const addRule = vi.fn();
const removeRule = vi.fn();
const listClinicServices = vi.fn();
const getTemplates = vi.fn();

vi.mock('../../api/documentRequirements', () => ({
  documentRequirementsApi: { list: listRules, add: addRule, remove: removeRule },
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: { list: listClinicServices },
}));
vi.mock('../../api/documents', () => ({
  documentsApi: { getTemplates },
}));

const { default: DocumentRequirementsPage } = await import('./DocumentRequirementsPage');

const svc = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, name, description: '', sortOrder: 0, isActive: true, activities: 3, calendars: 1, ...over });

const tpl = (id: string, name: string, isActive = true) =>
  ({
    id, name, type: 'Vypis', version: 1, fileUrl: '', requiredForVisit: true,
    firstVisitOnly: false, ageGated: false, minimumAge: 0, description: '', isActive,
  });

const rule = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  templateId: 't1',
  templateName: 'Výpis ze zdravotní dokumentace',
  clinicServiceId: 's1',
  serviceName: 'Sportovní lékařské prohlídky',
  serviceExists: true,
  ...over,
});

beforeEach(() => {
  listRules.mockReset().mockResolvedValue([]);
  addRule.mockReset().mockResolvedValue(rule());
  removeRule.mockReset().mockResolvedValue(undefined);
  listClinicServices.mockReset().mockResolvedValue([
    svc('s1', 'Sportovní lékařské prohlídky'),
    svc('s2', 'Sportovní diagnostika'),
  ]);
  getTemplates.mockReset().mockResolvedValue([
    tpl('t1', 'Výpis ze zdravotní dokumentace'),
    tpl('t2', 'Informovaný souhlas'),
  ]);
});

/* Retries off: a failing query would hold the test open and report a timeout
   instead of the failure. */
const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui: ReactNode = <DocumentRequirementsPage />;
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('the list of rules', () => {
  /*
   * Nothing required of anybody is a real state and the one every clinic
   * starts in - and on screen it is the same blank as a request that failed.
   * So it is said out loud.
   */
  it('says out loud when nothing is required of anybody', async () => {
    show();

    expect(await screen.findByText(/Zatím žádné pravidlo/)).toBeInTheDocument();
  });

  it('names the document and the service on each row', async () => {
    listRules.mockResolvedValue([rule()]);
    show();

    expect(await screen.findByText('Výpis ze zdravotní dokumentace')).toBeInTheDocument();
    expect(screen.getByText(/u služby Sportovní lékařské prohlídky/)).toBeInTheDocument();
  });

  /*
   * The rule survives the service it names. It is then in the list, worded
   * exactly like the working ones, and applies to no termín at all - which is
   * the shape nothing else in the application would ever mention.
   */
  it('says when the service a rule points at is gone', async () => {
    listRules.mockResolvedValue([
      rule({ clinicServiceId: null, serviceName: 'Zrušená služba', serviceExists: false }),
    ]);
    show();

    expect(await screen.findByText(/Služba už neexistuje/)).toBeInTheDocument();
  });

  /* A service with no činnosti cannot be booked, so nothing ever carries its
     rules. A different sentence: this is unfinished, not broken. */
  it('says when the service has no činnost to carry the rule', async () => {
    listRules.mockResolvedValue([rule()]);
    listClinicServices.mockResolvedValue([svc('s1', 'Sportovní lékařské prohlídky', { activities: 0 })]);
    show();

    expect(await screen.findByText(/zatím nemá na co/)).toBeInTheDocument();
  });

  it('says nothing about a rule whose service is there and used', async () => {
    listRules.mockResolvedValue([rule()]);
    show();

    await screen.findByText('Výpis ze zdravotní dokumentace');
    expect(screen.queryByText(/Služba už neexistuje/)).not.toBeInTheDocument();
    expect(screen.queryByText(/zatím nemá na co/)).not.toBeInTheDocument();
  });
});

describe('writing a rule', () => {
  it('sends the document and the service that were chosen', async () => {
    show();
    await screen.findByLabelText(/Dokument/);

    await userEvent.click(screen.getByLabelText(/Dokument/));
    await userEvent.click(await screen.findByRole('option', { name: 'Informovaný souhlas' }));
    await userEvent.click(screen.getByLabelText(/Služba/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sportovní diagnostika' }));
    await userEvent.click(screen.getByRole('button', { name: /Přidat pravidlo/i }));

    await waitFor(() => expect(addRule).toHaveBeenCalledWith('t2', 's2'));
  });

  it('waits until both halves are chosen', async () => {
    show();
    await screen.findByLabelText(/Dokument/);

    expect(screen.getByRole('button', { name: /Přidat pravidlo/i })).toBeDisabled();

    await userEvent.click(screen.getByLabelText(/Dokument/));
    await userEvent.click(await screen.findByRole('option', { name: 'Informovaný souhlas' }));
    expect(screen.getByRole('button', { name: /Přidat pravidlo/i })).toBeDisabled();
    expect(addRule).not.toHaveBeenCalled();
  });

  /*
   * The server answers a repeat by handing back the rule already there, so the
   * click is not destructive - it just appears to do something and does not.
   * Saying so beforehand is the whole point of the check.
   */
  it('says so, and stops, when the pair is already in the list', async () => {
    listRules.mockResolvedValue([rule()]);
    show();
    await screen.findByText('Výpis ze zdravotní dokumentace');

    await userEvent.click(screen.getByLabelText(/Dokument/));
    await userEvent.click(await screen.findByRole('option', { name: 'Výpis ze zdravotní dokumentace' }));
    await userEvent.click(screen.getByLabelText(/Služba/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sportovní lékařské prohlídky' }));

    expect(await screen.findByText(/už v seznamu je/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přidat pravidlo/i })).toBeDisabled();
  });

  /* A retired service is not something to write a new rule against. */
  it('offers only the services still in use', async () => {
    listClinicServices.mockResolvedValue([
      svc('s1', 'Sportovní lékařské prohlídky'),
      svc('s9', 'Zrušená služba', { isActive: false }),
    ]);
    show();
    await screen.findByLabelText(/Služba/);

    await userEvent.click(screen.getByLabelText(/Služba/));
    expect(await screen.findByRole('option', { name: 'Sportovní lékařské prohlídky' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Zrušená služba' })).not.toBeInTheDocument();
  });

  /* The state a new clinic is in: two empty dropdowns above a button that
     will not move, and nothing saying where to go. */
  it('says where to go when no service exists yet', async () => {
    listClinicServices.mockResolvedValue([]);
    show();

    expect(await screen.findByText(/Nejdřív ji založte v Nastavení/)).toBeInTheDocument();
  });
});

describe('removing a rule', () => {
  it('deletes the one whose row was clicked', async () => {
    listRules.mockResolvedValue([
      rule(),
      rule({ id: 'r2', templateId: 't2', templateName: 'Informovaný souhlas' }),
    ]);
    show();

    await userEvent.click(
      await screen.findByRole('button', { name: /Smazat pravidlo Informovaný souhlas/i }),
    );

    await waitFor(() => expect(removeRule).toHaveBeenCalledWith('r2'));
  });
});
