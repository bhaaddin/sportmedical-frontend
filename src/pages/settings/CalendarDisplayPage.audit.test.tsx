/*
 * Settings audit (20. 10. 2026) - Kalendář a mřížka (/nastaveni/vzhled-kalendare).
 *
 * Every control of the screen is followed from the GET that fills it to the PUT
 * it builds, against the body the dev API really sent (copied below). What the
 * audit found and these tests pin:
 *   - the page offered "Cena" and "Stav registrace" for the hover card; the
 *     server answers 400 "Tyto údaje karta neumí zobrazit: price, registrationStatus"
 *     (and the booking card always shows the price anyway), so ticking either
 *     made the whole screen unsaveable;
 *   - the choices now come from the server's own `hoverFieldCatalogue`;
 *   - `lunchFrom` / `lunchTo` ride along with every save: a PUT that leaves them
 *     out writes "" over both.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { byUrl, invalidSettings, renderScreen } from '../../test/auditHarness';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/client', () => ({ default: { get, put }, client: { get, put } }));

const { default: CalendarDisplayPage, lunchBreakProblem } = await import('./CalendarDisplayPage');

/* The answer of GET /api/v1/settings/calendar-display on the dev API. */
const SERVER = {
  settings: {
    defaultView: 'week',
    slotMinutes: 15,
    dayStartHour: 7,
    dayEndHour: 19,
    nowLineColor: '#C0392B',
    hoverFields: ['patientName', 'activity', 'status', 'phone', 'paperwork'],
    lunchFrom: '12:00',
    lunchTo: '12:30',
    holidayColor: '#E7CBA9',
    lunchColor: '#CBD1D8',
  },
  views: ['day', 'week', 'month'],
  slotLengths: [10, 15, 20, 30, 60],
  hoverFieldCatalogue: [
    { key: 'patientName', label: 'Jméno pacienta', help: 'Celé jméno pacienta z registru.', sensitive: false },
    { key: 'phone', label: 'Telefon', help: 'Telefon z profilu pacienta, aby šlo zavolat bez otevírání karty.', sensitive: false },
    { key: 'email', label: 'E-mail', help: 'E-mail z profilu pacienta.', sensitive: false },
    { key: 'activity', label: 'Činnost', help: 'Co je objednáno, například Vstupní prohlídka.', sensitive: false },
    { key: 'service', label: 'Služba', help: 'Služba, pod kterou činnost a kalendář patří.', sensitive: false },
    { key: 'status', label: 'Stav termínu', help: 'Objednán, přišel, nepřišel, dokončeno nebo zrušeno.', sensitive: false },
    { key: 'paperwork', label: 'Podklady', help: 'Zda pacient má dotazník a výpis, které činnost vyžaduje.', sensitive: false },
    { key: 'note', label: 'Poznámka k termínu', help: 'Text zapsaný při objednání.', sensitive: false },
    { key: 'insurer', label: 'Zdravotní pojišťovna', help: 'Jen pro účty s oprávněním vidět citlivé identifikační údaje.', sensitive: true },
    { key: 'birthDate', label: 'Datum narození', help: 'Jen pro účty s oprávněním vidět citlivé identifikační údaje.', sensitive: true },
    { key: 'history', label: 'Poslední změna', help: 'Kdo termín naposledy změnil a kdy.', sensitive: false },
  ],
  defaults: {
    defaultView: 'week',
    slotMinutes: 15,
    dayStartHour: 7,
    dayEndHour: 19,
    nowLineColor: '#C0392B',
    hoverFields: ['patientName', 'activity', 'status', 'phone', 'paperwork'],
    lunchFrom: '12:00',
    lunchTo: '12:30',
    holidayColor: '#E7CBA9',
    lunchColor: '#CBD1D8',
  },
};

const SLOTS = { settings: { examinationPauseMinutes: 10 }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 };

