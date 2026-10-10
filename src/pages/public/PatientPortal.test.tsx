/*
 * The patient portal's documents. What the patient sees is exactly what the
 * clinic released - the list comes from the server already filtered - so what
 * is worth pinning here is the page's half: each released document opens from
 * its own link, bound to this token, and an empty list says why it is empty.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PortalAppointment, PortalDashboard } from '../../api/patientPortal';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const openPortal = vi.fn();
const cancelPortalAppointment = vi.fn();

vi.mock('../../api/patientPortal', async () => {
  const actual = await vi.importActual<typeof import('../../api/patientPortal')>('../../api/patientPortal');
  return { ...actual, openPortal, cancelPortalAppointment };
});

// The help card reads the clinic's public contacts; a quiet clinic here keeps
// these tests about the portal itself.
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({
      name: 'Ordinace',
      email: '',
      phone: '',
      address: '',
      bookingEnabled: true,
    }),
  };
});

const { default: PatientPortal } = await import('./PatientPortal');

const dashboard = (over: Partial<PortalDashboard> = {}): PortalDashboard => ({
  givenName: 'Jan',
  familyName: 'Novák',
  appointments: [],
  pastAppointments: [],
  documents: [],
  invoices: [],
  ...over,
});

const renderPortal = (token = 'tok-123') =>
  render(
    <MemoryRouter initialEntries={[`/portal/${token}`]}>
      <Routes>
        <Route path="/portal/:token" element={<PatientPortal />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  openPortal.mockReset();
  cancelPortalAppointment.mockReset();
});

const inAWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);
const upcoming = (over: Partial<PortalAppointment> = {}): PortalAppointment => ({
  id: 'appt-1',
  activityName: 'Sportovní prohlídka',
  startUtc: inAWeek.toISOString(),
  endUtc: new Date(inAWeek.getTime() + 30 * 60 * 1000).toISOString(),
  status: 'Scheduled',
  cancelUntilUtc: new Date(inAWeek.getTime() - 24 * 3600 * 1000).toISOString(),
  ...over,
});

describe('cancelling an appointment from the patient portal', () => {
  it('offers a cancel only while the server says the deadline is still ahead', async () => {
    openPortal.mockResolvedValue(
      dashboard({
        appointments: [upcoming(), upcoming({ id: 'appt-2', cancelUntilUtc: null })],
      }),
    );
    renderPortal();

    expect(await screen.findAllByText('Sportovní prohlídka')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Zrušit termín' })).toHaveLength(1);
  });

  it('cancels through the token, then re-reads the dashboard from the server', async () => {
    openPortal
      .mockResolvedValueOnce(dashboard({ appointments: [upcoming()] }))
      .mockResolvedValueOnce(dashboard());
    cancelPortalAppointment.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPortal('tok-abc');

    await userEvent.click(await screen.findByRole('button', { name: 'Zrušit termín' }));

    await waitFor(() => expect(cancelPortalAppointment).toHaveBeenCalledWith('tok-abc', 'appt-1'));
    expect(await screen.findByText('Termín byl zrušen.')).toBeInTheDocument();
    expect(openPortal).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Zrušit termín' })).not.toBeInTheDocument();
  });

  it("shows the server's own reason when it refuses", async () => {
    const { PortalCancelError } = await import('../../api/patientPortal');
    openPortal.mockResolvedValue(dashboard({ appointments: [upcoming()] }));
    cancelPortalAppointment.mockRejectedValue(new PortalCancelError('Termín už je příliš blízko.', 409));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPortal();

    await userEvent.click(await screen.findByRole('button', { name: 'Zrušit termín' }));

    expect(await screen.findByText('Termín už je příliš blízko.')).toBeInTheDocument();
    expect(openPortal).toHaveBeenCalledTimes(1);
  });
});

describe('documents in the patient portal', () => {
  it('says why the list is empty when nothing has been released', async () => {
    openPortal.mockResolvedValue(dashboard());
    renderPortal();
    expect(await screen.findByText(/Jakmile vám je ordinace uvolní/)).toBeInTheDocument();
  });

  it('opens each released document from its own link, bound to this token', async () => {
    openPortal.mockResolvedValue(
      dashboard({
        documents: [
          { id: 'doc-1', title: 'Výpis ze zdravotní dokumentace (20. 5. 2026)', issuedAtUtc: '2026-09-30T10:00:00Z' },
        ],
      }),
    );
    renderPortal('tok-abc');

    expect(await screen.findByText('Výpis ze zdravotní dokumentace (20. 5. 2026)')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Otevřít dokument Výpis/ });
    expect(link.getAttribute('href')).toMatch(
      /\/api\/patient-portal\/tok-abc\/documents\/doc-1$/,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

/* ── Výsledky (artboard V-Vysledky) ── */

