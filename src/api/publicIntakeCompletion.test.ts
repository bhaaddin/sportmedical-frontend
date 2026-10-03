/*
 * The completion link's answer is read tolerantly (the server's names moved
 * while Etapa 2 was built): the page only ever sees CompletionView.
 */
import { describe, it, expect } from 'vitest';
import { normaliseCompletion } from './publicIntake';

describe('normaliseCompletion', () => {
  it('reads the C2 shape: nested appointment, prefilled facts, deadline and the admin switches', () => {
    const view = normaliseCompletion({
      referenceNumber: 'R-7',
      firstName: 'Jan',
      lastName: 'Novák',
      phone: '+420773539001',
      email: 'jan@example.cz',
      registrationDeadlineUtc: '2026-10-26T09:00:00Z',
      expiresAtUtc: '2026-10-30T09:00:00Z',
      requireDateOfBirthOnCompletion: true,
      questionnaireRequirement: 'Required',
      appointment: {
        activityName: 'Spiroergometrie',
        serviceName: 'Diagnostika',
        startUtc: '2026-10-26T09:00:00Z',
        endUtc: '2026-10-26T10:00:00Z',
        requiredDocuments: [{ templateId: 't1', name: 'Souhlas' }, { templateId: 't2', name: '' }],
      },
    });

    expect(view).toMatchObject({
      referenceNumber: 'R-7',
      givenName: 'Jan',
      familyName: 'Novák',
      phoneE164: '+420773539001',
      deadlineUtc: '2026-10-26T09:00:00Z',
      requireDateOfBirth: true,
      questionnaire: 'Required',
    });
    expect(view.appointment?.requiredDocuments).toEqual([{ templateId: 't1', name: 'Souhlas' }]);
    expect(view.appointment?.serviceName).toBe('Diagnostika');
  });

  it('still reads the older flat shape the API sends today', () => {
    const view = normaliseCompletion({
      referenceNumber: 'R-1',
      givenName: 'Jana',
      familyName: 'Nováková',
      email: 'j@example.cz',
      phone: '+420601234567',
      expiresAtUtc: '2026-10-30T09:00:00Z',
      activityName: 'Základní prohlídka',
      appointmentStartUtc: '2026-10-26T09:00:00Z',
    });

    expect(view.givenName).toBe('Jana');
    expect(view.deadlineUtc).toBe('2026-10-30T09:00:00Z');
    expect(view.appointment).toMatchObject({ activityName: 'Základní prohlídka', startUtc: '2026-10-26T09:00:00Z', requiredDocuments: [] });
  });

  it('defaults: the date of birth is asked as before when no flag is sent; the questionnaire is not asked', () => {
    const view = normaliseCompletion({ referenceNumber: 'R-2', givenName: 'A', familyName: 'B', email: '' });

    expect(view.requireDateOfBirth).toBe(true);
    expect(view.questionnaire).toBe('NotAsked');
    expect(view.appointment).toBeNull();
    expect(view.deadlineUtc).toBeNull();
  });

  it('honours the switch when it is off', () => {
    expect(normaliseCompletion({ requireDateOfBirthOnCompletion: false }).requireDateOfBirth).toBe(false);
    expect(normaliseCompletion({ questionnaireRequired: true }).questionnaire).toBe('Required');
  });
});
