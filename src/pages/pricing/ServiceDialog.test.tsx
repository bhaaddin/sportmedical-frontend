/*
 * The price list on screen: the dialog that edits it, and the door that does
 * not swing back.
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
import type { ServiceItem } from '../../api/services';

const getAll = vi.fn();
const create = vi.fn();
const update = vi.fn();
const archive = vi.fn();

vi.mock('../../api/services', () => ({
  servicesApi: { getAll, create, update, archive, getById: vi.fn() },
}));

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
});

const renderDialog = (props: Partial<React.ComponentProps<typeof ServiceDialog>> = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <ServiceDialog
      open
      service={null}
      existing={[service()]}
      onClose={onClose}
      onSaved={onSaved}
      {...props}
    />,
  );
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

    expect(await screen.findByText('Tenhle kód už jedna služba má.')).toBeInTheDocument();
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
    const { unmount } = render(
      <ServiceDialog open service={null} existing={[]} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.queryByLabelText(/Aktivní/)).not.toBeInTheDocument();
    unmount();

    render(
      <ServiceDialog open service={service()} existing={[service()]} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Aktivní/)).toBeInTheDocument();
  });
});

describe('the price list screen', () => {
  /* Twice on purpose: the cards at the top and the table underneath are two
     views of one list, and both are part of this screen. */
  it('lists what the server has, on the cards and in the table', async () => {
    render(<Cenik />);
    expect(await screen.findAllByText('Komplexní prohlídka')).toHaveLength(2);
  });

  /*
   * The server accepted a duration of 0, and the card divides price by
   * duration. Without the guard this row reads "Infinity Kč/min".
   */
  it('does not print Infinity for a service of no length', async () => {
    getAll.mockResolvedValue([service({ durationMinutes: 0 })]);

    render(<Cenik />);
    await screen.findAllByText('Komplexní prohlídka');

    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kč\/min/)).not.toBeInTheDocument();
  });

  it('shows the price per minute when there is a length', async () => {
    render(<Cenik />);
    expect(await screen.findByText('50 Kč/min')).toBeInTheDocument();
  });

  /*
   * Archiving is final: the list route is active-only, so nothing can ever
   * find the row again. Saying that before the click is the whole point of
   * the confirmation.
   */
  it('warns that archiving cannot be undone, and archives only on confirm', async () => {
    render(<Cenik />);
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(
      screen.getByRole('button', { name: 'Vyřadit službu Komplexní prohlídka' }),
    );

    expect(await screen.findByText(/vrátit nedá/)).toBeInTheDocument();
    expect(archive).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Vyřadit' }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith('s1'));
  });

  it('archives nothing when the confirmation is dismissed', async () => {
    render(<Cenik />);
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(
      screen.getByRole('button', { name: 'Vyřadit službu Komplexní prohlídka' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Zrušit' }));

    expect(archive).not.toHaveBeenCalled();
  });

  /* The button that used to be wired to nothing. */
  it('opens the editor from the card', async () => {
    render(<Cenik />);
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(
      screen.getByRole('button', { name: 'Upravit službu Komplexní prohlídka' }),
    );

    expect(await screen.findByText('Upravit službu')).toBeInTheDocument();
  });

  it('opens an empty editor for a new service', async () => {
    render(<Cenik />);
    await screen.findAllByText('Komplexní prohlídka');

    await userEvent.click(screen.getByRole('button', { name: /Nová služba/ }));

    /* Scoped to the dialog: the button that opened it carries the same words. */
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Nová služba')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Kód/)).toHaveValue('');
  });

  it('says so when the list cannot be loaded', async () => {
    getAll.mockRejectedValue(new Error('offline'));

    render(<Cenik />);

    expect(await screen.findByText(/Ceník se nepodařilo načíst/)).toBeInTheDocument();
  });
});
