/*
 * The pure helpers behind the second half of Nastavení, one table per rule.
 */
import { describe, it, expect } from 'vitest';
import { placeholderToken, singleBraceTokens, singleBraceWarning } from './emailTemplateText';
import { wholeHours } from './messages/messagesModel';
import { averageRating } from '../FeedbackReviewPage';
import { readState, stateAfter, stateBefore, toneOfAction, topActions } from '../auditLogModel';
import { STATUS_TEXT, gigabytes, readHealth, waitText } from '../systemHealthModel';
import { SETTINGS_PROBLEM_TEXT, settingsAreValid, settingsProblems } from './requirementSettings';
import { ibanFromBankAccount, isValidBankAccount, isValidIban, validateCompany } from './CompanyInvoiceSettingsPage';
import { validateMediaStorage } from './MediaStorageSettingsPage';
import { validateQuickRegistration } from './QuickRegistrationSettingsPage';
import { moveKey } from './patientFieldOrder';
import { describesACancelledRule, switchingOffText, templateChanged, templateIsValid } from './documentTemplates';
import { blockingWillHappen, settingsSummary } from './requirementSettings';
import { countSlots, draftChanges, draftProblem, effectiveText, isDirty, isFilled, matchesQuery, ALT_LIMIT, TEXT_LIMIT } from './siteContent/model';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import type { SlotDef } from '../../site/slotTypes';

describe('e-mail placeholders', () => {
  it('always inserts the double-brace form, whatever the text already contains', () => {
    expect(placeholderToken('pacient.jmeno')).toBe('{{pacient.jmeno}}');
  });

  it.each([
    ['Dobrý den {pacient.jmeno}', ['{pacient.jmeno}']],
    ['{ pacient.jmeno }', ['{ pacient.jmeno }']],
    ['{{pacient.jmeno}}', []],
    ['{{ pacient.jmeno }}', []],
    ['{{pacient.jmeno}} a {klinika.nazev}', ['{klinika.nazev}']],
    ['a { color: red } b', []],
    ['<style>p{color:red}</style>', []],
    ['{x}', []],
    ['{pacient.jmeno} {pacient.jmeno}', ['{pacient.jmeno}']],
    ['{{{pacient.jmeno}}}', []],
  ])('single-brace tokens in %j', (text, expected) => {
    expect(singleBraceTokens(text)).toEqual(expected);
  });

  it('warns about a single-brace token in the subject or the body, and says what the patient would get', () => {
    const warning = singleBraceWarning('Potvrzení {klinika.nazev}', '<p>Ahoj</p>');
    expect(warning).toContain('{{pacient.jmeno}}');
    expect(warning).toContain('{klinika.nazev}');
    expect(singleBraceWarning('ok', '<p>{pacient.jmeno}</p>')).toContain('{pacient.jmeno}');
  });

  it('says nothing when every placeholder is in double braces', () => {
    expect(singleBraceWarning('{{klinika.nazev}}', '<p>{{pacient.jmeno}}</p>')).toBeNull();
  });

  it('uses the plural for several tokens', () => {
    expect(singleBraceWarning('{a.b} {c.d}', '')).toContain('Tyhle');
    expect(singleBraceWarning('{a.b}', '')).toContain('Tohle');
  });
});

describe('reminder lead time input', () => {
  it.each([
    ['24', 24], ['1', 1], ['744', 744], [' 36 ', 36], ['007', 7],
    ['12.5', null], ['1e1', null], ['-3', null], ['', null], ['abc', null], ['12h', null], ['0x10', null], ['1,5', null], ['99999999999999999999', null],
  ])('%j reads as %j', (text, expected) => {
    expect(wholeHours(text)).toBe(expected);
  });
});

describe('the average of the stars', () => {
  it.each([
    [[], null],
    [[{ rating: 5 }], 5],
    [[{ rating: 5 }, { rating: 3 }], 4],
    [[{ rating: 5 }, { rating: null }], 5],
    [[{ rating: null }], null],
    [[{ rating: 4 }, { rating: 5 }, { rating: 4 }, { rating: null }], 13 / 3],
  ])('%j gives %j', (entries, expected) => {
    expect(averageRating(entries)).toBe(expected);
  });
});