const DISPLAY_URL = '/api/v1/settings/calendar-display';
const sent = (): Record<string, unknown> => put.mock.calls.find((call) => call[0] === DISPLAY_URL)?.[1] as Record<string, unknown>;
const mount = () => renderScreen(<CalendarDisplayPage />, '/nastaveni/vzhled-kalendare');
const saveButton = () => screen.getByRole('button', { name: 'Uložit' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockImplementation(byUrl({
    [DISPLAY_URL]: () => structuredClone(SERVER),
    '/api/v1/settings/booking-slots': () => SLOTS,
  }));
  put.mockReset().mockImplementation(async (_url: string, body: unknown) => ({ data: { ...structuredClone(SERVER), settings: body } }));
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)(
  'read back · %s',
  (_name, width) => {
    beforeEach(() => setViewport(width));

    it('fills every control from the stored settings', async () => {
      mount();
      expect(await screen.findByRole('combobox', { name: 'Výchozí pohled' })).toHaveTextContent('Týden');
      expect(screen.getByRole('combobox', { name: 'Délka řádku' })).toHaveTextContent('15 minut');
      expect(screen.getByRole('combobox', { name: 'Den začíná v' })).toHaveTextContent('07:00');
      expect(screen.getByRole('combobox', { name: 'Den končí v' })).toHaveTextContent('19:00');
      expect(screen.getByLabelText('Barva čáry „teď“')).toHaveValue('#C0392B');
      expect(screen.getByLabelText('Barva volných dnů a svátků')).toHaveValue('#E7CBA9');
      expect(screen.getByLabelText('Barva obědové pauzy')).toHaveValue('#CBD1D8');
    });

    it('ticks exactly the stored hover facts', async () => {
      mount();
      await screen.findByRole('combobox', { name: 'Výchozí pohled' });
      const state = (name: RegExp) => (screen.getByRole('checkbox', { name }) as HTMLInputElement).checked;
      expect({
        patientName: state(/^Jméno pacienta/), activity: state(/^Činnost/), status: state(/^Stav termínu/),
        phone: state(/^Telefon/), paperwork: state(/^Podklady/),
        email: state(/^E-mail/), service: state(/^Služba/), birthDate: state(/^Datum narození/),
      }).toEqual({
        patientName: true, activity: true, status: true, phone: true, paperwork: true,
        email: false, service: false, birthDate: false,
      });
    });

    it('keeps Uložit and Zahodit off until something changes', async () => {
      mount();
      await screen.findByRole('combobox', { name: 'Výchozí pohled' });
      expect(saveButton()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Zahodit' })).toBeDisabled();
    });
  },
);

describe('each control builds its field of the PUT', () => {
  it('sends the view the owner picked and everything else as it was read', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Výchozí pohled' }));
    await user.click(screen.getByRole('option', { name: 'Měsíc' }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent()).toEqual({ ...SERVER.settings, defaultView: 'month' });
  });

  it('offers only the row lengths the server named, and sends the chosen one as a number', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Délka řádku' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['10 minut', '15 minut', '20 minut', '30 minut', '60 minut']);
    await user.click(screen.getByRole('option', { name: '30 minut' }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent().slotMinutes).toBe(30);
  });

  it('sends the day start as the hour number, not as text', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Den začíná v' }));
    await user.click(screen.getByRole('option', { name: '06:00' }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent().dayStartHour).toBe(6);
  });

  it('lets the day end at 24:00 and not start there', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Den začíná v' }));
    expect(screen.queryByRole('option', { name: '24:00' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '00:00' }));
    await user.click(screen.getByRole('combobox', { name: 'Den končí v' }));
    expect(screen.queryByRole('option', { name: '00:00' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '24:00' }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent()).toMatchObject({ dayStartHour: 0, dayEndHour: 24 });
  });

  it.each([
    ['Barva čáry „teď“', 'nowLineColor', 'Vybrat barvu čáry'],
    ['Barva volných dnů a svátků', 'holidayColor', 'Vybrat barvu volných dnů'],
    ['Barva obědové pauzy', 'lunchColor', 'Vybrat barvu obědové pauzy'],
  ])('%s: typed text and the native picker both end up in %s', async (label, field, pickerLabel) => {
    const user = userEvent.setup();
    mount();
    const text = await screen.findByLabelText(label);
    await user.clear(text);
    await user.type(text, '#112233');
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(sent()[field]).toBe('#112233');

    /* The picker answers lower case; the screen sends what the server stores, upper case. */
    fireEvent.change(screen.getByLabelText(pickerLabel), { target: { value: '#aabbcc' } });
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[1][1][field]).toBe('#AABBCC');
  });

  it('never loses the lunch break the screen does not edit (a PUT without it writes "" over both)', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Výchozí pohled' }));
    await user.click(screen.getByRole('option', { name: 'Den' }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent()).toMatchObject({ lunchFrom: '12:00', lunchTo: '12:30' });
  });
});

describe('the hover card section', () => {
  it('offers the server catalogue, with its labels and help, narrowed to what the booking card can draw', async () => {
    mount();
    await screen.findByRole('combobox', { name: 'Výchozí pohled' });
    const labels = screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent ?? '');
    const names = labels.map((text) => text.slice(0, 12));
    expect(labels).toHaveLength(8);
    expect(screen.getByText('Telefon z profilu pacienta, aby šlo zavolat bez otevírání karty.')).toBeInTheDocument();
    expect(names.join('|')).toContain('Jméno pacie');
  });

  it.each(['Cena', 'Stav registrace', 'Poznámka k termínu', 'Zdravotní pojišťovna', 'Poslední změna'])(
    'does not offer "%s" (the server refuses price/registrationStatus; note, insurer and history are not on the calendar row)',
    async (label) => {
      mount();
      await screen.findByRole('combobox', { name: 'Výchozí pohled' });
      expect(screen.queryByRole('checkbox', { name: new RegExp(`^${label}`) })).not.toBeInTheDocument();
    },
  );

  it('adds a ticked fact at the end of the list and removes an unticked one in place', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: /^E-mail/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Činnost/ }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent().hoverFields).toEqual(['patientName', 'status', 'phone', 'paperwork', 'email']);
  });

  it('can save an empty list (the card then falls back to its own default)', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: 'Výchozí pohled' });
    for (const name of [/^Jméno pacienta/, /^Činnost/, /^Stav termínu/, /^Telefon/, /^Podklady/]) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent().hoverFields).toEqual([]);
  });

  it('keeps a saved fact the screen does not list (it is not silently dropped from the setting)', async () => {
    get.mockImplementation(byUrl({
      [DISPLAY_URL]: () => ({ ...SERVER, settings: { ...SERVER.settings, hoverFields: ['patientName', 'note'] } }),
      '/api/v1/settings/booking-slots': () => SLOTS,
    }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: /^Telefon/ }));
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent().hoverFields).toEqual(['patientName', 'note', 'phone']);
  });

  it('falls back to the same list when an older server sends no catalogue', async () => {
    get.mockImplementation(byUrl({
      [DISPLAY_URL]: () => ({ ...SERVER, hoverFieldCatalogue: undefined }),
      '/api/v1/settings/booking-slots': () => SLOTS,
    }));
    mount();
    expect(await screen.findByRole('checkbox', { name: /^Jméno pacienta/ })).toBeChecked();
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
  });

  it('shows the server sentence for the hover list under the list, not only in the banner', async () => {
    put.mockRejectedValue(invalidSettings({ hoverFields: ['Každý údaj smí být v kartě jen jednou: phone.'] }, 'Nastavení nelze uložit: Každý údaj smí být v kartě jen jednou: phone.'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('checkbox', { name: /^E-mail/ }));
    await user.click(saveButton());
    expect(await screen.findAllByText(/Každý údaj smí být v kartě jen jednou/)).not.toHaveLength(0);
  });
});