const session = (over: Partial<NonNullable<PortalDashboard['results']>[number]> = {}) => ({
  id: 'ses-1',
  sessionDate: '2026-09-24T07:30:00Z',
  practitionerName: 'MUDr. Nováková',
  restingHeartRateBpm: 0,
  maxHeartRateBpm: 191,
  vo2MaxMlMinKg: 54.2,
  anaerobicThresholdBpm: 168,
  systolicBloodPressure: 0,
  diastolicBloodPressure: 0,
  bodyFatPercentage: 0,
  muscleMassKg: 0,
  ...over,
});

/* Every column of contract C-M filled in. */
const FULL = {
  measuredOn: '2026-09-20',
  thresholdPercentVo2Max: 82,
  maxPowerWatts: 348,
  weightKg: 79.1,
  powerPerKg: 4.4,
  device: 'Cortex MetaMax',
  protocolType: 'Bicyklový ergometr',
  trainingZones: [
    { name: 'Regenerace', toBpm: 124 },
    { name: 'Vytrvalost', fromBpm: 125, toBpm: 148, note: 'dlouhé výjezdy' },
  ],
};

const tile = (label: string): HTMLElement => {
  const latest = screen.getByRole('region', { name: 'Poslední měření' });
  const element = within(latest).getByText(label).parentElement;
  if (element === null) throw new Error(`no tile for ${label}`);
  return element;
};

const openResults = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Výsledky' }));
  return screen.findByTestId('results-view');
};

