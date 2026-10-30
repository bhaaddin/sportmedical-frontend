/* Přidat sportovce: the athlete is chosen from the register by name (no raw id), shown with the birth year only. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../test/auditHarness';
import { setViewport, VIEWPORTS } from '../test/viewport';

const { getAll, create, search } = vi.hoisted(() => ({ getAll: vi.fn(), create: vi.fn(), search: vi.fn() }));
vi.mock('../api/availability', () => ({ availabilityApi: { getAll, create } }));
vi.mock('../api/patients', async (original) => ({
  ...(await original<typeof import('../api/patients')>()),
  patientsApi: { search },
}));

const { default: AvailabilityPage } = await import('./Availability');
const { birthYearOf } = await import('../components/patients/PatientPicker');

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getAll.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue({ id: 'a1', patientId: 'p1', patientName: 'ZZ test Novák', status: 'Available', reason: '', date: '2026-10-30T10:00:00Z', updatedBy: 'System' });
  search.mockReset().mockResolvedValue([{ id: 'p1', firstName: 'ZZ test', lastName: 'Novák', dateOfBirth: '2001-05-17' }]);
});

describe('Dostupnost - přidat sportovce', () => {
  it('reduces a birth date to its year', () => {
    expect(birthYearOf('2001-05-17T00:00:00')).toBe('2001');
    expect(birthYearOf('')).toBe('');
  });

  it('picks the athlete by name and sends his id, never asking for one', async () => {
    const user = userEvent.setup();
    renderScreen(<AvailabilityPage />);
    await user.click((await screen.findAllByRole('button', { name: 'Přidat sportovce' }))[0]);
    expect(screen.queryByLabelText('ID pacienta')).toBeNull();
    await user.type(await screen.findByRole('combobox', { name: /Pacient/ }), 'Nov');
    const option = await screen.findByText('ZZ test Novák');
    expect(screen.getByText('nar. 2001')).toBeTruthy();
    expect(screen.queryByText(/17/)).toBeNull();
    await user.click(option);
    await user.click(screen.getByRole('button', { name: 'Přidat' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'p1' })));
  });
});