describe('saving', () => {
  it('goes quiet after a save and shows what the server stored (it upper-cases a colour)', async () => {
    put.mockImplementation(async (_url: string, body: Record<string, unknown>) => ({ data: { ...structuredClone(SERVER), settings: { ...body, nowLineColor: String(body.nowLineColor).toUpperCase() } } }));
    const user = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Barva čáry „teď“');
    await user.clear(field);
    await user.type(field, '#aabbcc');
    await user.click(saveButton());
    expect(await screen.findByText(/Uloženo\. Kalendář se tak kreslí všem/)).toBeInTheDocument();
    expect(screen.getByLabelText('Barva čáry „teď“')).toHaveValue('#AABBCC');
    expect(saveButton()).toBeDisabled();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    put.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Výchozí pohled' }));
    await user.click(screen.getByRole('option', { name: 'Den' }));
    await user.dblClick(saveButton());
    expect(put.mock.calls.filter((call) => call[0] === DISPLAY_URL)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ukládám…' })).toBeDisabled();
    finish({ data: SERVER });
  });

  it('keeps the edit and shows the server sentence under the field it refused', async () => {
    put.mockRejectedValue(invalidSettings({ nowLineColor: ['Barva musí být zapsaná jako #RRGGBB, například #D32F2F.'] }, 'Nastavení nelze uložit: Barva musí být zapsaná jako #RRGGBB, například #D32F2F.'));
    const user = userEvent.setup();
    mount();
    const field = await screen.findByLabelText('Barva čáry „teď“');
    await user.clear(field);
    await user.type(field, '#abc');
    await user.click(saveButton());
    expect(await screen.findByText('Barva musí být zapsaná jako #RRGGBB, například #D32F2F.')).toBeInTheDocument();
    expect(field).toHaveValue('#abc');
    expect(saveButton()).toBeEnabled();
  });

  it('falls back to a fixed sentence when the request never got an answer', async () => {
    put.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Výchozí pohled' }));
    await user.click(screen.getByRole('option', { name: 'Den' }));
    await user.click(saveButton());
    expect(await screen.findByText('Nastavení se nepodařilo uložit.')).toBeInTheDocument();
  });

  it('Zahodit puts the stored values back without a request', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('combobox', { name: 'Výchozí pohled' }));
    await user.click(screen.getByRole('option', { name: 'Den' }));
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByRole('combobox', { name: 'Výchozí pohled' })).toHaveTextContent('Týden');
    expect(put).not.toHaveBeenCalled();
  });

  it('"Vrátit výchozí hodnoty" loads the server defaults into the form and still needs a save', async () => {
    get.mockImplementation(byUrl({
      [DISPLAY_URL]: () => ({ ...SERVER, settings: { ...SERVER.settings, slotMinutes: 60, nowLineColor: '#000000' } }),
      '/api/v1/settings/booking-slots': () => SLOTS,
    }));
    const user = userEvent.setup();
    mount();
    await screen.findByRole('combobox', { name: 'Délka řádku' });
    await user.click(screen.getByRole('button', { name: 'Vrátit výchozí hodnoty' }));
    expect(screen.getByRole('combobox', { name: 'Délka řádku' })).toHaveTextContent('15 minut');
    expect(screen.getByLabelText('Barva čáry „teď“')).toHaveValue('#C0392B');
    expect(put).not.toHaveBeenCalled();
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent()).toEqual(SERVER.defaults);
  });
});