describe('audit log entries', () => {
  it.each([
    ['plain text stays text', 'abc', 'abc'],
    ['a JSON object text becomes the object', '{"a":1}', { a: 1 }],
    ['a JSON array text becomes the array', '[1,2]', [1, 2]],
    ['broken JSON stays as text', '{oops', '{oops'],
    ['an empty text is nothing', '  ', null],
    ['an object stays', { a: 1 }, { a: 1 }],
    ['a number stays', 5, 5],
  ])('readState: %s', (_name, value, expected) => {
    expect(readState(value)).toEqual(expected);
  });

  it('reads oldValue / newValue, which is what the API sends', () => {
    expect(stateBefore({ action: 'settings.changed', oldValue: '{"v":"1"}', newValue: '{"v":"2"}' })).toEqual({ v: '1' });
    expect(stateAfter({ action: 'settings.changed', oldValue: '{"v":"1"}', newValue: '{"v":"2"}' })).toEqual({ v: '2' });
  });

  it('still reads the older beforeState / afterState', () => {
    expect(stateBefore({ action: 'x', beforeState: { a: 1 } })).toEqual({ a: 1 });
    expect(stateAfter({ action: 'x', afterState: { a: 2 } })).toEqual({ a: 2 });
  });

  it.each([
    [{ action: 'x' }], [{ action: 'x', oldValue: null }], [{ action: 'x', oldValue: '' }], [{ action: 'x', oldValue: {} }],
  ])('%j has nothing to expand', (entry) => {
    expect(stateBefore(entry)).toBeNull();
    expect(stateAfter(entry)).toBeNull();
  });

  it.each([
    ['Create', 'green'], ['Delete', 'red'], ['Sign', 'primary'], ['Login', 'grey'],
    ['settings.changed', 'blue'], ['settings.calendar_display_changed', 'blue'], ['account.session_created', 'grey'],
    ['account.authentication_failed', 'red'], ['patient.created', 'green'], ['document.deleted', 'red'],
    ['email_template.test_sent', 'grey'], ['something.unknown', 'grey'],
  ])('%s is %s', (action, tone) => {
    expect(toneOfAction(action)).toBe(tone);
  });

  it('counts the most frequent actions first, at most six', () => {
    const entries = [
      ...Array(5).fill({ action: 'settings.changed' }), ...Array(3).fill({ action: 'account.session_created' }),
      { action: 'a' }, { action: 'b' }, { action: 'c' }, { action: 'd' }, { action: 'e' },
    ];
    const top = topActions(entries);
    expect(top[0]).toEqual({ action: 'settings.changed', count: 5 });
    expect(top[1]).toEqual({ action: 'account.session_created', count: 3 });
    expect(top).toHaveLength(6);
    expect(topActions([])).toEqual([]);
  });
});

