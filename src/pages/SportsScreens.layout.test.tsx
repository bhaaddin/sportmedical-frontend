/*
 * The sports screens at the three widths (Etapa 2 brief, rule 3).
 *
 * Phone (390): a list is a stack of cards, the screen's main action is pinned
 * at the bottom, filters scroll sideways. Tablet (834): a table with three
 * columns. Desktop (1440): the whole table. Every list also has a loading
 * placeholder, an empty state in Czech and an error state with "Zkusit znovu"
 * (rule 8) - a failed load is never drawn as an empty list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../test/viewport';

const injuriesGetAll = vi.fn();
const rtpGetByPatient = vi.fn();
const concussionGetByPatient = vi.fn();
const trainingGetByPatient = vi.fn();
const trainingGetAcwr = vi.fn();
const trainingGetLoadTrend = vi.fn();
const availabilityGetAll = vi.fn();

vi.mock('../api/injuries', () => ({ injuriesApi: { getAll: injuriesGetAll, create: vi.fn() } }));
vi.mock('../api/rtp', () => ({
  rtpApi: { getByPatient: rtpGetByPatient, create: vi.fn(), getById: vi.fn(), completeMilestone: vi.fn() },
}));
vi.mock('../api/concussion', () => ({
  concussionApi: { getByPatient: concussionGetByPatient, create: vi.fn(), updateStatus: vi.fn() },
}));
vi.mock('../api/training', () => ({
  trainingApi: {
    getByPatient: trainingGetByPatient, getAcwr: trainingGetAcwr, getLoadTrend: trainingGetLoadTrend, create: vi.fn(),
  },
}));
vi.mock('../api/availability', () => ({ availabilityApi: { getAll: availabilityGetAll, create: vi.fn() } }));
vi.mock('../api/wellness', () => ({ wellnessApi: { create: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

/* The picker searches the whole register; here it is one button that picks a patient. */
vi.mock('../components/patients/PatientPicker', () => ({
  default: ({ onChange }: { onChange: (p: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ id: 'p1', firstName: 'Jana', lastName: 'Marková' })}>
      Vybrat pacienta
    </button>
  ),
}));

const { default: Injuries } = await import('./Injuries');
const { default: Rtp } = await import('./Rtp');
const { default: Concussion } = await import('./Concussion');
const { default: Wellness } = await import('./Wellness');
const { default: TrainingLoad } = await import('./TrainingLoad');
const { default: Availability } = await import('./Availability');

const WIDTHS: ViewportName[] = ['phone', 'tablet', 'desktop'];
const NBSP = String.fromCharCode(0xa0);

function renderAt(width: ViewportName, ui: React.ReactElement) {
  setViewport(VIEWPORTS[width]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const headers = () => screen.queryAllByRole('columnheader').map((h) => h.textContent);

beforeEach(() => {
  [injuriesGetAll, rtpGetByPatient, concussionGetByPatient, trainingGetByPatient, trainingGetAcwr,
    trainingGetLoadTrend, availabilityGetAll].forEach((m) => m.mockReset());
  trainingGetAcwr.mockResolvedValue(null);
  trainingGetLoadTrend.mockResolvedValue([]);
  setViewport(VIEWPORTS.desktop);
});

/* ───────── Poranění ───────── */
const injury = (id: string, extra: object = {}) => ({
  id, patientId: 'p1', injuryDate: '2026-09-20T00:00:00Z', bodyRegion: 'Knee', specificLocation: 'mediální vaz',
  side: 'Left', type: 'Acute', severity: 2, status: 'Rehabilitating', mechanism: '', diagnosis: 'Distorze',
  practitioner: 'MUDr. Novák', estimatedDaysOut: 21, isRecurrence: false, notes: '', ...extra,
});

describe('Poranění', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the list out for that width', async () => {
      injuriesGetAll.mockResolvedValue([injury('i1'), injury('i2', { bodyRegion: 'Ankle', status: 'Cleared', actualDaysOut: 10 })]);
      const { container } = renderAt(width, <Injuries />);
      await screen.findAllByText(/Koleno/);

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        /* One pinned bar, and the action is not drawn a second time in the header. */
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
        expect(screen.getAllByRole('button', { name: /Nové poranění/ })).toHaveLength(1);
        expect(container.querySelector('[data-scroll="x"]')).not.toBeNull();
      } else if (width === 'tablet') {
        expect(container.querySelector('[data-layout="table-3"]')).not.toBeNull();
        expect(headers()).toEqual(['Datum', 'Oblast', 'Stav']);
        expect(container.querySelector('[data-pinned="true"]')).toBeNull();
      } else {
        expect(container.querySelector('[data-layout="table"]')).not.toBeNull();
        expect(headers()).toEqual(['Datum', 'Oblast', 'Strana', 'Závažnost', 'Stav', 'Diagnóza', 'Dny mimo']);
        expect(screen.getAllByRole('button', { name: /Nové poranění/ })).toHaveLength(1);
      }
    });
  });

  it('keeps a 44 px target on the pinned phone action', async () => {
    injuriesGetAll.mockResolvedValue([]);
    renderAt('phone', <Injuries />);
    const button = await screen.findByRole('button', { name: /Nové poranění/ });
    expect(button).toHaveStyle({ minHeight: '44px' });
  });

  it('says so when there are no injuries', async () => {
    injuriesGetAll.mockResolvedValue([]);
    renderAt('phone', <Injuries />);
    expect(await screen.findByText('Žádná poranění zatím neevidována')).toBeInTheDocument();
  });

  it('holds the space while loading', () => {
    injuriesGetAll.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('desktop', <Injuries />);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
  });

  it('shows what failed and retries - not an empty list', async () => {
    injuriesGetAll.mockRejectedValueOnce(new Error('503')).mockResolvedValue([injury('i1')]);
    renderAt('tablet', <Injuries />);
    expect(await screen.findByText(/Poranění se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.queryByText('Žádná poranění zatím neevidována')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Koleno')).toBeInTheDocument();
    expect(injuriesGetAll).toHaveBeenCalledTimes(2);
  });

  it('filters to the active injuries', async () => {
    injuriesGetAll.mockResolvedValue([injury('i1'), injury('i2', { bodyRegion: 'Ankle', status: 'Cleared' })]);
    renderAt('desktop', <Injuries />);
    await screen.findByText('Koleno');
    await userEvent.click(screen.getByRole('button', { name: /^Vyléčená/ }));
    expect(screen.queryByText('Koleno')).toBeNull();
    expect(screen.getByText('Hlezno')).toBeInTheDocument();
  });
});