describe('the results tab', () => {
  beforeEach(() => {
    setViewport(VIEWPORTS.desktop);
  });

  it('shows what the session stores and "—" for everything it does not', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [session()] }));
    renderPortal();
    await openResults();

    expect(screen.getByRole('heading', { level: 1, name: 'Moje výsledky' })).toBeInTheDocument();
    expect(screen.getByText('1 měření')).toBeInTheDocument();
    expect(within(tile('VO₂max')).getByText('54,2')).toBeInTheDocument();
    expect(within(tile('Maximální tep')).getByText('191')).toBeInTheDocument();
    expect(within(tile('Tep na prahu')).getByText('168')).toBeInTheDocument();
    // What the session does not carry is a dash, never a guess.
    for (const label of [
      'Klidový tep', 'Tělesný tuk', 'Svalová hmota', 'Krevní tlak', 'Hmotnost',
      'Práh v % VO₂max', 'Maximální výkon', 'Výkon na kg',
    ]) {
      expect(within(tile(label)).getByText('—')).toBeInTheDocument();
    }
  });

  it('draws a blood pressure when both numbers are there', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [session({ systolicBloodPressure: 120, diastolicBloodPressure: 80, bodyFatPercentage: 12.4 })] }));
    renderPortal();
    await openResults();

    expect(within(tile('Krevní tlak')).getByText('120/80')).toBeInTheDocument();
    expect(within(tile('Tělesný tuk')).getByText('12,4')).toBeInTheDocument();
  });

  it('reads every measured value from the columns of the result', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [session(FULL)] }));
    renderPortal();
    await openResults();

    expect(within(tile('Hmotnost')).getByText('79,1')).toBeInTheDocument();
    expect(within(tile('Práh v % VO₂max')).getByText('82')).toBeInTheDocument();
    expect(within(tile('Maximální výkon')).getByText('348')).toBeInTheDocument();
    expect(within(tile('Výkon na kg')).getByText('4,4')).toBeInTheDocument();
    expect(screen.getByText(/20\. 9\. 2026 · MUDr\. Nováková/)).toBeInTheDocument();
    const zones = screen.getByRole('list', { name: 'Tréninkové zóny' });
    expect(within(zones).getByText('Regenerace')).toBeInTheDocument();
    expect(within(zones).getByText('do 124 bpm')).toBeInTheDocument();
    expect(within(zones).getByText('125–148 bpm')).toBeInTheDocument();
    expect(within(zones).getByText('dlouhé výjezdy')).toBeInTheDocument();
    const facts = screen.getByText('Údaje o měření').parentElement as HTMLElement;
    expect(within(facts).getByText('Bicyklový ergometr')).toBeInTheDocument();
    expect(within(facts).getByText('Cortex MetaMax')).toBeInTheDocument();
  });

  it('never shows the notes of the doctor, even if an older API still sends them', async () => {
    openPortal.mockResolvedValue(dashboard({
      results: [session({ ...FULL, ...({ rawPractitionerNotes: 'Soukromá poznámka lékaře.\n\n[Ruční zápis]\nPřístroj: Starý\nMax. výkon: 999 W' } as object) })],
    }));
    renderPortal();
    await openResults();

    expect(screen.queryByText(/Soukromá poznámka/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ruční zápis/)).not.toBeInTheDocument();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    expect(screen.queryByText('Starý')).not.toBeInTheDocument();
  });

  it('draws "—" for the facts of the measurement it does not have', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [session()] }));
    renderPortal();
    await openResults();

    const facts = screen.getByText('Údaje o měření').parentElement as HTMLElement;
    expect(within(facts).getAllByText('—')).toHaveLength(2);
    expect(screen.queryByRole('list', { name: 'Tréninkové zóny' })).not.toBeInTheDocument();
  });

  it('says there are no measurements instead of drawing empty tiles or a chart', async () => {
    openPortal.mockResolvedValue(dashboard());
    renderPortal();
    await openResults();

    expect(screen.getAllByText('Zatím tu nejsou žádná měření.').length).toBeGreaterThan(0);
    expect(screen.queryByText('VO₂max')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('lists every measurement, newest first', async () => {
    openPortal.mockResolvedValue(dashboard({
      results: [
        session({ id: 'a', sessionDate: '2026-03-16T10:00:00Z', vo2MaxMlMinKg: 52.6 }),
        session({ id: 'b', sessionDate: '2026-09-24T10:00:00Z', vo2MaxMlMinKg: 54.2 }),
      ],
    }));
    renderPortal();
    await openResults();

    const table = screen.getByRole('table', { name: 'Všechna měření' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('24. 9. 2026')).toBeInTheDocument();
    expect(within(rows[2]).getByText('16. 3. 2026')).toBeInTheDocument();
  });

  it('the overview teases the latest measurement only when there is one', async () => {
    openPortal.mockResolvedValue(dashboard());
    const { unmount } = renderPortal();
    await screen.findByText(/Jakmile vám je ordinace uvolní/);
    expect(screen.queryByText('Jak se vyvíjíte')).not.toBeInTheDocument();
    unmount();

    openPortal.mockResolvedValue(dashboard({ results: [session()] }));
    renderPortal();
    expect(await screen.findByText('Jak se vyvíjíte')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Všechna měření' }));
    expect(await screen.findByTestId('results-view')).toBeInTheDocument();
  });

  it('says nothing about importing from a device on screen', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [session()] }));
    renderPortal();
    await openResults();
    expect(screen.queryByText(/import|Vald|zařízení/i)).not.toBeInTheDocument();
  });
});