describe('the system health answer', () => {
  const real = {
    status: 'warning',
    database: { reachable: true, latencyMs: 3, appliedMigrations: 76, pendingMigrations: 0, error: null },
    outbox: { pending: 164, failed: 2, oldestPendingCreatedAtUtc: 'x', oldestPendingAgeMinutes: 23217 },
    smtp: { configured: false },
    storage: { root: 'C:\\x', writable: true, freeBytes: 27483680768, totalBytes: 370952630272, problem: null },
    application: { version: '1.0.0+abc', startedAtUtc: 'x', environment: 'Development' },
    activeSessions: 40,
    timestamp: '2026-10-20T08:59:26Z',
  };

  it('reads the nested shape the server sends: latency is database.latencyMs', () => {
    const view = readHealth(real);
    expect(view.dbLatencyMs).toBe(3);
    expect(view.activeSessions).toBe(40);
    expect(view.status).toBe('warning');
    expect(view.outboxPending).toBe(164);
    expect(view.outboxFailed).toBe(2);
    expect(view.smtpConfigured).toBe(false);
    expect(view.storageFreeBytes).toBe(27483680768);
    expect(view.version).toBe('1.0.0+abc');
  });

  it('still reads the old flat latency', () => {
    expect(readHealth({ dbLatencyMs: 7, activeSessions: 1, timestamp: 'x' }).dbLatencyMs).toBe(7);
  });

  it.each([null, undefined, 'x', 5, [], {}])('reads %j as an answer with nothing known, never as undefined or NaN', (raw) => {
    const view = readHealth(raw);
    expect(view.status).toBe('unknown');
    for (const value of Object.values(view)) expect(value === undefined || Number.isNaN(value)).toBe(false);
    expect(view.dbLatencyMs).toBeNull();
  });

  it('does not trust a status it does not know', () => {
    expect(readHealth({ status: 'great' }).status).toBe('unknown');
  });

  it.each([[null, '—'], [0, '0,0 GB'], [27483680768, '25,6 GB'], [1073741824, '1,0 GB']])('%j bytes is %s', (bytes, text) => {
    expect(gigabytes(bytes)).toBe(text);
  });

  it.each([[null, '—'], [0, '0 min'], [59, '59 min'], [60, '1 h'], [300, '5 h'], [1440, '1 dní'], [1500, '1 dní 1 h'], [23217, '16 dní 2 h']])('%j minutes waiting is %s', (minutes, text) => {
    expect(waitText(minutes)).toBe(text);
  });

  it('has a Czech word for every status', () => {
    for (const word of Object.values(STATUS_TEXT)) expect(word.length).toBeGreaterThan(2);
  });
});

describe('document rule settings', () => {
  const ok = { validityMonths: 12, warnDaysBefore: 30, firstVisitOnly: false, blocksBooking: false };

  it.each([
    [{ validityMonths: 1.5 }, ['validity-not-whole']],
    [{ validityMonths: Number.NaN }, ['validity-not-whole']],
    [{ warnDaysBefore: 10.2 }, ['warn-not-whole']],
    [{ warnDaysBefore: Number.NaN }, ['warn-not-whole']],
    [{ validityMonths: Number.NaN, warnDaysBefore: Number.NaN }, ['validity-not-whole', 'warn-not-whole']],
    [{ validityMonths: -1 }, ['validity-negative']],
    [{ validityMonths: 0, warnDaysBefore: 0 }, []],
    [{ validityMonths: 240, warnDaysBefore: 365 }, []],
    [{ validityMonths: 241 }, ['validity-too-large']],
    [{ warnDaysBefore: 366 }, ['warn-too-large']],
    [{ validityMonths: 1, warnDaysBefore: 31 }, ['warn-outlives-validity']],
    [{ validityMonths: 1, warnDaysBefore: 30 }, []],
  ])('%j gives %j', (patch, problems) => {
    expect(settingsProblems({ ...ok, ...patch })).toEqual(problems);
  });

  it('says every problem in Czech', () => {
    for (const text of Object.values(SETTINGS_PROBLEM_TEXT)) expect(text.length).toBeGreaterThan(10);
  });

  it('a fraction is not valid even though it is not negative or large', () => {
    expect(settingsAreValid({ ...ok, validityMonths: 0.5 })).toBe(false);
  });

  it.each([
    [{ validityMonths: 0, warnDaysBefore: 0 }, 'Nevyprší · neupozorňuje předem · při každé návštěvě'],
    [{ validityMonths: 1, warnDaysBefore: 1, firstVisitOnly: true }, 'Platí 1 měsíc od vystavení · upozorní 1 den předem · jen při první návštěvě'],
    [{ validityMonths: 3, warnDaysBefore: 5, blocksBooking: true }, 'Platí 3 měsíce od vystavení · upozorní 5 dní předem · při každé návštěvě · bez něj nejde objednat'],
  ])('summary of %j', (patch, text) => {
    expect(settingsSummary({ ...ok, ...patch })).toBe(text);
  });

  it('only a výpis is looked at when booking, so blocking on anything else is said to be ignored', () => {
    expect(blockingWillHappen('Vypis')).toBe(true);
    for (const type of ['InformovanySouhlas', 'Cenik', 'Podminky', undefined]) expect(blockingWillHappen(type)).toBe(false);
  });
});