/* ───────── Návrat do hry ───────── */
const protocol = (id: string) => ({
  id, injuryId: 'inj', patientId: 'p1', name: `Rehabilitace ${id}`, currentPhase: 'Subacute', progressPercent: 40, milestones: [],
});

async function loadProtocols() {
  await userEvent.type(screen.getByLabelText('ID pacienta'), 'p1');
  await userEvent.click(screen.getByRole('button', { name: 'Načíst protokoly' }));
}

describe('Návrat do hry', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lists protocols as cards and pins the new-protocol action on a phone', async () => {
      rtpGetByPatient.mockResolvedValue([protocol('a'), protocol('b')]);
      const { container } = renderAt(width, <Rtp />);
      await loadProtocols();
      await screen.findByText('Rehabilitace a');
      expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      /* The figure and its unit never part at a line break. */
      const progress = screen.getAllByText(/40 % dokončeno/);
      expect(progress).toHaveLength(2);
      expect(progress[0].textContent).toContain(`40${NBSP}%`);
      expect(container.querySelector('[data-pinned="true"]') !== null).toBe(width === 'phone');
      expect(screen.getAllByRole('button', { name: /Nový protokol/ })).toHaveLength(1);
    });
  });

  it('says so when a patient has no protocols', () => {
    renderAt('phone', <Rtp />);
    expect(screen.getByText('Žádné protokoly')).toBeInTheDocument();
  });

  it('shows what failed and retries', async () => {
    rtpGetByPatient.mockRejectedValueOnce(new Error('500')).mockResolvedValue([protocol('a')]);
    renderAt('desktop', <Rtp />);
    await loadProtocols();
    expect(await screen.findByText(/Protokoly se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Rehabilitace a')).toBeInTheDocument();
  });
});

/* ───────── Otřes mozku ───────── */
const concussion = (id: string) => ({
  id, patientId: 'p1', injuryDate: '2026-09-01T00:00:00Z', mechanism: 'Střet hlavou', severityGrade: 2,
  practitioner: 'MUDr. Novák', symptomScore: 14, lossOfConsciousness: false, status: 'Stage2',
});

describe('Protokol otřesu mozku', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the history out for that width and pins the save on a phone', async () => {
      concussionGetByPatient.mockResolvedValue([concussion('c1'), concussion('c2')]);
      const { container } = renderAt(width, <Concussion />);
      await userEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
      await waitFor(() => expect(container.querySelector('[data-layout]')).not.toBeNull());
      await screen.findAllByText(/Krok 2/);

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
      } else if (width === 'tablet') {
        expect(container.querySelector('[data-layout="table-3"]')).not.toBeNull();
        expect(headers()).toEqual(['Datum', 'Ošetřující', 'Stav']);
      } else {
        expect(headers()).toEqual(['Datum', 'Ošetřující', 'Mechanismus', 'Skóre', 'Závažnost', 'Stav']);
      }
      expect(screen.getAllByRole('button', { name: 'Vytvořit záznam' })).toHaveLength(1);
    });
  });

  it('says so when the patient has no concussion on record', async () => {
    concussionGetByPatient.mockResolvedValue([]);
    renderAt('tablet', <Concussion />);
    await userEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
    expect(await screen.findByText(/zatím není žádný záznam otřesu/)).toBeInTheDocument();
  });

  it('shows what failed and retries', async () => {
    concussionGetByPatient.mockRejectedValueOnce(new Error('500')).mockResolvedValue([concussion('c1')]);
    renderAt('phone', <Concussion />);
    await userEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
    expect(await screen.findByText(/Historii otřesů se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText(/Krok 2/)).toBeInTheDocument();
  });
});

