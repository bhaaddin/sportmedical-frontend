/*
 * The doctor's manual entry writes the values into real columns (contract C-M)
 * and can edit a stored session. At 390 / 834 / 1440.
 *
 * What would have to break for these to fail: a value travelling in the notes
 * again, a PUT that is really a POST, a server refusal that is not shown at its
 * field, a form that lets an eleventh zone in, or one that sends the computed
 * W/kg.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { pragueDateKey } from '../../../utils/time';

const getByPatient = vi.fn();
const createSession = vi.fn();
const updateSession = vi.fn();
const listActivities = vi.fn();

vi.mock('../../../api/patients', () => ({ patientsApi: { search: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../api/diagnostics', async () => {
  const actual = await vi.importActual<typeof import('../../../api/diagnostics')>('../../../api/diagnostics');
  return { ...actual, diagnosticsApi: { getByPatient, create: createSession, update: updateSession, downloadPdf: vi.fn() } };
});
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: ManualResultsForm } = await import('../ManualResultsForm');

const session = (over: Record<string, unknown> = {}) => ({
  id: 's1', patientId: 'p1', sessionDate: '2026-09-20T08:00:00Z', practitionerName: 'MUDr. Test',
  restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52.5, anaerobicThresholdBpm: 160,
  systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41,
  requiresDoctorReview: false, createdAtUtc: '2026-09-20T08:00:00Z', ...over,
});

const queryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

const renderForm = (props: Record<string, unknown> = { patientId: 'p1' }) => {
  const onSaved = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient()}>
      <MemoryRouter>
        <ManualResultsForm {...props} onSaved={onSaved} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, onSaved };
};

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillRequired = () => {
  type(/^VO₂max/, '52,5');
  type(/^Klidový tep/, '58');
  type(/^Max\. tep/, '190');
  type(/^Tep anaerobního prahu/, '160');
  type(/^Tělesný tuk/, '12');
  type(/^Svalová hmota/, '41');
  type(/^Systolický tlak/, '118');
  type(/^Diastolický tlak/, '76');
};

const save = () => fireEvent.click(screen.getByRole('button', { name: /^Uložit (hodnoty|změny)$/ }));

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Lékařová' }));
  getByPatient.mockReset().mockResolvedValue([]);
  createSession.mockReset().mockResolvedValue(session());
  updateSession.mockReset().mockResolvedValue(session());
  listActivities.mockReset().mockResolvedValue({ activities: [] });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['iPad', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('on a %s', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('POSTs every value as its own field, with nothing in the notes', async () => {
    const { onSaved } = renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();
    type(/^Datum měření/, '2026-09-18');
    type(/^Typ protokolu/, 'Spiroergometrie');
    type(/^Přístroj/, 'Cortex');
    type(/^Práh v % VO₂max/, '82');
    type(/^Max\. výkon/, '320');
    type(/^Hmotnost/, '78,4');
    fireEvent.click(screen.getByRole('button', { name: 'Přidat zónu' }));
    type('Zóna 1', 'Aerobní');
    type('Zóna 1 od', '120');
    type('Zóna 1 do', '150');
    type('Zóna 1 poznámka', 'rozcvičení');

    save();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(updateSession).not.toHaveBeenCalled();
    const sent = createSession.mock.calls[0][0];
    expect(sent).toEqual({
      patientId: 'p1',
      practitionerName: 'Jana Lékařová',
      restingHeartRateBpm: 58,
      maxHeartRateBpm: 190,
      vo2MaxMlMinKg: 52.5,
      anaerobicThresholdBpm: 160,
      systolicBloodPressure: 118,
      diastolicBloodPressure: 76,
      bodyFatPercentage: 12,
      muscleMassKg: 41,
      measuredOn: '2026-09-18',
      protocolType: 'Spiroergometrie',
      device: 'Cortex',
      thresholdPercentVo2Max: 82,
      maxPowerWatts: 320,
      weightKg: 78.4,
      trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'rozcvičení' }],
    });
    expect(JSON.stringify(sent)).not.toMatch(/Ruční zápis/);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('sends the notes of the doctor as the notes, and only that', async () => {
    renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();
    type(/^Poznámky lékaře/, 'Měřeno nalačno.');
    type(/^Přístroj/, 'Cortex');

    save();

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession.mock.calls[0][0].rawPractitionerNotes).toBe('Měřeno nalačno.');
  });

  it('opens an existing session prefilled and saves it with PUT, without the patient', async () => {
    const stored = session({
      measuredOn: '2026-09-18', thresholdPercentVo2Max: 82, maxPowerWatts: 320, weightKg: 78.4, powerPerKg: 4.08,
      device: 'Cortex', protocolType: 'Spiroergometrie', rawPractitionerNotes: 'Nalačno.',
      trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'start' }],
    });
    const { onSaved } = renderForm({ patientId: 'p1', session: stored });

    expect((await screen.findByLabelText(/^VO₂max/) as HTMLInputElement).value).toBe('52,5');
    expect((screen.getByLabelText(/^Datum měření/) as HTMLInputElement).value).toBe('2026-09-18');
    expect((screen.getByLabelText(/^Max\. výkon/) as HTMLInputElement).value).toBe('320');
    expect((screen.getByLabelText(/^Hmotnost/) as HTMLInputElement).value).toBe('78,4');
    expect((screen.getByLabelText(/^Přístroj/) as HTMLInputElement).value).toBe('Cortex');
    expect((screen.getByLabelText(/^Typ protokolu/) as HTMLInputElement).value).toBe('Spiroergometrie');
    expect((screen.getByLabelText('Zóna 1') as HTMLInputElement).value).toBe('Aerobní');
    expect((screen.getByLabelText('Zóna 1 poznámka') as HTMLInputElement).value).toBe('start');
    expect((screen.getByLabelText(/^Poznámky lékaře/) as HTMLTextAreaElement).value).toBe('Nalačno.');
    expect(screen.queryByRole('button', { name: 'Uložit hodnoty' })).not.toBeInTheDocument();

    type(/^Max\. výkon/, '330');
    type(/^Přístroj/, '');
    save();

    await waitFor(() => expect(updateSession).toHaveBeenCalledTimes(1));
    expect(createSession).not.toHaveBeenCalled();
    const [id, body] = updateSession.mock.calls[0];
    expect(id).toBe('s1');
    expect(body).not.toHaveProperty('patientId');
    expect(body).not.toHaveProperty('powerPerKg');
    expect(body).toMatchObject({
      maxPowerWatts: 330, device: null, weightKg: 78.4, thresholdPercentVo2Max: 82, measuredOn: '2026-09-18',
      protocolType: 'Spiroergometrie', rawPractitionerNotes: 'Nalačno.',
      trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'start' }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('shows what the server refuses at the field it names, and keeps what was typed', async () => {
    updateSession.mockRejectedValue({
      response: { status: 422, data: { errors: {
        ThresholdPercentVo2Max: ['Práh musí být v rozmezí 0 až 100.'],
        'TrainingZones[0].Name': ['Název zóny už existuje.'],
        Device: ['Přístroj je moc dlouhý.'],
      } } },
    });
    const { onSaved } = renderForm({
      patientId: 'p1',
      session: session({ thresholdPercentVo2Max: 82, device: 'Cortex', trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150 }] }),
    });
    await screen.findByLabelText(/^VO₂max/);

    save();

    expect(await screen.findByText('Práh musí být v rozmezí 0 až 100.')).toBeInTheDocument();
    expect(screen.getByText('Název zóny už existuje.')).toBeInTheDocument();
    expect(screen.getByText('Přístroj je moc dlouhý.')).toBeInTheDocument();
    expect(screen.getByText('Je potřeba opravit 3 pole.')).toBeInTheDocument();
    /* each message sits at its own field */
    expect(screen.getByLabelText(/^Práh v % VO₂max/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Zóna 1')).toHaveAttribute('aria-invalid', 'true');
    expect((screen.getByLabelText(/^VO₂max/) as HTMLInputElement).value).toBe('52,5');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says why when the server refuses without naming a field', async () => {
    createSession.mockRejectedValue({ response: { data: { message: 'Pacient nenalezen.' } } });
    renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();

    save();

    expect(await screen.findByText('Pacient nenalezen.')).toBeInTheDocument();
  });

  it('shows a 404 on edit as a plain failure, not as a crash', async () => {
    updateSession.mockRejectedValue({ response: { status: 404, data: {} } });
    renderForm({ patientId: 'p1', session: session() });
    await screen.findByLabelText(/^VO₂max/);

    save();

    expect(await screen.findByText('Hodnoty se nepodařilo uložit. Zkuste to znovu.')).toBeInTheDocument();
  });
});

