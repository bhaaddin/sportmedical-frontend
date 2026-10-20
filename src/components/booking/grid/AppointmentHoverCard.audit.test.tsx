/*
 * Settings audit (20. 10. 2026) - the CONSUMER of "Bublina nad objednávkou" in
 * Kalendář a mřížka. A setting is only as good as the place that reads it, so
 * each fact the screen offers is held against what the booking card draws, and
 * the three the server lists but a calendar row cannot answer are pinned as
 * not drawn (BUG-open: the server catalogue lists note, insurer, history).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayAppointment } from '../../../api/bookingContracts';
import { HOVER_FIELDS_THE_CARD_DRAWS } from '../../../api/displaySettings';

const listActivities = vi.fn();
const getById = vi.fn();
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { getById } }));

const { AppointmentHoverCard } = await import('./AppointmentHoverCard');

const row = (over: Partial<DayAppointment> = {}): DayAppointment => ({
  id: 'a1', calendarId: 'c1', patientId: 'p1', patientName: null, activityId: 'act-1', activityName: 'Základní prohlídka',
  startUtc: '2026-10-12T08:00:00Z', endUtc: '2026-10-12T09:00:00Z', status: 0, isRunningLate: false, checkedInUtc: null,
  paperwork: { ready: false, missing: ['questionnaire_missing'] }, listPriceCzk: 1600, ...over,
});

const card = (fields: string[], appointment = row()) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AppointmentHoverCard appointment={appointment} calendarName="Diagnostika" fields={fields} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  listActivities.mockReset().mockResolvedValue({ activities: [] });
  getById.mockReset().mockResolvedValue({
    id: 'p1', firstName: 'Petr', lastName: 'Novák', fullName: 'Petr Novák', phone: '+420 777 111 222', email: 'petr@example.cz',
    dateOfBirth: '2010-05-04', status: 'Active',
  });
});

describe('every hover fact the settings screen offers is drawn by the booking card', () => {
  it.each([
    ['patientName', 'Pacient', 'Petr Novák'],
    ['phone', 'Telefon', '+420 777 111 222'],
    ['email', 'E-mail', 'petr@example.cz'],
    ['birthDate', 'Narozen(a)', '4. 5. 2010'],
    ['activity', 'Činnost', 'Základní prohlídka'],
    ['service', 'Služba', 'Diagnostika'],
    ['status', 'Stav objednávky', 'Objednán'],
    ['paperwork', 'Podklady', 'chybí dotazník'],
  ])('%s -> "%s"', async (key, label, value) => {
    expect(HOVER_FIELDS_THE_CARD_DRAWS).toContain(key);
    card([key]);
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText(value)).toBeInTheDocument();
  });

  it('draws the facts in the order the clinic chose', async () => {
    card(['phone', 'activity', 'patientName']);
    const labels = (await screen.findAllByText(/^(Telefon|Činnost|Pacient)$/)).map((el) => el.textContent);
    expect(labels).toEqual(['Telefon', 'Činnost', 'Pacient']);
  });

  it('draws nothing it was not asked for, except the price which is on every card', async () => {
    card(['activity']);
    await screen.findByText('Činnost');
    expect(screen.queryByText('Telefon')).not.toBeInTheDocument();
    expect(screen.queryByText('Pacient')).not.toBeInTheDocument();
    expect(screen.getByText('Cena')).toBeInTheDocument();
  });
});

describe('what the server catalogue lists but the calendar row cannot answer (BUG-open)', () => {
  it.each(['note', 'insurer', 'history'])('"%s" draws no line, so the screen does not offer it', async (key) => {
    expect(HOVER_FIELDS_THE_CARD_DRAWS).not.toContain(key);
    card([key, 'activity']);
    await screen.findByText('Činnost');
    expect(screen.queryByText(/Poznámka|pojišťovna|Poslední změna/i)).not.toBeInTheDocument();
  });
});

describe('a walk-in without a register entry', () => {
  it('shows the name and phone the row carries, and never asks the register', async () => {
    card(['patientName', 'phone'], row({ patientId: '', patientName: 'Host z ulice', unregisteredPhone: '+420 600 000 000' }));
    expect(await screen.findByText('Host z ulice')).toBeInTheDocument();
    expect(screen.getByText('+420 600 000 000')).toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
  });
});
