/*
 * The price list on screen: the dialog that edits it, and the door that does
 * not swing back.
 *
 * The rows are "položky ceníku" and not "služby". That one word meant two
 * things in this application - a row here, and a calendar on the booking
 * screen, which literally said "Kalendář je služba" - and it misled the owner
 * three times in a day. A činnost is what you schedule; a položka is what you
 * bill.
 *
 * The rules themselves are tested in `serviceForm.test.ts`. What is left for
 * here is whether the screen *uses* them - a form that validates perfectly and
 * sends anyway is the same bug with more code - and the two things only the
 * screen can get wrong: sending a create where an update belongs, and
 * archiving without warning that archiving is final.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ServiceItem } from '../../api/services';

const getAll = vi.fn();
const create = vi.fn();
const update = vi.fn();
const archive = vi.fn();

vi.mock('../../api/services', () => ({
  servicesApi: { getAll, create, update, archive, getById: vi.fn() },
}));

/* The dialog asks which categories require which documents, so it can say out
   loud what the chosen category means. */
const requirementRules = vi.fn();
vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { requirementRules } };
});

/* Retries off: a failing query would otherwise hold a test open for seconds
   and report a timeout instead of the failure. */
const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

const { default: ServiceDialog } = await import('./ServiceDialog');
const { default: Cenik } = await import('../Cenik');

const service = (over: Partial<ServiceItem> = {}): ServiceItem => ({
  id: 's1',
  code: 'KP',
  name: 'Komplexní prohlídka',
  description: 'Vše dohromady',
  category: 'Prohlídka',
  durationMinutes: 60,
  priceCzk: 3000,
  isActive: true,
  ...over,
});

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([service()]);
  create.mockReset().mockResolvedValue(service());
  update.mockReset().mockResolvedValue(service());
  archive.mockReset().mockResolvedValue(undefined);
  requirementRules.mockReset().mockResolvedValue([
    { id: 'r1', templateId: 't1', templateName: 'Výpis ze zdravotní dokumentace',
      serviceCategory: 'Prohlídka' },
  ]);
});

const renderDialog = (props: Partial<React.ComponentProps<typeof ServiceDialog>> = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(withQueries(
    <ServiceDialog
      open
      service={null}
      existing={[service()]}
      onClose={onClose}
      onSaved={onSaved}
      {...props}
    />,
  ));
  return { onClose, onSaved };
};

const fill = async (label: RegExp | string, value: string) => {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, value);
};