describe('the form', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('dates the measurement today by default, and the date can be changed', async () => {
    renderForm();

    const date = await screen.findByLabelText(/^Datum měření/) as HTMLInputElement;
    expect(date.value).toBe(pragueDateKey(new Date().toISOString()));
    type(/^Datum měření/, '2026-01-05');
    expect(date.value).toBe('2026-01-05');
  });

  it('shows power per kg live as a hint and never as a field', async () => {
    renderForm();
    await screen.findByLabelText(/^VO₂max/);
    const hint = screen.getByTestId('power-per-kg');

    expect(within(hint).getByText('—')).toBeInTheDocument();
    type(/^Max\. výkon/, '320');
    type(/^Hmotnost/, '78,4');

    expect(within(hint).getByText('4,08 W/kg')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Výkon na kg/)).not.toBeInTheDocument();
  });

  it('adds zones up to ten, then stops, and a removed zone makes room again', async () => {
    renderForm();
    await screen.findByLabelText(/^VO₂max/);
    const add = () => screen.getByRole('button', { name: 'Přidat zónu' });

    for (let i = 0; i < 10; i += 1) fireEvent.click(add());

    expect(screen.getAllByTestId('training-zone')).toHaveLength(10);
    expect(add()).toBeDisabled();
    expect(screen.getByText('Zón je nejvýše 10.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Odebrat zónu 4' }));
    expect(screen.getAllByTestId('training-zone')).toHaveLength(9);
    expect(add()).toBeEnabled();
  });

  it('refuses a zone without a name or with its start after its end, and sends nothing', async () => {
    renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Přidat zónu' }));
    type('Zóna 1 od', '150');
    type('Zóna 1 do', '120');

    save();

    expect(await screen.findByText('Pojmenujte zónu.')).toBeInTheDocument();
    expect(screen.getByText('Začátek zóny musí být nižší než konec.')).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('suggests the devices and protocols already used on this patient, and still takes anything typed', async () => {
    getByPatient.mockResolvedValue([
      session({ device: 'Cortex MetaMax', protocolType: 'Spiroergometrie' }),
      session({ id: 's2', device: 'cortex metamax', protocolType: 'Stupňovaný test' }),
      session({ id: 's3', device: null }),
    ]);
    listActivities.mockResolvedValue({ activities: [{ id: 'a1', name: 'InBody' }] });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByLabelText(/^Přístroj/));
    const devices = await screen.findAllByRole('option');
    expect(devices.map((o) => o.textContent)).toEqual(['Cortex MetaMax']);
    await user.keyboard('{Escape}');

    await user.click(screen.getByLabelText(/^Typ protokolu/));
    const protocols = await screen.findAllByRole('option');
    expect(protocols.map((o) => o.textContent)).toEqual(['InBody', 'Spiroergometrie', 'Stupňovaný test']);
    await user.keyboard('{Escape}');

    fillRequired();
    await user.type(screen.getByLabelText(/^Přístroj/), 'Nový přístroj');
    save();
    await waitFor(() => expect(createSession).toHaveBeenCalled());
    expect(createSession.mock.calls[0][0].device).toBe('Nový přístroj');
  });

  it('draws no help text claiming the values go to the notes', async () => {
    const { container } = renderForm();
    await screen.findByLabelText(/^VO₂max/);

    expect(container.textContent).not.toMatch(/Ruční zápis/);
    expect(container.textContent).not.toMatch(/uloží do poznámek/);
  });
});