describe('three layouts', () => {
  const withResults = () => openPortal.mockResolvedValue(
    dashboard({ appointments: [upcoming()], results: [session()] }),
  );

  it('phone: one column, "Objednat termín" pinned at the bottom, measurements as cards', async () => {
    setViewport(VIEWPORTS.phone);
    withResults();
    renderPortal();

    expect(await screen.findByText('Sportovní prohlídka')).toBeInTheDocument();
    const bar = document.querySelector('[data-pinned="true"]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(within(bar as HTMLElement).getByRole('link', { name: 'Objednat termín' })).toBeInTheDocument();

    await openResults();
    expect(screen.getByRole('list', { name: 'Všechna měření' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: nothing is pinned and measurements are a table', async (_n, width) => {
    setViewport(width);
    withResults();
    renderPortal();

    expect(await screen.findByText('Sportovní prohlídka')).toBeInTheDocument();
    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Portál' })).toBeInTheDocument();

    await openResults();
    expect(screen.getByRole('table', { name: 'Všechna měření' })).toBeInTheDocument();
  });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['iPad', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('results with all, some and no values on a %s', (name, width) => {
  beforeEach(() => setViewport(width));

  const listing = () => (name === 'phone'
    ? screen.getByRole('list', { name: 'Všechna měření' })
    : screen.getByRole('table', { name: 'Všechna měření' }));

  it('all values: the tiles and the list of every measurement carry the columns', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [session(FULL)] }));
    renderPortal();
    await openResults();

    expect(within(tile('Maximální výkon')).getByText('348')).toBeInTheDocument();
    expect(within(tile('Výkon na kg')).getByText('4,4')).toBeInTheDocument();
    const all = within(listing());
    expect(all.getByText('348 W')).toBeInTheDocument();
    expect(all.getByText('79,1 kg')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Tréninkové zóny' })).toBeInTheDocument();
  });

  it('some values: what is missing is a dash, what is there is shown', async () => {
    openPortal.mockResolvedValue(dashboard({
      results: [session({ maxPowerWatts: 300, weightKg: null, powerPerKg: null, thresholdPercentVo2Max: null, device: null, trainingZones: null })],
    }));
    renderPortal();
    await openResults();

    expect(within(tile('Maximální výkon')).getByText('300')).toBeInTheDocument();
    for (const label of ['Hmotnost', 'Výkon na kg', 'Práh v % VO₂max']) {
      expect(within(tile(label)).getByText('—'), label).toBeInTheDocument();
    }
    const all = within(listing());
    expect(all.getByText('300 W')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tréninkové zóny' })).not.toBeInTheDocument();
  });

  it('no values: the page says there are no measurements', async () => {
    openPortal.mockResolvedValue(dashboard({ results: [] }));
    renderPortal();
    await openResults();

    expect(screen.getAllByText('Zatím tu nejsou žádná měření.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Maximální výkon')).not.toBeInTheDocument();
  });
});

/*
 * Etapa 12, "ceny všude": the patient's appointments say what they cost. An
 * agreed price is shown as the plain amount - the patient sees their price,
 * never the list it was adjusted from.
 */
describe('prices in the patient portal', () => {
  it.each([['phone', VIEWPORTS.phone], ['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])(
    '%s: the next visit, the other upcoming ones and the past ones each carry "Cena"',
    async (_n, width) => {
      setViewport(width);
      openPortal.mockResolvedValue(
        dashboard({
          appointments: [
            upcoming({ id: 'next', agreedPriceCzk: 1200, listPriceCzk: 1600 }),
            upcoming({ id: 'later', agreedPriceCzk: null, listPriceCzk: 1600 }),
          ],
          pastAppointments: [
            upcoming({ id: 'was', startUtc: '2026-01-05T09:00:00Z', endUtc: '2026-01-05T09:30:00Z', status: 'Completed', cancelUntilUtc: null }),
          ],
        }),
      );
      renderPortal();

      const lines = await screen.findAllByTestId('price-line');
      expect(lines.map((l) => l.textContent?.replace(/\u00a0/g, ' '))).toEqual([
        'Cena: 1 200 Kč',
        'Cena: 1 600 Kč',
        'Cena na dotaz',
      ]);
      expect(screen.queryByText(/upraveno/)).not.toBeInTheDocument();
    },
  );
});
