import { describe, expect, it } from 'vitest';
import { ENTITY_KINDS, ENTITY_LABEL, entityHref, entityListPath, entityTarget, looksLikeIdentifier, mayOpen, readRef, safeLabel } from './entities';

describe('entityTarget: the one place that knows an address', () => {
  it('opens each kind where it lives', () => {
    expect(entityTarget({ kind: 'patient', id: 'p1' })).toEqual({ to: '/patients/p1' });
    expect(entityTarget({ kind: 'club', id: 'c1' })).toEqual({ to: '/clubs/c1' });
    expect(entityTarget({ kind: 'service', id: 's1' })).toEqual({ to: '/nastaveni/sluzby/s1' });
    expect(entityTarget({ kind: 'activity', id: 'a1' })).toEqual({ to: '/activities' });
  });

  it('hands ids, never names, to the screens that read router state', () => {
    expect(entityTarget({ kind: 'invoice', id: 'i1' })).toEqual({ to: '/billing', state: { invoiceId: 'i1' } });
    expect(entityTarget({ kind: 'order', id: 'o1' })).toEqual({ to: '/clubs/objednavky', state: { openOrderId: 'o1' } });
  });

  it('needs the calendar for an appointment and the patient for a document, and lands on the list without them', () => {
    expect(entityTarget({ kind: 'appointment', id: 'a1', calendarId: 'k1' })).toEqual({ to: '/kalendar/k1/termin/a1' });
    expect(entityTarget({ kind: 'appointment', id: 'a1' })).toEqual({ to: '/planovani', state: { appointmentId: 'a1' } });
    expect(entityTarget({ kind: 'document', id: 'd1', patientId: 'p1' })).toEqual({ to: '/patients/p1/dokumenty' });
    expect(entityTarget({ kind: 'document', id: 'd1' })).toEqual({ to: '/patients' });
  });

  it('opens a calendar on Kalendáře (the id in router state) and a worker on Uživatelé a práva (the id in ?user=)', () => {
    expect(entityTarget({ kind: 'calendar', id: 'k1' })).toEqual({ to: '/calendars', state: { openCalendarId: 'k1' } });
    expect(entityTarget({ kind: 'worker', id: 'u1' })).toEqual({ to: '/staff-management?user=u1' });
    expect(entityTarget({ kind: 'worker', id: 'a b&c' }).to).toBe('/staff-management?user=a%20b%26c');
  });

  it('encodes an id so it cannot add a path segment', () => {
    expect(entityTarget({ kind: 'patient', id: 'a/b?c' }).to).toBe('/patients/a%2Fb%3Fc');
  });

  it('knows an address for every kind', () => {
    for (const kind of ENTITY_KINDS) expect(entityTarget({ kind, id: 'x' }).to.startsWith('/')).toBe(true);
  });
});

describe('calendar and worker kinds', () => {
  it('are listed kinds with their own list, label and permission', () => {
    expect(ENTITY_KINDS).toEqual(expect.arrayContaining(['calendar', 'worker']));
    expect(entityListPath('calendar')).toBe('/calendars');
    expect(entityListPath('worker')).toBe('/staff-management');
    expect(ENTITY_LABEL.calendar).toBe('Kalendář');
    expect(ENTITY_LABEL.worker).toBe('Zaměstnanec');
  });

  it('are opened only with the permission their screen asks for', () => {
    expect(mayOpen('calendar', ['settings.clinic.manage'])).toBe(true);
    expect(mayOpen('calendar', ['patients.view'])).toBe(false);
    expect(mayOpen('worker', ['users.manage'])).toBe(true);
    expect(mayOpen('worker', ['settings.clinic.manage'])).toBe(false);
  });

  it('hold a worker label to the person rules (no long digit runs) and a calendar to the plain ones', () => {
    expect(safeLabel('Jana Nováková', 'worker')).toBe('Jana Nováková');
    expect(safeLabel('123456789012', 'worker')).toBe('');
    expect(safeLabel('Ordinace 2', 'calendar')).toBe('Ordinace 2');
    expect(safeLabel('850101/1234', 'calendar')).toBe('');
  });
});

describe('mayOpen: permissions hide', () => {
  it('asks Fakturace for billing.manage and the register for patients.view', () => {
    expect(mayOpen('invoice', ['patients.view'])).toBe(false);
    expect(mayOpen('invoice', ['billing.manage'])).toBe(true);
    expect(mayOpen('patient', [])).toBe(false);
    expect(mayOpen('patient', ['patients.view'])).toBe(true);
    expect(mayOpen('service', ['patients.view'])).toBe(false);
  });

  it('lets anybody open what has no permission behind it', () => {
    expect(mayOpen('club', [])).toBe(true);
    expect(mayOpen('appointment', [])).toBe(true);
  });
});

describe('labels never carry an identifier', () => {
  it('refuses a birth number in either shape', () => {
    expect(looksLikeIdentifier('850101/1234')).toBe(true);
    expect(looksLikeIdentifier('Jana 850101 / 123')).toBe(true);
    expect(safeLabel('850101/1234')).toBe('');
  });

  it('refuses a long run of digits for a person, but not for an invoice number', () => {
    expect(safeLabel('8501011234', 'patient')).toBe('');
    expect(safeLabel('123456789', 'patient')).toBe('');
    expect(safeLabel('20260000014', 'invoice')).toBe('20260000014');
    expect(safeLabel('FA-2026-0014', 'invoice')).toBe('FA-2026-0014');
  });

  it('keeps a normal name, trims, flattens whitespace and cuts at 80 characters', () => {
    expect(safeLabel('  Jana   Marková ', 'patient')).toBe('Jana Marková');
    expect(safeLabel('x'.repeat(200))).toHaveLength(80);
    expect(safeLabel(42)).toBe('');
    expect(safeLabel(null)).toBe('');
  });
});

describe('readRef: nothing is trusted', () => {
  it('reads a good ref and keeps only what a ref may hold', () => {
    const ref = readRef({ kind: 'patient', id: 'p1', label: 'Jana Marková', birthNumber: '850101/1234', email: 'j@x.cz', calendarId: 'k1' });
    expect(ref).toEqual({ kind: 'patient', id: 'p1', label: 'Jana Marková', calendarId: 'k1' });
    expect(JSON.stringify(ref)).not.toContain('850101');
    expect(JSON.stringify(ref)).not.toContain('j@x.cz');
  });

  it.each([
    [null], [undefined], ['x'], [42], [[]],
    [{ kind: 'nope', id: 'p1', label: 'A' }],
    [{ kind: 'patient', id: '', label: 'A' }],
    [{ kind: 'patient', id: 'p1', label: '' }],
    [{ kind: 'patient', id: 'p1' }],
    [{ kind: 'patient', id: 'p1', label: '850101/1234' }],
    [{ kind: 'patient', id: 5, label: 'A' }],
  ])('throws away junk %#', (junk) => {
    expect(readRef(junk)).toBeNull();
  });
});

describe('entityHref (addressable entities)', () => {
  it('puts an invoice id in the address and leaves the other kinds on their own path', () => {
    expect(entityHref({ kind: 'invoice', id: 'i 1' })).toBe('/billing?invoice=i%201');
    expect(entityHref({ kind: 'patient', id: 'p1' })).toBe('/patients/p1');
    expect(entityHref({ kind: 'club', id: 'c1' })).toBe('/clubs/c1');
  });
});
