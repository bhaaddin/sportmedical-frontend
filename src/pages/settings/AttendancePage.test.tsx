/*
 * Docházka: the minutes are the server's, the bounds are the server's, and a
 * save sends exactly the number typed - never the deadline, which this screen
 * only shows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttendancePage from './AttendancePage';
import { readAttendanceSettings, saveAttendanceSettings } from '../../api/attendanceSettings';

vi.mock('../../api/attendanceSettings', () => ({
  ATTENDANCE_QUERY_KEY: ['settings', 'attendance'],
  readAttendanceSettings: vi.fn(),
  saveAttendanceSettings: vi.fn(),
}));

const response = (noShowAfterMinutes: number) => ({
  settings: { noShowAfterMinutes, patientChangeDeadlineHours: 24 },
  minimumNoShowAfterMinutes: 5,
  maximumNoShowAfterMinutes: 240,
  defaults: { noShowAfterMinutes: 30, patientChangeDeadlineHours: 24 },
});

beforeEach(() => {
  vi.mocked(readAttendanceSettings).mockResolvedValue(response(30));
});

afterEach(() => vi.clearAllMocks());

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AttendancePage />
    </QueryClientProvider>,
  );
}

describe('Docházka', () => {
  it('shows the clinic number and the read-only deadline, each with one sentence', async () => {
    renderPage();

    const minutes = await screen.findByLabelText(/Označit „asi nepřišel“ po/);
    expect(minutes).toHaveValue(30);
    expect(screen.getByText(/Povolený rozsah 5–240 minut; výchozí 30\./)).toBeInTheDocument();

    const deadline = screen.getByLabelText(/Pacient smí sám měnit termín/);
    expect(deadline).toHaveValue('24');
    expect(deadline).toHaveAttribute('readonly');
  });

  it('saves the typed number and nothing else', async () => {
    vi.mocked(saveAttendanceSettings).mockResolvedValue(response(45));
    renderPage();

    const minutes = await screen.findByLabelText(/Označit „asi nepřišel“ po/);
    fireEvent.change(minutes, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(saveAttendanceSettings).toHaveBeenCalledWith(45));
    expect(await screen.findByText(/Uloženo\./)).toBeInTheDocument();
  });

  it('will not send a number outside the bounds the server gave', async () => {
    renderPage();

    const minutes = await screen.findByLabelText(/Označit „asi nepřišel“ po/);
    fireEvent.change(minutes, { target: { value: '3' } });

    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(saveAttendanceSettings).not.toHaveBeenCalled();
  });

  it('puts the server refusal under the field', async () => {
    vi.mocked(saveAttendanceSettings).mockRejectedValue({
      response: { data: { message: 'Nastavení nelze uložit: x', errors: { noShowAfterMinutes: ['Počet minut musí být od 5 do 240.'] } } },
    });
    renderPage();

    const minutes = await screen.findByLabelText(/Označit „asi nepřišel“ po/);
    fireEvent.change(minutes, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Počet minut musí být od 5 do 240.')).toBeInTheDocument();
  });
});
