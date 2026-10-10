/*
 * Upravit klub / Nový klub with ARES (Etapa 12), in three layouts: a valid IČO
 * that loses focus fills Název, DIČ, Ulice a číslo, Město and PSČ - overwriting,
 * with "Přepsáno z ARES · Vrátit" under what it replaced - and leaves the bank,
 * the contact and the sleva alone; Vedení klubu comes from the registry too,
 * hand-written rows survive a refill, and a row can be removed; the server's
 * sentence shows on a refusal.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { AresSubject } from '../../api/ares';
import type { Club } from '../../api/clubs';

const { lookup, create, update } = vi.hoisted(() => ({ lookup: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('../../api/ares', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/ares')>();
  return { ...actual, aresApi: { lookup } };
});
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, create, update } };
});

const { AresError } = await import('../../api/ares');
const { PayerDialog, mergeAresManagement, toManagementRequest } = await import('./PayerDialog');

const OLD_ICO = '27082440';
const NEW_ICO = '25596641';

const subject = (over: Partial<AresSubject> = {}): AresSubject => ({
  ico: NEW_ICO, name: 'Seznam.cz, a.s.', dic: 'CZ25596641', legalForm: 'a.s.', street: 'Radlická 3294/10', city: 'Praha 5',
  postalCode: '150 00', countryCode: 'CZ', established: '1996-01-01', dissolved: null, isActive: true,
  fetchedAtUtc: '2026-10-10T08:00:00Z',
  management: [
    { fullName: 'Jan Novák', role: 'jednatel', since: '2020-01-01', until: null },
    { fullName: 'Eva Nová', role: 'člen výboru', since: null, until: null },
  ],
  ...over,
});

const club: Club = {
  id: 'club-2', name: 'HC Kladno', ico: OLD_ICO, dic: '', address: 'Stará 1', city: 'Kladno', postalCode: '27201',
  contactPerson: 'Karel Trenér', contactEmail: 'k@kladno.cz', contactPhone: '+420777111222',
  bankAccount: '123456789', bankCode: '0800', iban: '', paymentTermsDays: 21, discountPercent: 5,
  management: [
    { id: 'm1', fullName: 'Jan Novák', role: 'předseda', phone: '+420 600 000 001', email: null, source: 'ares' },
    { id: 'm2', fullName: 'Petr Ruční', role: 'správce', phone: null, email: 'petr@kladno.cz', source: 'manual' },
  ],
  isActive: true, createdAt: '2026-01-01T00:00:00Z',
};

const open = (editing: Club | 'new' = club) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<PayerDialog editing={editing} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved, dialog: screen.getByRole('dialog') };
};

/* "E-mail" and "Telefon" are also labels of the vedení rows, which sit above Kontakt: the club's own is the last one. */
const field = (label: string) => {
  const all = screen.getAllByLabelText(label);
  return all[all.length - 1];
};

async function changeIcoAndBlur(user: ReturnType<typeof userEvent.setup>, ico: string) {
  const input = screen.getByLabelText('IČO');
  await user.clear(input);
  await user.type(input, ico);
  await user.click(screen.getByLabelText('Kód banky'));
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  lookup.mockReset().mockResolvedValue(subject());
  create.mockReset().mockResolvedValue(club);
  update.mockReset().mockResolvedValue(club);
});

