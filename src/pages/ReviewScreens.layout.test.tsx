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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../test/viewport';

const fetchIntakeQueue = vi.fn();
const listFeedback = vi.fn();

vi.mock('../api/intakeReview', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/intakeReview')>()),
  fetchIntakeQueue,
  fetchIntakeDetail: vi.fn(),
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
  listFeedback.mockReset();
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
    expect(await screen.findByText('Fronta je prázdná')).toBeInTheDocument();
  });

  it('shows what failed and retries - never "Fronta je prázdná"', async () => {
    fetchIntakeQueue.mockRejectedValueOnce(new Error('503')).mockResolvedValue([intake('1')]);
    renderAt('phone', <IntakeReviewQueue />);
    expect(await screen.findByText(/Frontu ke kontrole se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.queryByText('Fronta je prázdná')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText(/Marková 1/)).toBeInTheDocument();
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
      expect(back).toHaveAttribute('href', '/');
      expect(back).toHaveStyle({ minHeight: '44px' });
    });
  });
});
