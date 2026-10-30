import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { Activity, Appointment } from '../../api/bookingContracts';

const { changeActivity, services } = vi.hoisted(() => ({ changeActivity: vi.fn(), services: vi.fn() }));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { changeActivity } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: services } }));

const { ChangeActivityDialog } = await import('./ChangeActivityDialog');

const activity = (id: string, name: string, serviceId: string, price: number | null, over: Partial<Activity> = {}) =>
  ({ id, name, clinicServiceId: serviceId, durationMinutes: 30, priceCzk: price, isActive: true, ...over }) as unknown as Activity;

const activities = [
  activity('a1', 'Prohlídka', 's1', 800),
  activity('a2', 'Spiroergometrie', 's1', 1500),
  activity('a3', 'InBody', 's2', null),
  activity('a4', 'Archivní', 's1', 100, { isActive: false }),
];
const appointment = { id: 'p1', activityId: 'a1', activityName: 'Prohlídka' } as unknown as Appointment;

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  changeActivity.mockReset().mockResolvedValue(undefined);
  services.mockReset().mockResolvedValue([
    { id: 's1', name: 'Diagnostika', sortOrder: 0, isActive: true },
    { id: 's2', name: 'Složení těla', sortOrder: 1, isActive: true },
  ]);
});

const mount = (onChanged = vi.fn()) => {
  renderScreen(<ChangeActivityDialog calendarId="c1" appointment={appointment} activities={activities} onClose={vi.fn()} onChanged={onChanged} />);
  return onChanged;
};

describe('Změnit činnost', () => {
  it('offers the booking’s own služba first, never the current or an archived činnost, and cannot save empty', async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Změnit činnost' })).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: /Nová činnost/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Spiroergometrie · 30 min']);
  });

  it('shows the price of the chosen činnost and sends activityId with keepTime', async () => {
    const user = userEvent.setup();
    const onChanged = mount();
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Nová činnost/ }));
    await user.click(screen.getByRole('option', { name: /Spiroergometrie/ }));
    expect(within(dialog).getByText(/1\s?500\s?Kč/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Změnit činnost' }));
    await waitFor(() => expect(changeActivity).toHaveBeenCalledWith('c1', 'p1', 'a2', true));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('can drop "keep the time" and shows the server’s refusal inside the dialog', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    changeActivity.mockRejectedValue(new BookingApiError('conflict', 409, 'V tomto čase už je obsazeno.'));
    const user = userEvent.setup();
    const onChanged = mount();
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Nová činnost/ }));
    await user.click(screen.getByRole('option', { name: /Spiroergometrie/ }));
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Změnit činnost' }));
    expect(await within(dialog).findByText('V tomto čase už je obsazeno.')).toBeTruthy();
    expect(changeActivity).toHaveBeenCalledWith('c1', 'p1', 'a2', false);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('lists another služba’s činnosti only after the služba is switched', async () => {
    const user = userEvent.setup();
    mount();
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('combobox', { name: 'Služba' }));
    await user.click(screen.getByRole('option', { name: 'Složení těla' }));
    await user.click(within(dialog).getByRole('combobox', { name: /Nová činnost/ }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['InBody · 30 min']);
  });
});
