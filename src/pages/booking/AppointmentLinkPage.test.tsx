/*
 * The page of one appointment (route 36, where a notification and every appointment chip land): it opens with the detail
 * (the notification is about something to act on), and behind it the appointment is a shelf page - Termín, Související
 * (patient and činnost, each a link), Historie - remembered among the recents, with a broken link said in Czech.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
const history = vi.fn();
const listCalendars = vi.fn();
const getById = vi.fn();

vi.mock('../../api/appointments', () => ({ appointmentsApi: { get, history } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/patients', () => ({ patientsApi: { getById } }));
vi.mock('../../components/booking/AppointmentDetail', () => ({
  AppointmentDetail: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div role="dialog" aria-label="Detail termínu"><button type="button" onClick={onClose}>Zavřít</button></div> : null,
  HistoryRow: ({ line }: { line: { reason: string | null } }) => <li>{line.reason}</li>,
}));

const { default: AppointmentLinkPage } = await import('./AppointmentLinkPage');

const APPOINTMENT = {
  id: 'a1', calendarId: 'c1', patientId: 'p1', activityId: 'act-1', activityName: 'Základní prohlídka',
  startUtc: '2026-10-24T07:00:00Z', endUtc: '2026-10-24T07:30:00Z', status: 1, source: 0, workerUserId: null,
  heldUntilUtc: null, overrideReason: null, note: null, checkedInUtc: null,
  paperwork: { ready: false, missing: ['questionnaire_missing'] }, unregisteredName: null, unregisteredPhone: null,
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockResolvedValue(APPOINTMENT);
  history.mockReset().mockResolvedValue([{ action: 0, actorId: 'u', actorDisplayName: 'Recepce', atUtc: '2026-10-20T08:00:00Z', reason: 'Objednáno telefonem', oldValue: null, newValue: null }]);
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Ordinace 1', color: '#999', isActive: true }]);
  getById.mockReset().mockResolvedValue({ id: 'p1', firstName: 'Jana', lastName: 'Marková', fullName: 'Jana Marková' });
});

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/kalendar/:calendarId/termin/:appointmentId" element={<AppointmentLinkPage />} />
          <Route path="/kalendar/:calendarId/termin" element={<AppointmentLinkPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the page of one appointment', () => {
  it('opens with the detail, and closing it shows the appointment as a page', async () => {
    renderAt('/kalendar/c1/termin/a1');
    expect(screen.getByRole('dialog', { name: 'Detail termínu' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    expect(await screen.findByRole('heading', { level: 1, name: 'Základní prohlídka' })).toBeInTheDocument();
    const termin = screen.getByRole('region', { name: 'Termín' });
    expect(within(termin).getByText('Ordinace 1')).toBeInTheDocument();
    expect(within(termin).getByText('Chybí dotazník')).toBeInTheDocument();
    expect(within(termin).getByRole('link', { name: /V kalendáři/ })).toHaveAttribute('href', '/planovani');

    /* The detail opens again from the header. */
    await userEvent.click(screen.getByRole('button', { name: 'Otevřít detail' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('connects the patient and the činnost, and lists the history', async () => {
    renderAt('/kalendar/c1/termin/a1');
    const related = await screen.findByRole('region', { name: 'Související' });
    expect(await within(related).findByRole('link', { name: 'Pacient: Jana Marková' })).toHaveAttribute('href', '/patients/p1');
    expect(within(related).getByRole('link', { name: 'Činnost: Základní prohlídka' })).toHaveAttribute('href', '/activities');
    const historyShelf = screen.getByRole('region', { name: 'Historie' });
    expect(await within(historyShelf).findByText('Objednáno telefonem')).toBeInTheDocument();
  });

  it('remembers the appointment among the recents by id and label only', async () => {
    renderAt('/kalendar/c1/termin/a1');
    await screen.findByRole('heading', { level: 1, name: 'Základní prohlídka' });
    const stored = Object.keys(localStorage).filter((k) => k.startsWith('sm-shelf'));
    const text = stored.map((k) => localStorage.getItem(k)).join('');
    expect(text).toContain('"kind":"appointment"');
    expect(text).toContain('"calendarId":"c1"');
    expect(text).not.toContain('Marková');
  });

  it('says a failed load, with a retry', async () => {
    get.mockRejectedValue(new Error('500'));
    renderAt('/kalendar/c1/termin/a1');
    await userEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    const termin = screen.getByRole('region', { name: 'Termín' });
    expect(await within(termin).findByRole('alert')).toHaveTextContent('Termín se nepodařilo načíst.');
    expect(within(termin).getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

  it('a broken link says so in Czech and asks nothing', () => {
    renderAt('/kalendar/c1/termin');
    expect(screen.getByText(/Odkaz na termín je neúplný/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
