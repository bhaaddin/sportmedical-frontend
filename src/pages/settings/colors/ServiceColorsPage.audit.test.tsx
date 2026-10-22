/*
 * Settings audit (20. 10. 2026) - Barvy služeb (/nastaveni/barvy-sluzeb).
 *
 * Server facts (dev API):
 *   PUT /api/v1/settings/service-colors: 5 colours or 40 -> 400 "Paleta musí mít 6 až 24 barev."; a repeated colour -> 400;
 *     "#12" -> 400; lower case is stored upper case.
 *   PUT /api/clinic-services/{id} without colorHex keeps the colour; with a lower-case one it stores upper case.
 *   PUT /api/activities/{id} without colorHex CLEARS the činnost's own colour (so the whole činnost goes back).
 * Who reads the palette: ColorSelect (calendar and činnost colour pickers) and PaletteChoice (the shades popover).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invalidSettings, renderScreen } from '../../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { MAX_PALETTE_SIZE } from '../../../api/fieldLimits';
import { MIN_PALETTE_SIZE } from '../../../api/serviceColors';
import { drawnColor, hasPaletteErrors, isHex, normalizeHex, paletteSignature, toRows, validatePalette } from './colorLogic';

const m = vi.hoisted(() => ({ getPalette: vi.fn(), putPalette: vi.fn(), listServices: vi.fn(), updateService: vi.fn(), listActivities: vi.fn(), updateActivity: vi.fn(), listCalendars: vi.fn() }));

vi.mock('../../../api/calendars', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/calendars')>()),
  calendarsApi: { list: m.listCalendars, update: vi.fn() },
}));

vi.mock('../../../api/serviceColors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/serviceColors')>()),
  serviceColorsApi: { get: m.getPalette, put: m.putPalette },
}));
vi.mock('../../../api/clinicServices', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/clinicServices')>()),
  clinicServicesApi: { list: m.listServices, update: m.updateService },
}));
vi.mock('../../../api/activities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/activities')>()),
  activitiesApi: { list: m.listActivities, update: m.updateActivity },
}));
vi.mock('../../../components/settings/changesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../components/settings/changesApi')>()),
  fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const { default: ServiceColorsPage } = await import('../ServiceColorsPage');

const PALETTE = ['#0D5C52', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
const SERVICES = [
  { id: 's1', name: 'Prohlídky', description: 'Popis', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52' },
  { id: 's2', name: 'Diagnostika', description: '', sortOrder: 2, isActive: true, activities: 1, calendars: 1, colorHex: null },
];
const activityRow = (over: Record<string, unknown>) => ({
  id: 'a1', name: 'Základní', slug: 'x', durationMinutes: 30, color: '#111111', publicNote: 'pozn', isPubliclyBookable: true, requiresReportByEmail: true, requiresClubSharing: false,
  questionnaireRequirement: 'Required', sortOrder: 1, isActive: true, serviceItemId: 'p1', clinicServiceId: 's1', questionnaireDefinitionId: 'q1', colorHex: null, effectiveColorHex: '#3E7D74',
  parallelCapacity: 2, requiredDocumentTemplateIds: ['t1'], ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  m.getPalette.mockReset().mockResolvedValue({ palette: PALETTE });
  m.putPalette.mockReset().mockImplementation(async (settings) => settings);
  m.listServices.mockReset().mockResolvedValue(SERVICES);
  m.updateService.mockReset().mockResolvedValue(SERVICES[0]);
  m.listCalendars.mockReset().mockResolvedValue([]);
  m.listActivities.mockReset().mockResolvedValue({ activities: [activityRow({}), activityRow({ id: 'a2', name: 'Komplexní', colorHex: '#AA5500', effectiveColorHex: '#AA5500' })], warnings: [] });
  m.updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
});

describe('normalizeHex / isHex / drawnColor', () => {
  it.each([
    ['0d5c52', '#0D5C52'], ['#0d5c52', '#0D5C52'], ['  #0d5c52 ', '#0D5C52'], ['#0D5C52', '#0D5C52'],
    ['#abc', '#abc'], ['0D5C5', '0D5C5'], ['#GGGGGG', '#GGGGGG'], ['', ''],
  ])('normalizeHex(%j) -> %j', (text, expected) => {
    expect(normalizeHex(text)).toBe(expected);
  });

  it.each([['#0D5C52', true], ['#0d5c52', true], ['0D5C52', false], ['#0D5C5', false], ['#0D5C521', false]])('isHex(%s) -> %s', (text, expected) => {
    expect(isHex(text)).toBe(expected);
  });

  it('draws a činnost in the server’s computed colour, else its own, else its služba’s, else the fallback', () => {
    expect(drawnColor({ effectiveColorHex: '#111111', colorHex: '#222222' }, '#333333', '#444444')).toBe('#222222');
    expect(drawnColor({ effectiveColorHex: '#111111', colorHex: null }, '#333333', '#444444')).toBe('#111111');
    expect(drawnColor({ effectiveColorHex: null, colorHex: '#222222' }, '#333333', '#444444')).toBe('#222222');
    expect(drawnColor({ colorHex: null }, '#333333', '#444444')).toBe('#333333');
    expect(drawnColor({}, null, '#444444')).toBe('#444444');
  });
});

describe('validatePalette', () => {
  const rows = (hexes: string[]) => toRows(hexes);

  it('is happy with 6 to 24 distinct colours', () => {
    expect(hasPaletteErrors(validatePalette(rows(PALETTE)))).toBe(false);
    const many = Array.from({ length: MAX_PALETTE_SIZE }, (_, i) => `#${(0x100000 + i * 0x010101).toString(16).toUpperCase()}`);
    expect(hasPaletteErrors(validatePalette(rows(many)))).toBe(false);
  });

  it('refuses fewer than 6, with the minimum in the sentence', () => {
    expect(validatePalette(rows(PALETTE.slice(0, 5))).general).toMatch(new RegExp(`aspoň ${MIN_PALETTE_SIZE} barev`));
  });

  it('refuses a 25th colour - the server answers 400 for it', () => {
    const many = Array.from({ length: MAX_PALETTE_SIZE + 1 }, (_, i) => `#${(0x100000 + i * 0x010101).toString(16).toUpperCase()}`);
    expect(validatePalette(rows(many)).general).toBe('Paleta může mít nejvýše 24 barev.');
  });

  it('refuses a repeated colour whatever its case or missing #', () => {
    const errors = validatePalette(rows([...PALETTE.slice(0, 5), '0d5c52']));
    expect(Object.values(errors.rows)).toEqual(['Tuto barvu paleta už má.']);
  });

  it('refuses a text that is no colour, per row', () => {
    const errors = validatePalette(rows([...PALETTE.slice(0, 5), '#12']));
    expect(Object.values(errors.rows)).toEqual(['Zadejte barvu jako #RRGGBB, např. #0D5C52.']);
  });

  it('a signature ignores the case and the missing #, so retyping a colour is not a change', () => {
    expect(paletteSignature(rows(PALETTE))).toBe(paletteSignature(rows(PALETTE.map((c) => c.slice(1).toLowerCase()))));
  });
});

describe('the palette', () => {
  const addRows = async (user: ReturnType<typeof userEvent.setup>, count: number) => {
    for (let i = 0; i < count; i += 1) {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Přidat barvu' })); });
      void user;
    }
  };

  it('stops offering "Přidat barvu" at 24 colours and says why', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await screen.findByRole('button', { name: 'Přidat barvu' });
    await addRows(user, MAX_PALETTE_SIZE - PALETTE.length);
    expect(screen.getByRole('button', { name: 'Přidat barvu' })).toBeDisabled();
    expect(screen.getByText('Paleta má nejvíce 24 barev.')).toBeInTheDocument();
  });

  it('will not remove below 6, and says so', async () => {
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await screen.findByLabelText('Barva 1 jako text');
    for (const button of screen.getAllByRole('button', { name: /^Odebrat barvu/ })) expect(button).toBeDisabled();
    expect(screen.getByText(/Paleta má nejméně 6 barev/)).toBeInTheDocument();
  });

  it('saves the colours upper-cased and in the order shown', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    const first = await screen.findByLabelText('Barva 1 jako text');
    await user.clear(first);
    await user.type(first, 'aa5500');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.putPalette).toHaveBeenCalled());
    expect(m.putPalette).toHaveBeenCalledWith({ palette: ['#AA5500', ...PALETTE.slice(1)] });
  });

  it('the native picker changes a colour too', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await screen.findByLabelText('Barva 1 jako text');
    fireEvent.change(screen.getByLabelText('Vybrat barvu 2'), { target: { value: '#123456' } });
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(m.putPalette).toHaveBeenCalled());
    expect(m.putPalette.mock.calls[0][0].palette[1]).toBe('#123456');
  });

  it('shows the server sentence for a colour it refuses', async () => {
    m.putPalette.mockRejectedValue(invalidSettings({ palette: ['„#12“ není barva ve tvaru #RRGGBB.'] }, 'Nastavení nelze uložit: „#12“ není barva ve tvaru #RRGGBB.'));
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    const first = await screen.findByLabelText('Barva 1 jako text');
    await user.clear(first);
    await user.type(first, '123456');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/není barva ve tvaru #RRGGBB/)).toBeInTheDocument();
  });

  it('Zahodit restores the stored palette without a request', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    const first = await screen.findByLabelText('Barva 1 jako text');
    await user.clear(first);
    await user.type(first, 'aa5500');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByLabelText('Barva 1 jako text')).toHaveValue('#0D5C52');
    expect(m.putPalette).not.toHaveBeenCalled();
  });
});

describe('colouring a služba and a činnost (saved at once)', () => {
  it('a služba gets exactly its four editable fields and the picked colour', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' }));
    await user.click(within(await screen.findByRole('group', { name: 'Paleta barev' })).getByRole('button', { name: 'Barva #2563EB' }));
    await waitFor(() => expect(m.updateService).toHaveBeenCalled());
    expect(m.updateService).toHaveBeenCalledWith('s1', { name: 'Prohlídky', description: 'Popis', sortOrder: 1, colorHex: '#2563EB' });
  });

  it('a činnost sends the WHOLE činnost with the new colour, so nothing else is cleared', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu činnosti Základní' }));
    await user.click(within(await screen.findByRole('group', { name: 'Paleta barev' })).getByRole('button', { name: 'Barva #DC2626' }));
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalled());
    expect(m.updateActivity).toHaveBeenCalledWith('a1', {
      name: 'Základní', durationMinutes: 30, color: '#111111', publicNote: 'pozn', isPubliclyBookable: true, requiresReportByEmail: true, requiresClubSharing: false,
      questionnaireRequirement: 'Required', sortOrder: 1, serviceItemId: 'p1', clinicServiceId: 's1', questionnaireDefinitionId: 'q1', colorHex: '#DC2626', parallelCapacity: 2,
      requiredDocumentTemplateIds: ['t1'],
    });
  });

  it('"Použít výchozí barvu" sends colorHex null for a činnost with a colour of its own', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu činnosti Komplexní' }));
    await user.click(await screen.findByRole('button', { name: 'Použít výchozí barvu' }));
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalled());
    expect(m.updateActivity.mock.calls[0][1]).toMatchObject({ colorHex: null, parallelCapacity: 2 });
  });

  it('offers "Použít výchozí barvu" for a služba too: the palette colour at its position', async () => {
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' }));
    await screen.findByRole('group', { name: 'Paleta barev' });
    expect(screen.getByRole('button', { name: 'Použít výchozí barvu' })).toBeInTheDocument();
  });

  it('offers the palette as the server holds it, so a new colour is available at once', async () => {
    m.getPalette.mockResolvedValue({ palette: [...PALETTE, '#112233'] });
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' }));
    expect(within(await screen.findByRole('group', { name: 'Paleta barev' })).getByRole('button', { name: 'Barva #112233' })).toBeInTheDocument();
  });

  it('says so, in a toast, when a služba colour is refused', async () => {
    m.updateService.mockRejectedValue(invalidSettings({}, 'Barva musí být zapsaná jako #RRGGBB.'));
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await user.click(await screen.findByRole('button', { name: 'Změnit barvu služby Prohlídky' }));
    await user.click(within(await screen.findByRole('group', { name: 'Paleta barev' })).getByRole('button', { name: 'Barva #2563EB' }));
    await waitFor(() => expect(m.updateService).toHaveBeenCalled());
  });
});

describe('Poslední změny', () => {
  it('asks the history under "calendar", where the server files the palette ("Barvy služeb: paleta …")', async () => {
    const { fetchSettingChanges } = await import('../../../components/settings/changesApi');
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    await screen.findByLabelText('Barva 1 jako text');
    await waitFor(() => expect(fetchSettingChanges).toHaveBeenCalledWith('calendar', 5));
  });
});

describe('loading', () => {
  it('says the palette could not be read and reads again on request', async () => {
    m.getPalette.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ palette: PALETTE });
    const user = userEvent.setup();
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    expect(await screen.findByText('Paletu barev se nepodařilo načíst.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByLabelText('Barva 1 jako text')).toBeInTheDocument();
  });

  it('keeps the palette editable when the služby cannot be read, and says so for them', async () => {
    m.listServices.mockRejectedValue(new Error('down'));
    renderScreen(<ServiceColorsPage />, '/nastaveni/barvy-sluzeb');
    expect(await screen.findByLabelText('Barva 1 jako text')).toBeInTheDocument();
    expect(await screen.findByText('Služby a činnosti se nepodařilo načíst.')).toBeInTheDocument();
  });
});
