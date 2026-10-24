/*
 * The review queue, the patient feedback list, the sign-in and the 404 at the
 * three widths (Etapa 2 brief, rule 3 and rule 8).
 *
 * The queue keeps one card per submission at every width, but on a phone its
 * actions are full-width 44 px buttons and its dialogs take the whole screen.
 * The feedback list is cards / three columns / four columns. The sign-in and
 * the 404 are one centred card everywhere with a 44 px primary action.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../test/viewport';

const fetchIntakeQueue = vi.fn();
const fetchIntakeDetail = vi.fn();
const registerIntake = vi.fn();
const linkIntake = vi.fn();
const listFeedback = vi.fn();

vi.mock('../api/intakeReview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/intakeReview')>()),
  fetchIntakeQueue,
  fetchIntakeDetail,
  registerIntake,
  linkIntake,
}));
vi.mock('../api/feedback', () => ({ FEEDBACK_QUERY_KEY: ['feedback'], listFeedback }));
vi.mock('../api/auth', () => ({
  authApi: { login: vi.fn(), activate: vi.fn() },
  isSecondFactorChallenge: () => false,
}));

const { default: IntakeReviewQueue } = await import('./IntakeReviewQueue');
const { default: FeedbackReviewPage } = await import('./FeedbackReviewPage');
const { default: Login } = await import('./Login');
const { default: NotFound } = await import('./NotFound');

const WIDTHS: ViewportName[] = ['phone', 'tablet', 'desktop'];

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
  fetchIntakeQueue.mockReset();
  fetchIntakeDetail.mockReset();
  registerIntake.mockReset().mockResolvedValue(undefined);
  linkIntake.mockReset().mockResolvedValue(undefined);
  listFeedback.mockReset();
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register']));
  setViewport(VIEWPORTS.desktop);
});

/* ───────── Fronta ke kontrole ───────── */
const intake = (id: string) => ({
  intakeId: id, referenceNumber: `R-${id}`, givenName: 'Jana', familyName: `Marková ${id}`, dateOfBirth: '1990-01-02',
  sex: 'F', outcome: 1, topScore: 85, suppliedBirthNumber: true, hasCzechPublicHealthInsurance: true,
  submittedAtUtc: '2026-10-01T08:00:00Z',
});

describe('Fronta ke kontrole', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('draws one card per submission with 44 px actions on touch widths', async () => {
      fetchIntakeQueue.mockResolvedValue([intake('1'), intake('2')]);
      renderAt(width, <IntakeReviewQueue />);
      await screen.findByText(/Marková 1/);
      expect(screen.getAllByRole('button', { name: /Vytvořit nového pacienta/ })).toHaveLength(2);
      const reject = screen.getAllByRole('button', { name: 'Zamítnout' })[0];
      if (width === 'desktop') {
        expect(reject).not.toHaveStyle({ minHeight: '44px' });
      } else {
        expect(reject).toHaveStyle({ minHeight: '44px' });
      }
    });
  });

  it('opens its dialog full-screen on a phone and as a dialog on a desktop', async () => {
    fetchIntakeQueue.mockResolvedValue([intake('1')]);
    const phone = renderAt('phone', <IntakeReviewQueue />);
    await userEvent.click(await screen.findByRole('button', { name: 'Zamítnout' }));
    expect(document.querySelector('[data-layout="fullscreen"]')).not.toBeNull();
    phone.unmount();

    const desktop = renderAt('desktop', <IntakeReviewQueue />);
    await userEvent.click(await screen.findByRole('button', { name: 'Zamítnout' }));
    expect(document.querySelector('[data-layout="dialog"]')).not.toBeNull();
    desktop.unmount();
  });

  it('holds the space while loading', () => {
    fetchIntakeQueue.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('phone', <IntakeReviewQueue />);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
  });

  it('says the queue is empty only when it was read and is empty', async () => {
    fetchIntakeQueue.mockResolvedValue([]);
    renderAt('tablet', <IntakeReviewQueue />);
    expect(await screen.findByText(/Fronta je prázdná/)).toBeInTheDocument();
  });

  it('shows what failed and retries - never "Fronta je prázdná"', async () => {
    fetchIntakeQueue.mockRejectedValueOnce(new Error('503')).mockResolvedValue([intake('1')]);
    renderAt('phone', <IntakeReviewQueue />);
    expect(await screen.findByText(/Frontu ke kontrole se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.queryByText(/Fronta je prázdná/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText(/Marková 1/)).toBeInTheDocument();
  });
});