describe('document kinds', () => {
  const template = { id: 't', name: 'Výpis', description: 'popis', isActive: true };

  it.each([
    [{ name: 'Výpis', description: 'popis', isActive: true }, false],
    [{ name: 'Výpis 2', description: 'popis', isActive: true }, true],
    [{ name: 'Výpis', description: '', isActive: true }, true],
    [{ name: 'Výpis', description: 'popis', isActive: false }, true],
  ])('%j changed = %s', (draft, changed) => {
    expect(templateChanged(template, draft)).toBe(changed);
  });

  it.each([['', false], ['   ', false], ['A', true]])('name %j valid = %s', (name, valid) => {
    expect(templateIsValid({ name, description: '', isActive: true })).toBe(valid);
  });

  it.each([
    ['Doloží ho (vyžaduje se při první návštěvě)', true],
    ['VYŽADUJE SE PŘI PRVNÍ NÁVŠTĚVĚ', true],
    ['Doloží ho při každé návštěvě', false],
    ['', false],
  ])('stale-rule detection on %j = %s', (text, stale) => {
    expect(describesACancelledRule(text)).toBe(stale);
  });

  it.each([[0, 0], [1, 1], [3, 3]])('switching off with %i rule(s) says how many point at it', (rules) => {
    const text = switchingOffText(rules);
    expect(text).toContain('zmizí ze všech nabídek');
    if (rules === 0) expect(text).not.toContain('pravidl');
    if (rules === 1) expect(text).toContain('Jedno pravidlo');
    if (rules === 3) expect(text).toContain('3 pravidla');
  });
});

describe('company data validation', () => {
  const good = {
    legalName: 'SportMedical s.r.o.', ico: '23351632', dic: 'CZ23351632', address: 'Krátká 283', city: 'Tursko', postalCode: '252 65',
    bankAccount: '19-2000145399/0800', iban: 'CZ65 0800 0000 1920 0014 5399', dataBox: 'abc1234', phone: '+420 606 785 271',
    email: 'recepce@example.cz', invoiceDueDays: '14',
  };

  it('accepts the clinic\'s own data', () => {
    expect(validateCompany(good)).toEqual({});
  });

  it.each([
    ['legalName', ''], ['legalName', '   '], ['ico', '1234567'], ['ico', '123456789'], ['ico', 'abcdefgh'], ['address', ''], ['city', ' '],
    ['postalCode', '12'], ['postalCode', '12345 6'], ['postalCode', 'abcde'],
    ['dic', '12345678'], ['dic', 'C'], ['bankAccount', 'abc'], ['bankAccount', '123/12'], ['iban', 'CZ0000000000000000000000'], ['iban', 'xx'],
    ['dataBox', 'xx'], ['dataBox', 'abc12345'], ['phone', '12345'], ['phone', 'abc'], ['email', 'nope'], ['email', 'a@b'],
    ['invoiceDueDays', ''], ['invoiceDueDays', '0'], ['invoiceDueDays', '366'], ['invoiceDueDays', '1.5'], ['invoiceDueDays', '-3'], ['invoiceDueDays', 'x'],
  ])('refuses %s = %j', (field, value) => {
    expect(Object.keys(validateCompany({ ...good, [field]: value }))).toEqual([field]);
  });

  it.each([['dic'], ['bankAccount'], ['iban'], ['dataBox'], ['phone'], ['email']])('%s may be left empty', (field) => {
    expect(validateCompany({ ...good, [field]: '' })).toEqual({});
  });

  it.each([['1'], ['365'], ['14']])('accepts %s days', (days) => {
    expect(validateCompany({ ...good, invoiceDueDays: days })).toEqual({});
  });

  it.each([
    ['CZ6508000000192000145399', true], ['CZ65 0800 0000 1920 0014 5399', true], ['cz6508000000192000145399', true],
    ['CZ6608000000192000145399', false], ['', false], ['CZ65', false],
  ])('IBAN %j valid = %s', (iban, valid) => {
    expect(isValidIban(iban)).toBe(valid);
  });

  it.each([['19-2000145399/0800', true], ['2000145399/0800', true], ['123/0800', true], ['123456789/080', false], ['abc', false], ['1234567-123/0800', false]])(
    'bank account %j valid = %s',
    (account, valid) => {
      expect(isValidBankAccount(account)).toBe(valid);
    },
  );

  it('derives the IBAN the server accepts for the clinic\'s example account', () => {
    expect(ibanFromBankAccount('19-2000145399/0800')).toBe('CZ6508000000192000145399');
    expect(ibanFromBankAccount('nonsense')).toBeNull();
  });
});