describe.each(Object.entries(VIEWPORTS))('PayerDialog + ARES at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('fills everything ARES knows when the IČO loses focus, overwriting, and leaves bank, contact and sleva alone', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole('button', { name: 'Načíst z ARES' })).toBeEnabled();
    await changeIcoAndBlur(user, NEW_ICO);

    await waitFor(() => expect(lookup).toHaveBeenCalledWith(NEW_ICO));
    await waitFor(() => expect(field('Název')).toHaveValue('Seznam.cz, a.s.'));
    expect(field('DIČ')).toHaveValue('CZ25596641');
    expect(field('Ulice a číslo')).toHaveValue('Radlická 3294/10');
    expect(field('Město')).toHaveValue('Praha 5');
    expect(field('PSČ')).toHaveValue('150 00');
    expect(screen.getByRole('status')).toHaveTextContent('Načteno z ARES 10. 10. 2026 · Seznam.cz, a.s.');

    expect(field('Číslo účtu')).toHaveValue('123456789');
    expect(field('Kód banky')).toHaveValue('0800');
    expect(field('Kontaktní osoba')).toHaveValue('Karel Trenér');
    expect(field('E-mail')).toHaveValue('k@kladno.cz');
    expect(field('Sleva klubu (%)')).toHaveValue('5');

    /* The four fields that held something else say so; DIČ was empty and says nothing. */
    expect(screen.getAllByText('Přepsáno z ARES')).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Vrátit' })).toHaveLength(4);

    /* Vedení klubu: the ARES rows are replaced, Jan keeps his phone, Petr (manual) stays. */
    const rows = screen.getAllByTestId('club-manager-row');
    expect(rows.map((r) => within(r).getByLabelText('Jméno')).map((i) => (i as HTMLInputElement).value)).toEqual(['Jan Novák', 'Eva Nová', 'Petr Ruční']);
    expect(within(rows[0]).getByLabelText('Funkce')).toHaveValue('jednatel');
    expect(within(rows[0]).getByLabelText('Telefon')).toHaveValue('+420 600 000 001');
    expect(rows[0]).toHaveAttribute('data-source', 'ares');
    expect(rows[2]).toHaveAttribute('data-source', 'manual');
    expect(within(rows[0]).getByText('z ARES')).toBeInTheDocument();
    expect(within(rows[2]).queryByText('z ARES')).not.toBeInTheDocument();
  });
});

