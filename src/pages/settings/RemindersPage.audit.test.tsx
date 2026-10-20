/*
 * Připomínky: every way to get a number into the field, what is saved, and what is read back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import RemindersPage from './RemindersPage';

const { read, save } = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));

vi.mock('../../api/reminderSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/reminderSettings')>();
  return { ...actual, readReminderSettings: read, saveReminderSettings: save };
});
vi.mock('../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const answer = (hoursBefore: number) => ({ settings: { hoursBefore }, defaults: { hoursBefore: 24 }, minHours: 1, maxHours: 744 });
const refused = (data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status: 400, data } as never);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/pripominky']}>
        <RemindersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const field = () => screen.findByLabelText('Předstih (hodin)');
const saveButton = () => screen.getByRole('button', { name: 'Uložit' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  read.mockReset().mockResolvedValue(answer(24));
  save.mockReset().mockImplementation(async ({ hoursBefore }: { hoursBefore: number }) => answer(hoursBefore));
});

describe('Připomínky', () => {
  it('shows the stored number, the server\'s bounds and its default', async () => {
    renderPage();
    expect(await field()).toHaveValue(24);
    expect(screen.getByText('Od 1 do 744 hodin. Výchozí: 24.')).toBeInTheDocument();
  });

  it('says in words how far ahead 24 and 30 hours are', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/připomínku 1 den před termínem/)).toBeInTheDocument();
    await user.clear(await field());
    await user.type(await field(), '30');
    expect(screen.getByText(/1 den a 6 hodin před termínem/)).toBeInTheDocument();
  });

  it('keeps Uložit off until the number differs from the stored one', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await field();
    expect(saveButton()).toBeDisabled();
    await user.clear(input);
    await user.type(input, '36');
    expect(saveButton()).toBeEnabled();
    await user.clear(input);
    await user.type(input, '24');
    expect(saveButton()).toBeDisabled();
  });

  it('saves a whole number and shows the answer\'s number', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await field();
    await user.clear(input);
    await user.type(input, '48');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledWith({ hoursBefore: 48 }));
    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
    expect(input).toHaveValue(48);
    expect(saveButton()).toBeDisabled();
  });

  it.each(['12.5', '36.0', '1e1'])('will not save %s: it says it takes whole hours and sends nothing', async (typed) => {
    renderPage();
    const input = await field();
    fireEvent.change(input, { target: { value: typed } });
    expect(await screen.findByText('Zadejte celý počet hodin, bez desetinné čárky.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

  it.each([['0', 'Předstih je od 1 do 744 hodin.'], ['745', 'Předstih je od 1 do 744 hodin.']])(
    '%s hours is outside the server\'s bounds: said at the field, not saved',
    async (typed, sentence) => {
      const user = userEvent.setup();
      renderPage();
      const input = await field();
      await user.clear(input);
      await user.type(input, typed);
      expect(await screen.findByText(sentence)).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
    },
  );

  it.each(['1', '744'])('accepts the edge value %s', async (typed) => {
    const user = userEvent.setup();
    renderPage();
    const input = await field();
    await user.clear(input);
    await user.type(input, typed);
    expect(saveButton()).toBeEnabled();
  });

  it('an emptied field is not saveable and shows no error until something wrong is typed', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await field();
    await user.clear(input);
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText('Zadejte celý počet hodin, bez desetinné čárky.')).toBeNull();
    expect(screen.getByText(/Zadejte počet hodin/)).toBeInTheDocument();
  });

  it('"Vrátit výchozí hodnotu" fills the server\'s default and makes it saveable when it differs', async () => {
    const user = userEvent.setup();
    read.mockResolvedValue(answer(72));
    renderPage();
    const input = await field();
    expect(input).toHaveValue(72);
    await user.click(screen.getByRole('button', { name: 'Vrátit výchozí hodnotu' }));
    expect(input).toHaveValue(24);
    expect(saveButton()).toBeEnabled();
  });

  it('when the stored number already is the default, "Vrátit výchozí" changes nothing to save', async () => {
    const user = userEvent.setup();
    renderPage();
    await field();
    await user.click(screen.getByRole('button', { name: 'Vrátit výchozí hodnotu' }));
    expect(saveButton()).toBeDisabled();
  });

  it('Zahodit puts the stored number back', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await field();
    await user.clear(input);
    await user.type(input, '99');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(input).toHaveValue(24);
  });

  it('shows the server\'s refusal under the field and keeps the typed number', async () => {
    const user = userEvent.setup();
    save.mockRejectedValue(refused({ code: 'settings.invalid', message: 'Nastavení nelze uložit: Předstih musí být celé číslo hodin od 1 do 744.', errors: { hoursBefore: ['Předstih musí být celé číslo hodin od 1 do 744.'] } }));
    renderPage();
    const input = await field();
    await user.clear(input);
    await user.type(input, '50');
    await user.click(saveButton());
    expect(await screen.findByText('Předstih musí být celé číslo hodin od 1 do 744.')).toBeInTheDocument();
    expect(input).toHaveValue(50);
  });

  it('shows a refusal that names no field above the field', async () => {
    const user = userEvent.setup();
    save.mockRejectedValue(refused({ code: 'access.denied', message: 'Na tohle nemáte oprávnění.' }));
    renderPage();
    const input = await field();
    await user.clear(input);
    await user.type(input, '50');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Na tohle nemáte oprávnění.');
  });

  it('a double click on Uložit is one request', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    save.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    renderPage();
    const input = await field();
    await user.clear(input);
    await user.type(input, '12');
    await user.dblClick(saveButton());
    expect(save).toHaveBeenCalledTimes(1);
    release(answer(12));
  });

  it('says the load failed rather than showing a form with no numbers', async () => {
    read.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText('Nastavení připomínek se nepodařilo načíst.')).toBeInTheDocument();
  });

  it.each(Object.entries(VIEWPORTS))('draws at %s (%i px) with the field and the save pair', async (_name, width) => {
    setViewport(width);
    renderPage();
    expect(await field()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zahodit' })).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
  });
});
