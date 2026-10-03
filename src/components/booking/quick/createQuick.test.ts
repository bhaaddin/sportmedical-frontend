import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * `appointmentsApi.createQuick` - contract C2. The slot is chosen, so one POST
 * books it, creates the provisional patient and issues the completion link.
 */

const post = vi.fn();
vi.mock('../../../api/client', () => ({ default: { post } }));

const { appointmentsApi } = await import('../../../api/appointments');

const appointment = {
  id: 'a1',
  calendarId: 'c1',
  patientId: 'p1',
  activityId: 'act1',
  activityName: 'Komplexní prohlídka',
  startUtc: '2026-10-26T08:30:00Z',
  endUtc: '2026-10-26T09:30:00Z',
  status: 0,
  registrationDeadlineUtc: '2026-10-27T08:30:00Z',
  quickRegistrationPending: true,
};

const input = {
  activityId: 'act1',
  startUtc: '2026-10-26T08:30:00Z',
  firstName: 'Filip',
  lastName: 'Fehér',
  phone: '+420773539001',
  email: 'filip@example.cz',
};

beforeEach(() => {
  post.mockReset();
});

describe('appointmentsApi.createQuick', () => {
  it('posts the four facts and the činnost to the calendar\'s quick endpoint, with no date of birth', async () => {
    post.mockResolvedValue({
      data: {
        appointment,
        patientId: 'p1',
        completionLink: { url: 'https://x.test/dokonceni/tok', token: 'tok', expiresAtUtc: '2026-10-27T08:30:00Z' },
        registrationDeadlineUtc: '2026-10-27T08:30:00Z',
      },
    });

    const result = await appointmentsApi.createQuick('c1', input);

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/api/calendars/c1/appointments/quick');
    expect(body).toEqual({ ...input, startUtc: '2026-10-26T08:30:00.000Z' });
    expect(Object.keys(body)).not.toContain('dateOfBirth');

    expect(result.patientId).toBe('p1');
    expect(result.completionLink).toEqual({
      url: 'https://x.test/dokonceni/tok',
      token: 'tok',
      expiresAtUtc: '2026-10-27T08:30:00Z',
    });
    expect(result.registrationDeadlineUtc).toBe('2026-10-27T08:30:00Z');
    expect(result.appointment.registrationDeadlineUtc).toBe('2026-10-27T08:30:00Z');
    expect(result.appointment.quickRegistrationPending).toBe(true);
  });

  it('reads an ApiResult envelope too, and a missing public address as null', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        data: {
          appointment,
          patientId: 'p1',
          completionLink: { token: 'tok' },
          registrationDeadlineUtc: null,
        },
      },
    });
    const result = await appointmentsApi.createQuick('c1', input);
    expect(result.completionLink).toEqual({ url: null, token: 'tok', expiresAtUtc: null });
    expect(result.registrationDeadlineUtc).toBeNull();
  });

  it('carries the override reason when there is one', async () => {
    post.mockResolvedValue({
      data: { appointment, patientId: 'p1', completionLink: { token: 'tok' }, registrationDeadlineUtc: null },
    });
    await appointmentsApi.createQuick('c1', { ...input, overrideReason: 'Pacient přijede z Brna' });
    expect(post.mock.calls[0][1]).toMatchObject({ overrideReason: 'Pacient přijede z Brna' });
  });

  it('refuses an answer that is not the contract, instead of drawing half of it', async () => {
    post.mockResolvedValue({ data: { appointment, patientId: 'p1' } });
    await expect(appointmentsApi.createQuick('c1', input)).rejects.toThrow();
  });

  it('lets the server\'s refusal through untouched, so the form can point at the box it names', async () => {
    const refusal = Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400, data: { errors: { field: ['phone'] } } } });
    post.mockRejectedValue(refusal);
    await expect(appointmentsApi.createQuick('c1', input)).rejects.toBe(refusal);
  });

  it('refuses to send without a calendar', async () => {
    await expect(appointmentsApi.createQuick('', input)).rejects.toThrow(/calendarId/);
    expect(post).not.toHaveBeenCalled();
  });
});