describe('Fronta ke kontrole as shelves', () => {
  const at = (id: string, submittedAtUtc: string) => ({ ...intake(id), submittedAtUtc });

  it('puts the submissions on one shelf, the one that waited longest first', async () => {
    fetchIntakeQueue.mockResolvedValue([at('new', '2026-10-03T08:00:00Z'), at('old', '2026-09-01T08:00:00Z')]);
    renderAt('desktop', <IntakeReviewQueue />);
    const shelf = await screen.findByRole('region', { name: 'Čeká na rozhodnutí' });
    const names = within(shelf).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Jana Marková old', 'Jana Marková new']);
    expect(within(shelf).getByLabelText('Počet: 2')).toBeInTheDocument();
  });

  it('offers the registration link from the empty queue only to someone who manages it', async () => {
    fetchIntakeQueue.mockResolvedValue([]);
    const without = renderAt('desktop', <IntakeReviewQueue />);
    await screen.findByText(/Fronta je prázdná/);
    expect(screen.queryByRole('link', { name: 'Odkaz pro registraci' })).toBeNull();
    without.unmount();

    localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.register', 'settings.clinic.manage']));
    renderAt('desktop', <IntakeReviewQueue />);
    expect(await screen.findByRole('link', { name: 'Odkaz pro registraci' })).toHaveAttribute('href', '/nastaveni/odkaz-registrace');
  });

  it('lists what was just decided, and links a merge to the patient it joined', async () => {
    fetchIntakeQueue.mockResolvedValue([intake('1'), intake('2')]);
    fetchIntakeDetail.mockResolvedValue({
      candidates: [{ patientId: 'pat-9', score: 90, signals: {
        givenNameMatches: true, familyNameMatches: true, dateOfBirthMatches: true, emailMatches: false, emailIsVerified: false,
        phoneMatches: false, phoneIsVerified: false, anchorMatches: false, nameAndDateOfBirthMatch: true,
      } }],
    });
    const user = userEvent.setup();
    renderAt('desktop', <IntakeReviewQueue />);

    await user.click((await screen.findAllByRole('button', { name: /Vytvořit nového pacienta/ }))[0]);
    const done = await screen.findByRole('region', { name: 'Právě vyřízeno' });
    expect(within(done).getByText('Založen nový pacient')).toBeInTheDocument();
    expect(registerIntake).toHaveBeenCalledWith('1');

    await user.click(screen.getByRole('button', { name: /Zobrazit možné shody/ }));
    expect(await screen.findByRole('link', { name: 'Otevřít kartu pacienta' })).toHaveAttribute('href', '/patients/pat-9');
    await user.click(screen.getByRole('button', { name: 'Sloučit s tímto pacientem' }));
    await user.type(screen.getByLabelText('Důvod sloučení'), 'Ověřeno u pacienta');
    await user.click(screen.getByRole('button', { name: 'Sloučit' }));

    expect(linkIntake).toHaveBeenCalledWith('2', 'pat-9', 'Ověřeno u pacienta');
    expect(await within(done).findByText('Sloučeno')).toBeInTheDocument();
    /* the dialog's exit leaves the page aria-hidden for a moment */
    expect(await within(done).findByRole('link', { name: /Marková 2/ })).toHaveAttribute('href', '/patients/pat-9');
    expect(await screen.findByText(/Fronta je prázdná/)).toBeInTheDocument();
  });
});

/* ───────── Hodnocení pacientů ───────── */
const feedback = (id: string, rating: number | null, comment: string | null) => ({
  id, appointmentId: `a-${id}`, patientId: `p-${id}`, rating, comment,
  invitedAtUtc: '2026-09-29T08:00:00Z', submittedAtUtc: '2026-09-30T09:15:00Z',
});

