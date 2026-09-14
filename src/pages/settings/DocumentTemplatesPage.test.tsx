/*
 * The screen the owner was missing when he asked why his deleted documents
 * were back.
 *
 * They were never deleted - the API has no DELETE for a template, and all four
 * share one seed timestamp. What he wanted was a list holding only the výpis,
 * and since 14. 9. 2026 that is a switch rather than a deletion: every picker
 * in the application already hides an inactive template.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getTemplates = vi.fn();
const updateTemplate = vi.fn();
const listRules = vi.fn();

vi.mock('../../api/documents', () => ({
  documentsApi: { getTemplates, updateTemplate },
}));
vi.mock('../../api/documentRequirements', () => ({
  documentRequirementsApi: { list: listRules },
}));

const { default: DocumentTemplatesPage } = await import('./DocumentTemplatesPage');

const tpl = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name: 'Výpis ze zdravotní dokumentace',
  type: 'Vypis',
  version: 1,
  fileUrl: '',
  description: 'Výpis od předchozího lékaře',
  isActive: true,
  ...over,
});

const rule = (over: Record<string, unknown> = {}) => ({
  id: 'r1', templateId: 't1', templateName: 'Výpis ze zdravotní dokumentace',
  clinicServiceId: 's1', serviceName: 'Sportovní lékařské prohlídky',
  serviceExists: true, validityMonths: 12, warnDaysBefore: 30,
  firstVisitOnly: false, blocksBooking: false, ...over,
});

beforeEach(() => {
  getTemplates.mockReset().mockResolvedValue([tpl()]);
  updateTemplate.mockReset().mockImplementation(async () => tpl());
  listRules.mockReset().mockResolvedValue([]);
});

const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui: ReactNode = <DocumentTemplatesPage />;
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const openEdit = async () => {
  show();
  await userEvent.click(await screen.findByRole('button', { name: /Upravit dokument/i }));
  await screen.findByLabelText(/Název/);
};

describe('the list', () => {
  it('names each kind of document the clinic keeps', async () => {
    show();

    expect(await screen.findByText('Výpis ze zdravotní dokumentace')).toBeInTheDocument();
    expect(screen.getByText('Výpis od předchozího lékaře')).toBeInTheDocument();
  });

  /* Off, not deleted - and the reason is worth saying once, because deleting
     the kind would leave every filed document nameless. */
  it('says out loud that nothing here gets deleted', async () => {
    show();

    expect(await screen.findByText(/nemaže, jen vypíná/)).toBeInTheDocument();
  });

  it('marks the ones that are switched off', async () => {
    getTemplates.mockResolvedValue([tpl({ isActive: false })]);
    show();

    expect(await screen.findByText('Vypnuto')).toBeInTheDocument();
  });

  it('says how many rules require it', async () => {
    listRules.mockResolvedValue([rule()]);
    show();

    expect(await screen.findByText(/1 pravidlo ho vyžaduje/)).toBeInTheDocument();
  });
});

describe('the sentence that outlived its rule', () => {
  /*
   * The owner reported this as an error on 13. 9. and it stayed live for a
   * day because `/api/documents/templates` was `GET` only. This screen is the
   * first place it can be corrected.
   */
  it('points at a description still claiming the cancelled rule', async () => {
    getTemplates.mockResolvedValue([tpl({
      description: 'Výpis od předchozího lékaře (vyžaduje se při první návštěvě)',
    })]);
    show();

    expect(await screen.findByText(/To pravidlo už neplatí/)).toBeInTheDocument();
  });

  /* Pointed at, never rewritten on his behalf. */
  it('leaves the text for him to change', async () => {
    getTemplates.mockResolvedValue([tpl({
      description: 'Výpis od předchozího lékaře (vyžaduje se při první návštěvě)',
    })]);
    show();

    await screen.findByText(/To pravidlo už neplatí/);
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  it('says nothing about a description that does not claim it', async () => {
    show();

    await screen.findByText('Výpis ze zdravotní dokumentace');
    expect(screen.queryByText(/To pravidlo už neplatí/)).not.toBeInTheDocument();
  });
});

describe('changing one', () => {
  it('opens with what the template actually says', async () => {
    await openEdit();

    expect(screen.getByLabelText(/Název/)).toHaveValue('Výpis ze zdravotní dokumentace');
    expect(screen.getByLabelText(/Popis/)).toHaveValue('Výpis od předchozího lékaře');
  });

  /* `PUT` takes all three whatever moved, so a save is the whole template. */
  it('sends all three, not just the one that changed', async () => {
    await openEdit();

    await userEvent.clear(screen.getByLabelText(/Popis/));
    await userEvent.type(screen.getByLabelText(/Popis/), 'Nový popis');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateTemplate).toHaveBeenCalled());
    expect(updateTemplate.mock.calls[0][0]).toBe('t1');
    expect(updateTemplate.mock.calls[0][1]).toEqual({
      name: 'Výpis ze zdravotní dokumentace',
      description: 'Nový popis',
      isActive: true,
    });
  });

  /* A save that changes nothing is still a write in the log and a row
     somebody has to wonder about later. */
  it('holds the save shut until something moves', async () => {
    await openEdit();

    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
  });

  it('holds it shut on an empty name, and says why', async () => {
    await openEdit();

    await userEvent.clear(screen.getByLabelText(/Název/));

    expect(await screen.findByText(/Nesmí zůstat prázdný/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
  });
});

describe('switching one off', () => {
  /* This is what he asked for: the picker holding only the výpis. */
  it('sends it off', async () => {
    await openEdit();

    await userEvent.click(screen.getByLabelText(/Používá se/));
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateTemplate).toHaveBeenCalled());
    expect(updateTemplate.mock.calls[0][1]).toMatchObject({ isActive: false });
  });

  it('says what will happen before it happens', async () => {
    await openEdit();

    await userEvent.click(screen.getByLabelText(/Používá se/));

    /* The dialog's own sentence, not the page banner above the list - both
       say "zmizí ze všech nabídek", and matching that would pass on the
       banner alone whether the dialog warned or not. */
    expect(await screen.findByText(/nepůjde ho nahrát/)).toBeInTheDocument();
  });

  /*
   * The consequence that reaches another screen. A rule pointing at a
   * switched-off document stays in its list with nothing left to ask for, and
   * nothing over there would say why.
   */
  it('warns when a rule would be left asking for nothing', async () => {
    listRules.mockResolvedValue([rule()]);
    await openEdit();

    await userEvent.click(screen.getByLabelText(/Používá se/));

    expect(await screen.findByText(/nebude si už mít co vyžádat/)).toBeInTheDocument();
  });

  /*
   * Editing one that is already off is not switching it off.
   *
   * Without the second half of the guard, renaming a template that has been
   * out of use for months would announce a consequence that happened long ago
   * - and this was the one mutation the first version of these tests missed,
   * because every case here either switched it off or switched it on.
   */
  it('says nothing when it was already off and stays off', async () => {
    getTemplates.mockResolvedValue([tpl({ isActive: false })]);
    await openEdit();

    await userEvent.type(screen.getByLabelText(/Název/), ' II');

    expect(screen.queryByText(/nepůjde ho nahrát/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeEnabled();
  });

  /* Switching one back on is not a warning-worthy act. */
  it('says nothing of the sort when switching one back on', async () => {
    getTemplates.mockResolvedValue([tpl({ isActive: false })]);
    await openEdit();

    await userEvent.click(screen.getByLabelText(/Vypnuto/));

    expect(screen.queryByText(/nepůjde ho nahrát/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeEnabled();
  });
});