describe('media storage validation', () => {
  const draft = { enabled: true, cloudName: 'c', apiKey: 'k', uploadPreset: '' };

  it.each([
    [{ ...draft, enabled: false, cloudName: '', apiKey: '' }, false, '', {}],
    [draft, true, '', {}],
    [draft, false, 'secret', {}],
    [draft, false, '', { apiSecret: expect.any(String) }],
    [draft, false, '   ', { apiSecret: expect.any(String) }],
    [{ ...draft, cloudName: ' ' }, true, '', { cloudName: expect.any(String) }],
    [{ ...draft, apiKey: '' }, true, '', { apiKey: expect.any(String) }],
    [{ ...draft, cloudName: '', apiKey: '' }, false, '', { cloudName: expect.any(String), apiKey: expect.any(String), apiSecret: expect.any(String) }],
  ])('%j (secret stored: %s, typed %j) gives %j', (d, hasSecret, secret, problems) => {
    expect(validateMediaStorage(d, hasSecret, secret)).toEqual(problems);
  });
});

describe('quick registration validation', () => {
  const ok = { expiryHours: '24', reminderHoursBeforeExpiry: '4', requireDateOfBirthOnCompletion: false };

  it.each([
    [{ expiryHours: '1', reminderHoursBeforeExpiry: '1' }, []],
    [{ expiryHours: '720', reminderHoursBeforeExpiry: '720' }, []],
    [{ reminderHoursBeforeExpiry: '0' }, []],
    [{ expiryHours: '0' }, ['expiryHours']],
    [{ expiryHours: '721' }, ['expiryHours']],
    [{ expiryHours: '' }, ['expiryHours']],
    [{ expiryHours: '1.5' }, ['expiryHours']],
    [{ expiryHours: '1e1' }, ['expiryHours']],
    [{ reminderHoursBeforeExpiry: '25' }, ['reminderHoursBeforeExpiry']],
    [{ reminderHoursBeforeExpiry: '-1' }, ['reminderHoursBeforeExpiry']],
    [{ reminderHoursBeforeExpiry: '' }, ['reminderHoursBeforeExpiry']],
    [{ expiryHours: '24 ', reminderHoursBeforeExpiry: ' 4' }, []],
  ])('%j gives errors on %j', (patch, fields) => {
    expect(Object.keys(validateQuickRegistration({ ...ok, ...patch }))).toEqual(fields);
  });
});