describe('Hodnocení pacientů', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the answers out for that width', async () => {
      listFeedback.mockResolvedValue([feedback('1', 5, 'Skvělé jednání'), feedback('2', 4, null)]);
      const { container } = renderAt(width, <FeedbackReviewPage />);
      await screen.findByText('Skvělé jednání');

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
        expect(screen.getAllByRole('link', { name: 'Karta pacienta' })).toHaveLength(2);
      } else if (width === 'tablet') {
        expect(container.querySelector('[data-layout="table-3"]')).not.toBeNull();
        expect(headers()).toEqual(['Hodnocení', 'Komentář', 'Odesláno']);
      } else {
        expect(headers()).toEqual(['Hodnocení', 'Komentář', 'Odesláno', 'Pacient']);
      }
      expect(screen.getByText('4,5 / 5')).toBeInTheDocument();
    });
  });

  it('says so when nobody has answered', async () => {
    listFeedback.mockResolvedValue([]);
    renderAt('phone', <FeedbackReviewPage />);
    expect(await screen.findByText(/Zatím žádné hodnocení/)).toBeInTheDocument();
  });

  it('holds the space while loading', () => {
    listFeedback.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('tablet', <FeedbackReviewPage />);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
  });

  it('shows what failed and retries', async () => {
    listFeedback.mockRejectedValueOnce(new Error('500')).mockResolvedValue([feedback('1', 5, 'Skvělé jednání')]);
    renderAt('desktop', <FeedbackReviewPage />);
    expect(await screen.findByText(/Hodnocení se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Skvělé jednání')).toBeInTheDocument();
  });
});

describe('Hodnocení pacientů as shelves', () => {
  it('puts a low rating on K vyřízení, linked to the card, and shows the summary', async () => {
    listFeedback.mockResolvedValue([feedback('1', 1, 'Dlouho jsem čekal'), feedback('2', 5, null)]);
    renderAt('desktop', <FeedbackReviewPage />);

    const low = await screen.findByRole('region', { name: 'K vyřízení' });
    expect(within(low).getByText(/Dlouho jsem čekal/)).toBeInTheDocument();
    expect(within(low).getByRole('link', { name: 'Karta pacienta' })).toHaveAttribute('href', '/patients/p-1');
    expect(within(screen.getByRole('region', { name: 'Souhrn' })).getByText('3,0 / 5')).toBeInTheDocument();
  });

  it('has no K vyřízení shelf when nobody rated low', async () => {
    listFeedback.mockResolvedValue([feedback('1', 4, 'Dobré')]);
    renderAt('desktop', <FeedbackReviewPage />);
    await screen.findByText('Dobré');
    expect(screen.queryByRole('region', { name: 'K vyřízení' })).toBeNull();
  });

  it('draws no link to a card for someone who may not open patients', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.register']));
    listFeedback.mockResolvedValue([feedback('1', 1, 'Dlouho jsem čekal')]);
    renderAt('desktop', <FeedbackReviewPage />);
    await screen.findAllByText(/Dlouho jsem čekal/);
    expect(screen.queryByRole('link', { name: 'Karta pacienta' })).toBeNull();
    expect(headers()).toEqual(['Hodnocení', 'Komentář', 'Odesláno']);
  });
});

/* ───────── Přihlášení ───────── */
describe('Přihlášení', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('is one centred card with one field per row and a full-width 44 px button', () => {
      const { container } = renderAt(width, <Login />);
      expect(container.querySelectorAll('[data-layout="login-card"]')).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: 'SportMedical' })).toBeInTheDocument();
      expect(screen.getByLabelText(/E-mail/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Heslo/)).toBeInTheDocument();
      const submit = screen.getByRole('button', { name: 'Přihlásit se' });
      expect(submit).toHaveStyle({ minHeight: '44px' });
      expect(submit.className).toContain('MuiButton-fullWidth');
      /* Fields stack: nothing is laid beside the e-mail field. */
      expect(container.querySelectorAll('form .MuiGrid-root')).toHaveLength(0);
    });
  });
});

/* ───────── 404 ───────── */
describe('Stránka nenalezena', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('is a kit card with a 44 px way back to the overview', () => {
      const { container } = renderAt(width, <NotFound />);
      expect(container.querySelectorAll('[data-layout="not-found"]')).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
      const back = screen.getByRole('link', { name: 'Zpět na přehled' });
      expect(back).toHaveAttribute('href', '/prehled');
      expect(back).toHaveStyle({ minHeight: '44px' });
    });
  });
});