describe('lunchBreakProblem', () => {
  it.each([
    ['12:00', '12:30', null],
    ['', '', null],
    ['  ', '', null],
    ['12:00:00', '12:30:00', null],
    ['12:00', '', 'Obědová pauza potřebuje začátek i konec, nebo obě pole prázdná.'],
    ['', '12:30', 'Obědová pauza potřebuje začátek i konec, nebo obě pole prázdná.'],
    ['12:30', '12:00', 'Obědová pauza musí končit později, než začne.'],
    ['12:00', '12:00', 'Obědová pauza musí končit později, než začne.'],
  ])('%j - %j', (from, to, expected) => {
    expect(lunchBreakProblem(from, to)).toBe(expected);
  });
});

describe('the default lunch break (it gives a day without its own break the pause; measured: 11:00-11:45 moved the preview break)', () => {
  it('shows the stored times', async () => {
    mount();
    expect(await screen.findByLabelText('Výchozí oběd od')).toHaveValue('12:00');
    expect(screen.getByLabelText('Výchozí oběd do')).toHaveValue('12:30');
  });

  it('sends a changed pause as HH:mm in the same PUT', async () => {
    const user = userEvent.setup();
    mount();
    fireEvent.change(await screen.findByLabelText('Výchozí oběd od'), { target: { value: '11:00' } });
    fireEvent.change(screen.getByLabelText('Výchozí oběd do'), { target: { value: '11:45' } });
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent()).toMatchObject({ lunchFrom: '11:00', lunchTo: '11:45' });
  });

  it('both emptied means no default lunch and goes out as ""', async () => {
    const user = userEvent.setup();
    mount();
    fireEvent.change(await screen.findByLabelText('Výchozí oběd od'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Výchozí oběd do'), { target: { value: '' } });
    await user.click(saveButton());
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(sent()).toMatchObject({ lunchFrom: '', lunchTo: '' });
  });

  it('only one of the two is refused with the sentence, and nothing is sent', async () => {
    const user = userEvent.setup();
    mount();
    fireEvent.change(await screen.findByLabelText('Výchozí oběd do'), { target: { value: '' } });
    await user.click(saveButton());
    expect(await screen.findByText('Obědová pauza potřebuje začátek i konec, nebo obě pole prázdná.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('an end before the start is refused and nothing is sent', async () => {
    const user = userEvent.setup();
    mount();
    fireEvent.change(await screen.findByLabelText('Výchozí oběd od'), { target: { value: '13:00' } });
    await user.click(saveButton());
    expect(await screen.findByText('Obědová pauza musí končit později, než začne.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('shows the server sentence for the lunch', async () => {
    put.mockRejectedValue(invalidSettings({ lunch: ['Čas obědové pauzy zapište jako HH:mm, například 12:00.'] }));
    const user = userEvent.setup();
    mount();
    fireEvent.change(await screen.findByLabelText('Výchozí oběd od'), { target: { value: '11:00' } });
    await user.click(saveButton());
    expect(await screen.findByText('Čas obědové pauzy zapište jako HH:mm, například 12:00.')).toBeInTheDocument();
  });
});

describe('Poslední změny', () => {
  it('asks the history under the scope the server files the calendar settings in ("calendar" - the catalogue id found nothing)', async () => {
    mount();
    await screen.findByRole('combobox', { name: 'Výchozí pohled' });
    await waitFor(() => expect(get.mock.calls.some((call) => call[0] === '/api/v1/settings/changes')).toBe(true));
    const scopes = get.mock.calls.filter((c) => c[0] === '/api/v1/settings/changes').map((c) => c[1]?.params?.scope);
    expect(new Set(scopes)).toEqual(new Set(['calendar']));
  });
});

describe('loading', () => {
  it('says what failed and reads again on request', async () => {
    let failing = true;
    get.mockImplementation(byUrl({
      [DISPLAY_URL]: () => { if (failing) throw new Error('down'); return structuredClone(SERVER); },
      '/api/v1/settings/booking-slots': () => SLOTS,
    }));
    const user = userEvent.setup();
    mount();
    expect(await screen.findByText('Nastavení kalendáře se nepodařilo načíst.')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByRole('combobox', { name: 'Výchozí pohled' })).toBeInTheDocument();
  });

  it('shows the pause-between-examinations card under the form, with its own save', async () => {
    mount();
    const card = await screen.findByTestId('booking-slots-card');
    expect(await within(card).findByLabelText('Pauza mezi vyšetřeními (min)')).toHaveValue('10');
    expect(within(card).getByRole('button', { name: 'Uložit pauzu' })).toBeDisabled();
  });
});
