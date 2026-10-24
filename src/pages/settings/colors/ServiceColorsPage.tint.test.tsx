/*
 * The planner tint for the whole clinic: saved in the calendar display settings when the server keeps `plannerTintColor` and the
 * person may change clinic settings; otherwise per browser, as before. A browser's own tint wins and can be dropped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import ServiceColorsPage from '../ServiceColorsPage';
import { ThemePrefsContext, type ThemePrefs } from '../../../themePrefs';
import { CALENDAR_DISPLAY_OFFLINE } from '../../../api/displaySettings';

const m = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), may: { value: true } }));
vi.mock('../../../api/displaySettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/displaySettings')>();
  return { ...actual, readCalendarDisplay: m.read, saveCalendarDisplay: m.save };
});
vi.mock('../../../auth/usePermission', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/usePermission')>();
  return { ...actual, usePermission: () => m.may.value };
});
vi.mock('../../../api/serviceColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/serviceColors')>();
  return { ...actual, serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: ['#0D5C52', '#2B3440', '#8A5A2F', '#27603A', '#9B3B1B', '#4A5564'] }), put: vi.fn() } };
});
vi.mock('../../../api/clinicServices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clinicServices')>();
  return { ...actual, clinicServicesApi: { ...actual.clinicServicesApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../../../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } };
});
vi.mock('../../../api/calendars', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/calendars')>();
  return { ...actual, calendarsApi: { ...actual.calendarsApi, list: vi.fn().mockResolvedValue([]) } };
});
vi.mock('../../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const response = (plannerTintColor?: string | null) => ({
  settings: { ...CALENDAR_DISPLAY_OFFLINE, lunchFrom: '12:00', lunchTo: '12:30', ...(plannerTintColor === undefined ? {} : { plannerTintColor }) },
  defaults: CALENDAR_DISPLAY_OFFLINE,
  hoverFieldCatalogue: [],
});

function renderPage(own: string | null = null) {
  const setPlannerTint = vi.fn();
  const prefs: ThemePrefs = { accent: '#0E7C66', mode: 'dark', setAccent: vi.fn(), setMode: vi.fn(), plannerTint: own, setPlannerTint };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemePrefsContext.Provider value={prefs}>
        <MemoryRouter initialEntries={['/nastaveni/barvy-sluzeb']}>
          <ServiceColorsPage />
        </MemoryRouter>
      </ThemePrefsContext.Provider>
    </QueryClientProvider>,
  );
  return { setPlannerTint };
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewport(VIEWPORTS.desktop);
  m.may.value = true;
  m.save.mockImplementation(async (s: { plannerTintColor?: string }) => response(s.plannerTintColor === '' ? null : s.plannerTintColor));
});

describe('Barva plánovače for the whole clinic', () => {
  it('a server with the field and a settings manager: a pick is saved for everybody, with every other setting carried back', async () => {
    m.read.mockResolvedValue(response(null));
    const { setPlannerTint } = renderPage();
    expect(await screen.findByText('Platí pro celou kliniku, na všech počítačích.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Barva plánovače #2563EB' }));
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(1));
    expect(m.save.mock.calls[0][0]).toMatchObject({ plannerTintColor: '#2563EB', lunchFrom: '12:00', lunchTo: '12:30', slotMinutes: CALENDAR_DISPLAY_OFFLINE.slotMinutes });
    await waitFor(() => expect(setPlannerTint).toHaveBeenCalledWith(null));
  });

  it('"Sledovat barvu aplikace" clears the clinic tint (an empty string, never a left-out field)', async () => {
    m.read.mockResolvedValue(response('#2563EB'));
    renderPage();
    await userEvent.click(await screen.findByTestId('tint-follow'));
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(1));
    expect(m.save.mock.calls[0][0].plannerTintColor).toBe('');
  });

  it('a browser with its own tint is told so and can drop it', async () => {
    m.read.mockResolvedValue(response('#2563EB'));
    const { setPlannerTint } = renderPage('#7C3AED');
    expect(await screen.findByTestId('tint-browser-own')).toHaveTextContent('#7C3AED');
    await userEvent.click(screen.getByRole('button', { name: 'Použít barvu kliniky' }));
    expect(setPlannerTint).toHaveBeenCalledWith(null);
    expect(m.save).not.toHaveBeenCalled();
  });

  it('an older server (no field) keeps the tint in this browser, and nothing is written to the server', async () => {
    m.read.mockResolvedValue(response(undefined));
    const { setPlannerTint } = renderPage();
    expect(await screen.findByText('Platí jen v tomto prohlížeči.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Barva plánovače #2563EB' }));
    expect(setPlannerTint).toHaveBeenCalledWith('#2563EB');
    expect(m.save).not.toHaveBeenCalled();
  });

  it('without settings.clinic.manage the pick stays in this browser, and the person is told who changes it for everybody', async () => {
    m.may.value = false;
    m.read.mockResolvedValue(response('#2563EB'));
    const { setPlannerTint } = renderPage();
    expect(await screen.findByText(/Barvu pro celou kliniku mění správce nastavení\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Barva plánovače #2563EB' }));
    expect(setPlannerTint).toHaveBeenCalledWith('#2563EB');
    expect(m.save).not.toHaveBeenCalled();
  });
});