describe('the editor', () => {
  it('sends nothing when a rule is broken, and says which', async () => {
    renderDialog();

    /* Name and the numbers left empty on purpose. */
    await fill(/Kód/, 'IB');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Název je povinný.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  /* The duplicate the server would happily accept. */
  it('refuses a code another service already uses', async () => {
    renderDialog();

    await fill(/Kód/, 'KP');
    await fill(/Název/, 'Něco jiného');
    await fill(/Kategorie/, 'Měření');
    await fill(/Trvání/, '30');
    await fill(/Cena/, '900');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Tenhle kód už jedna položka má.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new service with the numbers parsed', async () => {
    const { onSaved } = renderDialog();

    await fill(/Kód/, 'IB');
    await fill(/Název/, 'InBody 770');
    await fill(/Kategorie/, 'Měření');
    await fill(/Trvání/, '15');
    await fill(/Cena/, '800');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      code: 'IB', name: 'InBody 770', durationMinutes: 15, priceCzk: 800,
    });
    expect(update).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  /* Opening an existing service and saving must change it, not add a second
     copy of it. */
  it('updates an existing service rather than creating another', async () => {
    renderDialog({ service: service() });

    await fill(/Cena/, '3500');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toBe('s1');
    expect(update.mock.calls[0][1]).toMatchObject({ code: 'KP', priceCzk: 3500 });
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and says so when saving fails', async () => {
    create.mockRejectedValue(new Error('500'));
    const { onClose } = renderDialog();

    await fill(/Kód/, 'IB');
    await fill(/Název/, 'InBody 770');
    await fill(/Kategorie/, 'Měření');
    await fill(/Trvání/, '15');
    await fill(/Cena/, '800');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText(/Uložení se nepodařilo/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  /* A new service is active by definition and the create route has no such
     field, so offering the switch would be offering a lie. */
  it('offers the active switch only when changing an existing service', () => {
    const { unmount } = render(withQueries(
      <ServiceDialog open service={null} existing={[]} onClose={vi.fn()} onSaved={vi.fn()} />,
    ));
    expect(screen.queryByLabelText(/Aktivní/)).not.toBeInTheDocument();
    unmount();

    render(withQueries(
      <ServiceDialog open service={service()} existing={[service()]} onClose={vi.fn()} onSaved={vi.fn()} />,
    ));
    expect(screen.getByLabelText(/Aktivní/)).toBeInTheDocument();
  });
});

describe('the price list screen', () => {
  /* Twice on purpose: the cards at the top and the table underneath are two
     views of one list, and both are part of this screen. */
  it('lists what the server has, on the cards and in the table', async () => {
    render(withQueries(<Cenik />));
    expect(await screen.findAllByText('Komplexní prohlídka')).toHaveLength(2);
  });

  /*
   * The server accepted a duration of 0, and the card divides price by
   * duration. Without the guard this row reads "Infinity Kč/min".
   */
  it('does not print Infinity for a service of no length', async () => {
    getAll.mockResolvedValue([service({ durationMinutes: 0 })]);

    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kč\/min/)).not.toBeInTheDocument();
  });

  it('shows the price per minute when there is a length', async () => {
    render(withQueries(<Cenik />));
    expect(await screen.findByText('50 Kč/min')).toBeInTheDocument();
  });

  /*
   * Archiving is final: the list route is active-only, so nothing can ever
   * find the row again. Saying that before the click is the whole point of
   * the confirmation.
   */
  it('warns that archiving cannot be undone, and archives only on confirm', async () => {
    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(
      screen.getByRole('button', { name: 'Vyřadit položku Komplexní prohlídka' }),
    );

    expect(await screen.findByText(/vrátit nedá/)).toBeInTheDocument();
    expect(archive).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Vyřadit' }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith('s1'));
  });

  it('archives nothing when the confirmation is dismissed', async () => {
    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(
      screen.getByRole('button', { name: 'Vyřadit položku Komplexní prohlídka' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit' }));

    expect(archive).not.toHaveBeenCalled();
  });

  /* The button that used to be wired to nothing. */
  it('opens the editor from the card', async () => {
    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(
      screen.getByRole('button', { name: 'Upravit položku Komplexní prohlídka' }),
    );

    expect(await screen.findByText('Upravit položku ceníku')).toBeInTheDocument();
  });

  it('opens an empty editor for a new service', async () => {
    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(screen.getByRole('button', { name: /Nová položka/ }));

    /* Scoped to the dialog: the button that opened it carries the same words. */
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Nová položka ceníku')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Kód/)).toHaveValue('');
  });

  it('says so when the list cannot be loaded', async () => {
    getAll.mockRejectedValue(new Error('offline'));

    render(withQueries(<Cenik />));

    expect(await screen.findByText(/Ceník se nepodařilo načíst/)).toBeInTheDocument();
  });
});

/*
 * What the category decides, said where it is chosen.
 *
 * The category stopped being a label: a required document hangs off it, so a
 * služba filed under `Prohlídka` makes the patient bring a výpis. The box is
 * free text and the server matches it exactly, so a plural typed in passing
 * turns the requirement off for every service in that category - and until
 * now no screen said the category decided anything at all.
 *
 * The owner asked, looking straight at this field: "so there's no category
 * here?? but that's where you say what it belongs to?? I don't understand."
 */
describe('what the category tells the patient to bring', () => {
  /*
   * Two services, two categories, so "known" means something. The first
   * version of this passed only `Prohlídka` and then asked about `Měření` -
   * which was correctly reported as a brand new category, and the test was
   * wrong rather than the code.
   */
  const openNew = async () => {
    renderDialog({
      existing: [service(), service({ id: 's2', code: 'IB', name: 'InBody', category: 'Měření' })],
    });
    await screen.findByLabelText(/Kategorie/);
  };

  it('names the document a category requires', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Kategorie/), 'Prohlídka');

    expect(await screen.findByText(/musí\s+doložit/)).toBeInTheDocument();
    expect(screen.getByText('Výpis ze zdravotní dokumentace')).toBeInTheDocument();
  });

  it('says plainly when a category requires nothing', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Kategorie/), 'Měření');

    expect(await screen.findByText(/nemusí nic dokládat/)).toBeInTheDocument();
  });

  /*
   * The case worth the whole thing. One letter, the výpis stops being asked
   * for, and on screen it is indistinguishable from deliberately inventing a
   * category - which the owner is allowed to do.
   */
  it('warns that a mistyped category is a new one, and offers the near miss', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Kategorie/), 'Prohlídky');

    expect(await screen.findByText(/je nová kategorie/)).toBeInTheDocument();
    expect(screen.getByText('Prohlídka')).toBeInTheDocument();
  });

  it('puts the suggested category in the box when it is taken up', async () => {
    await openNew();
    const box = screen.getByLabelText(/Kategorie/);
    await userEvent.type(box, 'Prohlídky');
    await userEvent.click(await screen.findByRole('button', { name: 'Použít' }));

    expect(box).toHaveValue('Prohlídka');
    expect(await screen.findByText(/musí\s+doložit/)).toBeInTheDocument();
  });

  /* Nothing claimed before anything is typed. */
  it('says nothing about an empty box', async () => {
    await openNew();
    expect(screen.queryByText(/je nová kategorie/)).not.toBeInTheDocument();
    expect(screen.queryByText(/musí\s+doložit/)).not.toBeInTheDocument();
  });
});
