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
    await fill(/Cena/, '900');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Tenhle kód už jedna položka má.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a new service with the numbers parsed', async () => {
    const { onSaved } = renderDialog();

    await fill(/Kód/, 'IB');
    await fill(/Název/, 'InBody 770');
    await fill(/Cena/, '800');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      code: 'IB', name: 'InBody 770', priceCzk: 800,
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
    await fill(/Cena/, '800');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText(/Uložení se nepodařilo/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * "Ještě se prodává", not "nabízí se pacientům".
   *
   * This is the price list and no patient ever sees it. Whether a patient can
   * pick something when booking is `isPubliclyBookable`, and that lives on the
   * činnost - the same one word meaning two things that misled the owner three
   * times in a day.
   */
  it('says the switch is about selling, not about what a patient sees', () => {
    render(withQueries(
      <ServiceDialog open service={service()} existing={[service()]} onClose={vi.fn()} onSaved={vi.fn()} />,
    ));
    expect(screen.getByLabelText(/ještě se prodává/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/nabízí se pacientům/i)).not.toBeInTheDocument();
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
   * The "Infinity Kč/min" case, kept as a case even though the arithmetic is
   * gone: a row saved with a duration of 0 is still in the data, and what it
   * must never do is print anything about it.
   */
  it('says nothing at all about a row with no length', async () => {
    getAll.mockResolvedValue([service({ durationMinutes: 0 })]);

    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  /*
   * Neither a length nor a Kč/min. The dialog stopped offering the field -
   * booking measured that the price-list duration was read nowhere but in a
   * comparison against the činnost's own, and removed that - so a number
   * somebody can see but no longer change would be worse than either.
   */
  it('shows no length and no price per minute', async () => {
    render(withQueries(<Cenik />));
    await screen.findAllByText('Komplexní prohlídka');

    expect(screen.queryByText(/Kč\/min/)).not.toBeInTheDocument();
    expect(screen.queryByText('60 min')).not.toBeInTheDocument();
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
 * An empty price list is the normal state now.
 *
 * The eight demo rows were a seed the owner never wrote. They are gone from
 * the database and from the code, so nothing reappears, and a new
 * installation opens on nothing.
 *
 * The screen used to answer that with "V ceníku nic takového není" - the
 * search-result sentence - over three zeroes and a search box, which is a
 * question nobody asked and furniture over nothing.
 */
describe('a price list with nothing in it', () => {
  beforeEach(() => { getAll.mockResolvedValue([]); });

  it('says it is empty and offers the first step', async () => {
    render(withQueries(<Cenik />));

    expect(await screen.findByText('Ceník je prázdný')).toBeInTheDocument();
    expect(screen.getByText(/Přidejte první položku/)).toBeInTheDocument();
  });

  it('does not answer with the words for a failed search', async () => {
    render(withQueries(<Cenik />));
    await screen.findByText('Ceník je prázdný');

    expect(screen.queryByText(/nic takového není/)).not.toBeInTheDocument();
  });

  /* Three zeroes and a search box over nothing. */
  it('shows no totals and nothing to search', async () => {
    render(withQueries(<Cenik />));
    await screen.findByText('Ceník je prázdný');

    expect(screen.queryByText('Celkem položek')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Hledat v ceníku/)).not.toBeInTheDocument();
  });

  /* And the totals come back with the first row, so this is not "hidden
     forever" by accident. */
  it('shows them again once there is something', async () => {
    getAll.mockResolvedValue([service()]);
    render(withQueries(<Cenik />));

    expect(await screen.findByText('Celkem položek')).toBeInTheDocument();
    expect(screen.queryByText('Ceník je prázdný')).not.toBeInTheDocument();
  });
});

/*
 * The server stores no category for a price-list row and never returns one,
 * so the screen neither asks for it nor sends it.
 */
describe('no category', () => {
  it('lists a row exactly as the API sends it', async () => {
    render(withQueries(<Cenik />));

    expect((await screen.findAllByText('Komplexní prohlídka')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Kategorie')).not.toBeInTheDocument();
  });

  it('neither asks for a category nor sends one', async () => {
    renderDialog();
    expect(screen.queryByLabelText(/Kategorie/)).not.toBeInTheDocument();

    await fill(/Kód/, 'IB');
    await fill(/Název/, 'InBody 770');
    await fill(/Cena/, '800');
    await userEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).not.toHaveProperty('category');
  });
});