describe('patient field order', () => {
  it.each([
    [['a', 'b', 'c'], 'b', -1, ['b', 'a', 'c']],
    [['a', 'b', 'c'], 'b', 1, ['a', 'c', 'b']],
    [['a', 'b', 'c'], 'a', -1, ['a', 'b', 'c']],
    [['a', 'b', 'c'], 'c', 1, ['a', 'b', 'c']],
    [['a', 'b', 'c'], 'z', 1, ['a', 'b', 'c']],
    [[], 'a', 1, []],
  ] as const)('%j move %s by %i', (order, key, direction, expected) => {
    expect(moveKey(order, key, direction)).toEqual(expected);
  });

  it('never changes the list it was given', () => {
    const order = ['a', 'b'];
    moveKey(order, 'a', 1);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('site content drafts', () => {
  const text: SlotDef = { key: 'home.title', label: 'Nadpis', group: 'Úvodní stránka › Hero', kind: 'text', defaultText: 'Výchozí nadpis' };
  const image: SlotDef = { key: 'home.photo', label: 'Fotka', group: 'Úvodní stránka › Hero', kind: 'image' };

  it('the text on show is the clinic\'s own, or the built-in default when there is none or it is blank', () => {
    expect(effectiveText(text, undefined)).toBe('Výchozí nadpis');
    expect(effectiveText(text, { kind: 'text', text: '   ' })).toBe('Výchozí nadpis');
    expect(effectiveText(text, { kind: 'text', text: 'Moje' })).toBe('Moje');
  });

  it.each([
    ['a text typed over the default is a change', text, undefined, { text: 'Nový' }, { text: 'Nový' }],
    ['the default retyped is not', text, undefined, { text: 'Výchozí nadpis' }, {}],
    ['a text equal to the stored one is not', text, { kind: 'text' as const, text: 'Moje' }, { text: 'Moje' }, {}],
    ['no draft is no change', text, undefined, undefined, {}],
    ['alt text on a photo is a change', image, undefined, { alt: 'Popis' }, { alt: 'Popis' }],
    ['alt on a text slot is ignored', text, undefined, { alt: 'Popis' }, {}],
    ['text on a photo slot is ignored', image, undefined, { text: 'x' }, {}],
    ['emptying the alt of a photo that had one is a change', image, { kind: 'image' as const, alt: 'Stará' }, { alt: '' }, { alt: '' }],
  ])('%s', (_name, def, value, draft, changes) => {
    expect(draftChanges(def, value, draft)).toEqual(changes);
    expect(isDirty(def, value, draft)).toBe(Object.keys(changes).length > 0);
  });

  it.each([
    [{ text: '   ' }, 'Text nesmí být prázdný'],
    [{ text: 'x'.repeat(TEXT_LIMIT + 1) }, 'Text je příliš dlouhý'],
    [{ alt: 'x'.repeat(ALT_LIMIT + 1) }, 'Popis je příliš dlouhý'],
  ])('refuses %j with a sentence', (changes, sentence) => {
    expect(draftProblem(text, changes)).toContain(sentence);
  });

  it.each([[{ text: 'x'.repeat(TEXT_LIMIT) }], [{ alt: 'x'.repeat(ALT_LIMIT) }], [{ alt: '' }], [{}]])('lets %j through', (changes) => {
    expect(draftProblem(text, changes)).toBeUndefined();
  });

  it('counts a slot as filled by its media url or its non-blank text', () => {
    expect(isFilled(image, { kind: 'image', mediaUrl: 'https://x/y.jpg' })).toBe(true);
    expect(isFilled(image, { kind: 'image' })).toBe(false);
    expect(isFilled(text, { kind: 'text', text: ' ' })).toBe(false);
    expect(isFilled(text, { kind: 'text', text: 'a' })).toBe(true);
    expect(isFilled(text, undefined)).toBe(false);
  });

  it('counts media and text slots apart', () => {
    expect(countSlots([text, image], { 'home.title': { kind: 'text', text: 'a' } })).toEqual({
      filled: 1, total: 2, mediaFilled: 0, mediaTotal: 1, textFilled: 1, textTotal: 1,
    });
  });

  it.each([['nadpis', true], ['NADPIS', true], ['hero', true], ['vychozi', true], ['výchozí', true], ['home.title', true], ['nic takového', false], ['', true]])(
    'search "%s" on the title slot = %s',
    (query, found) => {
      expect(matchesQuery(text, query)).toBe(found);
    },
  );
});

describe('what a refused save looks like to a screen', () => {
  it('takes the first sentence per field', () => {
    expect(fieldErrorsOf({ response: { data: { errors: { hoursBefore: ['Jedna', 'Dvě'], other: [] } } } })).toEqual({ hoursBefore: 'Jedna' });
  });

  it.each([null, undefined, {}, { response: {} }, { response: { data: { errors: 'x' } } }, { response: { data: { errors: null } } }])(
    'no field errors from %j',
    (error) => {
      expect(fieldErrorsOf(error)).toEqual({});
    },
  );

  it('keeps the server\'s message and falls back when there is none', () => {
    expect(problemMessageOf({ response: { data: { message: 'Hotovo ne.' } } }, 'Záloha')).toBe('Hotovo ne.');
    expect(problemMessageOf({ response: { data: { message: '  ' } } }, 'Záloha')).toBe('Záloha');
    expect(problemMessageOf(undefined, 'Záloha')).toBe('Záloha');
  });
});