/* ───────── Wellness ───────── */
describe('Denní wellness dotazník', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('has one submit, pinned only on a phone', () => {
      const { container } = renderAt(width, <Wellness />);
      expect(screen.getAllByRole('button', { name: /Odeslat denní wellness/ })).toHaveLength(1);
      expect(container.querySelector('[data-pinned="true"]') !== null).toBe(width === 'phone');
      /* Eight sliders, each one a card of its own - none is dropped on a narrow screen. */
      expect(screen.getAllByRole('slider')).toHaveLength(8);
    });
  });

  it('writes the score with a Czech decimal comma', () => {
    renderAt('desktop', <Wellness />);
    expect(screen.getByText('7,0')).toBeInTheDocument();
  });
});

/* ───────── Tréninkové zatížení ───────── */
const session = (id: string) => ({
  id, patientId: 'p1', sessionDate: '2026-09-28T00:00:00Z', type: 'Training', description: 'Intervaly',
  durationMinutes: 60, rpe: 6, sessionRPE: 360,
});

async function pickAthlete() {
  await userEvent.click(screen.getByRole('button', { name: 'Vybrat pacienta' }));
}

describe('Tréninkové zatížení', () => {
  it('asks for an athlete first', () => {
    renderAt('phone', <TrainingLoad />);
    expect(screen.getByText('Vyberte sportovce')).toBeInTheDocument();
  });

  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the sessions out for that width', async () => {
      trainingGetByPatient.mockResolvedValue([session('s1'), session('s2')]);
      const { container } = renderAt(width, <TrainingLoad />);
      await pickAthlete();
      await screen.findByRole('button', { name: /Zaznamenat/ });

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
        const durations = screen.getAllByText('60 min');
        expect(durations).toHaveLength(2);
        expect(durations[0].textContent).toBe(`60${NBSP}min`);
      } else if (width === 'tablet') {
        expect(headers()).toEqual(['Datum', 'Typ', 'Zátěž']);
      } else {
        expect(headers()).toEqual(['Datum', 'Typ', 'Popis', 'Trvání', 'sRPE', 'Zátěž']);
      }
      expect(screen.getAllByRole('button', { name: /^Zaznamenat$/ })).toHaveLength(1);
    });
  });

  it('says so when there are no sessions yet', async () => {
    trainingGetByPatient.mockResolvedValue([]);
    renderAt('tablet', <TrainingLoad />);
    await pickAthlete();
    expect(await screen.findByText(/Zatím žádné tréninky/)).toBeInTheDocument();
  });

  it('shows what failed and retries', async () => {
    trainingGetByPatient.mockRejectedValueOnce(new Error('500')).mockResolvedValue([session('s1')]);
    renderAt('desktop', <TrainingLoad />);
    await pickAthlete();
    expect(await screen.findByText(/Tréninková data se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Intervaly')).toBeInTheDocument();
  });
});

/* ───────── Dostupnost ───────── */
const avail = (id: string, status: string, name: string) => ({
  id, patientId: `${id}-uuid`, patientName: name, date: '2026-09-30T00:00:00Z', status, reason: 'Zranění kolene',
  expectedReturnDate: '2026-11-01T00:00:00Z', updatedBy: 'MUDr. Novák',
});

describe('Dostupnost sportovců', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the athletes out for that width', async () => {
      availabilityGetAll.mockResolvedValue([avail('a1', 'Unavailable', 'Jan Novák'), avail('a2', 'Available', 'Eva Černá')]);
      const { container } = renderAt(width, <Availability />);
      await screen.findByText('Jan Novák');

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
        expect(container.querySelector('[data-scroll="x"]')).not.toBeNull();
      } else if (width === 'tablet') {
        expect(headers()).toEqual(['Sportovec', 'Stav', 'Návrat']);
      } else {
        expect(headers()).toEqual(['Sportovec', 'Stav', 'Důvod', 'Návrat', 'Zapsáno']);
      }
      expect(screen.getAllByRole('button', { name: 'Přidat' })).toHaveLength(1);
    });
  });

  it('filters by state', async () => {
    availabilityGetAll.mockResolvedValue([avail('a1', 'Unavailable', 'Jan Novák'), avail('a2', 'Available', 'Eva Černá')]);
    renderAt('desktop', <Availability />);
    await screen.findByText('Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: /^K dispozici/ }));
    expect(screen.queryByText('Jan Novák')).toBeNull();
    expect(within(screen.getByRole('table')).getByText('Eva Černá')).toBeInTheDocument();
  });

  it('says so when nobody is recorded', async () => {
    availabilityGetAll.mockResolvedValue([]);
    renderAt('phone', <Availability />);
    expect(await screen.findByText('Žádné záznamy o dostupnosti')).toBeInTheDocument();
  });

  it('shows what failed and retries', async () => {
    availabilityGetAll.mockRejectedValueOnce(new Error('500')).mockResolvedValue([avail('a1', 'Modified', 'Jan Novák')]);
    renderAt('phone', <Availability />);
    expect(await screen.findByText(/Dostupnost sportovců se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Jan Novák')).toBeInTheDocument();
  });
});