describe('PayerDialog + ARES', () => {
  it('"Vrátit" gives the previous value back and the field stays editable', async () => {
    const user = userEvent.setup();
    open();
    await changeIcoAndBlur(user, NEW_ICO);
    await waitFor(() => expect(field('Název')).toHaveValue('Seznam.cz, a.s.'));

    const nameCell = field('Název').closest('.MuiGrid-root') as HTMLElement;
    await user.click(within(nameCell).getByRole('button', { name: 'Vrátit' }));
    expect(field('Název')).toHaveValue('HC Kladno');
    expect(within(nameCell).queryByText('Přepsáno z ARES')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Vrátit' })).toHaveLength(3);

    await user.type(field('Název'), ' z.s.');
    expect(field('Název')).toHaveValue('HC Kladno z.s.');
  });

  it('typing over a filled field drops its caption', async () => {
    const user = userEvent.setup();
    open();
    await changeIcoAndBlur(user, NEW_ICO);
    await waitFor(() => expect(field('Město')).toHaveValue('Praha 5'));
    await user.type(field('Město'), '!');
    const cityCell = field('Město').closest('.MuiGrid-root') as HTMLElement;
    expect(within(cityCell).queryByText('Přepsáno z ARES')).not.toBeInTheDocument();
  });

  it('does not ask when the IČO the club opened with merely loses focus; the button still asks', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByLabelText('IČO'));
    await user.click(screen.getByLabelText('DIČ'));
    await new Promise((r) => setTimeout(r, 400));
    expect(lookup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Načíst z ARES' }));
    await waitFor(() => expect(lookup).toHaveBeenCalledWith(OLD_ICO));
  });

  it('keeps the button off for a new club until the IČO passes its checksum', async () => {
    const user = userEvent.setup();
    open('new');
    const button = screen.getByRole('button', { name: 'Načíst z ARES' });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText('IČO'), '12345678');
    expect(button).toBeDisabled();
    await user.clear(screen.getByLabelText('IČO'));
    await user.type(screen.getByLabelText('IČO'), NEW_ICO);
    expect(button).toBeEnabled();
    expect(screen.getByText('Zatím nikdo. Načtěte vedení z ARES podle IČO, nebo přidejte osobu ručně.')).toBeInTheDocument();
  });

  it.each([
    [400, 'ares.ico_invalid', 'IČO nemá správný tvar.'],
    [404, 'ares.not_found', 'Subjekt s IČO v ARES není.'],
    [502, 'ares.unavailable', 'ARES teď neodpovídá.'],
  ] as const)('shows the server\'s sentence on %i and changes nothing', async (status, code, message) => {
    lookup.mockRejectedValue(new AresError(code, message, status));
    const user = userEvent.setup();
    open();
    await changeIcoAndBlur(user, NEW_ICO);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(field('Název')).toHaveValue('HC Kladno');
    expect(screen.queryByText('Přepsáno z ARES')).not.toBeInTheDocument();
  });

  it('warns that the subject is dissolved', async () => {
    lookup.mockResolvedValue(subject({ isActive: false, dissolved: '2024-05-01' }));
    const user = userEvent.setup();
    open();
    await changeIcoAndBlur(user, NEW_ICO);
    expect(await screen.findByText('Subjekt je zaniklý')).toBeInTheDocument();
    expect(field('Název')).toHaveValue('Seznam.cz, a.s.');
  });

  it('removes a row of the vedení, adds a blank one, and saves the list whole with the rest of the club', async () => {
    const user = userEvent.setup();
    const { onSaved } = open();
    await user.click(screen.getByRole('button', { name: 'Odebrat Petr Ruční' }));
    expect(screen.getAllByTestId('club-manager-row')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Přidat osobu' }));
    const rows = screen.getAllByTestId('club-manager-row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveAttribute('data-source', 'manual');
    await user.type(within(rows[1]).getByLabelText('Jméno'), ' Lucie Nová ');
    await user.type(within(rows[1]).getByLabelText('Funkce'), 'pokladník');
    await user.type(within(rows[1]).getByLabelText('E-mail'), 'lucie@kladno.cz');
    await user.click(screen.getByRole('button', { name: 'Přidat osobu' }));
    expect(screen.getAllByTestId('club-manager-row')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('club-2', expect.objectContaining({
      name: 'HC Kladno',
      ico: OLD_ICO,
      /* The blank third row is not a person. */
      management: [
        { id: 'm1', fullName: 'Jan Novák', role: 'předseda', phone: '+420 600 000 001', email: null, source: 'ares' },
        { fullName: 'Lucie Nová', role: 'pokladník', phone: null, email: 'lucie@kladno.cz', source: 'manual' },
      ],
    }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('on a phone the remove button is a labelled 44 px button and the IČO stacks over the ARES button', async () => {
    setViewport(VIEWPORTS.phone);
    const user = userEvent.setup();
    open();
    const remove = screen.getAllByRole('button', { name: 'Odebrat osobu' });
    expect(remove).toHaveLength(2);
    expect(getComputedStyle(remove[0]).minHeight).toBe('44px');
    await user.click(remove[1]);
    expect(screen.getAllByTestId('club-manager-row')).toHaveLength(1);
    const ares = screen.getByRole('button', { name: 'Načíst z ARES' });
    expect(getComputedStyle(ares.parentElement as HTMLElement).flexDirection).toBe('column');
  });
});

describe('mergeAresManagement', () => {
  const current = club.management ?? [];

  it('replaces the ARES rows, keeps a matching person\'s phone and e-mail, keeps manual rows', () => {
    const merged = mergeAresManagement(current, subject().management);
    expect(merged).toEqual([
      { id: 'm1', fullName: 'Jan Novák', role: 'jednatel', phone: '+420 600 000 001', email: null, source: 'ares' },
      { fullName: 'Eva Nová', role: 'člen výboru', phone: null, email: null, source: 'ares' },
      { id: 'm2', fullName: 'Petr Ruční', role: 'správce', phone: null, email: 'petr@kladno.cz', source: 'manual' },
    ]);
  });

  it('drops the old ARES rows when the registry lists nobody, and keeps the manual ones', () => {
    expect(mergeAresManagement(current, [])).toEqual([current[1]]);
  });

  it('does not list a hand-written person twice when ARES now names them', () => {
    const merged = mergeAresManagement(current, [{ fullName: 'petr ruční', role: 'předseda', since: null, until: null }]);
    expect(merged).toEqual([{ id: 'm2', fullName: 'petr ruční', role: 'předseda', phone: null, email: 'petr@kladno.cz', source: 'ares' }]);
  });

  it('sends rows trimmed and without the nameless ones', () => {
    expect(toManagementRequest([
      { fullName: '  ', role: 'x', phone: null, email: null, source: 'manual' },
      { fullName: ' A B ', role: ' r ', phone: ' ', email: ' a@b.cz ', source: 'manual' },
    ])).toEqual([{ fullName: 'A B', role: 'r', phone: null, email: 'a@b.cz', source: 'manual' }]);
  });
});
