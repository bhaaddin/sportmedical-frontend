/*
 * The audit screen's translation layer: the query it sends, and the words it
 * puts on a code. A code the map does not know is shown as it is, because a
 * hidden line in an audit trail is the one thing the trail exists to prevent.
 */
import { describe, it, expect } from 'vitest';
import { actionLabel, auditSearchParams, entityLabel, parseValues } from './audit';

describe('the audit search query', () => {
  it('sends only the filters that are set, and widens "to" to the end of its day', () => {
    const params = auditSearchParams({ user: ' jana@ordinace.cz ', action: '', entity: 'Patient', from: '2026-09-01', to: '2026-09-25', search: '' }, 2, 50);

    expect(params.get('user')).toBe('jana@ordinace.cz');
    expect(params.has('action')).toBe(false);
    expect(params.get('entity')).toBe('Patient');
    expect(params.get('from')).toBe('2026-09-01T00:00:00Z');
    expect(params.get('to')).toBe('2026-09-25T23:59:59Z');
    expect(params.has('search')).toBe(false);
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('50');
  });
});

describe('what a code means', () => {
  it('has Czech for the actions the server writes', () => {
    expect(actionLabel('account.session_created')).toBe('Přihlášení');
    expect(actionLabel('appointment.moved')).toBe('Rezervace přesunuta');
    expect(actionLabel('settings.changed')).toBe('Změna nastavení');
    expect(actionLabel('document.invalidated')).toBe('Dokument zneplatněn');
  });

  it('reads a permission decision out of its code', () => {
    expect(actionLabel('account.permission.grant:bookings.cancel')).toBe('Oprávnění uděleno: bookings.cancel');
    expect(actionLabel('account.permission.revoke:patients.view_all')).toBe('Oprávnění odebráno: patients.view_all');
    expect(actionLabel('account.permission.reset:billing.manage')).toBe('Oprávnění vráceno na roli: billing.manage');
  });

  it('never hides a code it does not know', () => {
    expect(actionLabel('something.new')).toBe('something.new');
    expect(entityLabel('Unknown')).toBe('Unknown');
    expect(entityLabel('Appointment')).toBe('Rezervace');
  });
});

describe('the recorded values', () => {
  it('become rows, with null shown as a dash', () => {
    expect(parseValues('{"status":"Scheduled","activityId":null}')).toEqual([
      ['status', 'Scheduled'],
      ['activityId', '—'],
    ]);
    expect(parseValues(null)).toEqual([]);
    expect(parseValues('not json')).toEqual([['hodnota', 'not json']]);
  });
});
