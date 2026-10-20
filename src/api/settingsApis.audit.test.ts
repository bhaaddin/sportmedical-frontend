/*
 * Audit of the API clients and pure helpers behind the second half of Nastavení:
 * which address each one talks to, what body it sends, and what a short, odd or
 * refused answer becomes. Every expectation about the SERVER's behaviour here was
 * measured against the dev API on 2026-10-20 (see docs/settings-audit-part2.md).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { get, post, put, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('./client', () => ({
  client: { get, post, put, delete: del },
  default: { get, post, put, delete: del },
}));

import { readReminderSettings, saveReminderSettings } from './reminderSettings';
import { saveConsentSettings, CONSENT_SETTINGS_OFFLINE } from './consentSettings';
import { normalizeQuickRegistration, quickRegistrationSettingsApi } from './quickRegistrationSettings';
import { normalizeCompanySettings, companySettingsApi } from './companySettings';
import { isMediaStorageReady, mediaStorageApi, parseMediaStorage } from './mediaStorageSettings';
import { emailTemplatesApi } from './emailTemplates';
import { twoFactorApi } from './twoFactor';
import { accountRefusal, ROLE_LABELS, USER_ACCOUNT_ROLES, userAccountsApi } from './userAccounts';
import { PERMISSION_LABELS, userPermissionsApi } from './userPermissions';
import { listFeedback } from './feedback';
import { documentRequirementsApi } from './documentRequirements';
import { documentsApi } from './documents';
import { isValidQuestionKey, refusalText, toOptions } from './questionnaireEditor';
import { siteContentAdminApi, problemOf, parseAdminSiteContent } from './siteContentAdmin';
import { dayEnd, dayStart, fetchAuditChanges, fetchSettingChanges, formatChangeTime, formatChangeValue } from '../components/settings/changesApi';
import { integrationsApi, integrationsErrorText } from '../pages/settings/integrationsApi';
import { BookingApiError } from './apiError';
import { AxiosError } from 'axios';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

const refused = (status: number, data?: unknown) =>
  new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

describe('reminders', () => {
  it('reads from /api/v1/settings/reminders and hands back the server\'s bounds and default untouched', async () => {
    const body = { settings: { hoursBefore: 36 }, defaults: { hoursBefore: 24 }, minHours: 1, maxHours: 744 };
    get.mockResolvedValue({ data: body });
    expect(await readReminderSettings()).toEqual(body);
    expect(get).toHaveBeenCalledWith('/api/v1/settings/reminders');
  });

  it('puts only { hoursBefore } and returns the saved answer', async () => {
    const answer = { settings: { hoursBefore: 12 }, defaults: { hoursBefore: 24 }, minHours: 1, maxHours: 744 };
    put.mockResolvedValue({ data: answer });
    expect(await saveReminderSettings({ hoursBefore: 12 })).toEqual(answer);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/reminders', { hoursBefore: 12 });
  });
});

describe('consent settings', () => {
  it('puts the three fields to /api/v1/settings/consent (the staff address; the public read is a different one)', async () => {
    const body = { communicationVisible: false, communicationTitle: 'T', communicationDetail: 'D' };
    put.mockResolvedValue({ data: body });
    expect(await saveConsentSettings(body)).toEqual(body);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/consent', body);
  });

  it('the offline wording is the wording the form always showed, switched on', () => {
    expect(CONSENT_SETTINGS_OFFLINE.communicationVisible).toBe(true);
    expect(CONSENT_SETTINGS_OFFLINE.communicationTitle).toBe('Novinky a nabídky');
    expect(CONSENT_SETTINGS_OFFLINE.communicationDetail).toContain('potvrzení a připomínek');
  });
});

describe.each([
  ['quick registration', normalizeQuickRegistration],
])('%s normaliser', (_name, normalize) => {
  it.each([
    [undefined, { expiryHours: 0, reminderHoursBeforeExpiry: 0, requireDateOfBirthOnCompletion: false }],
    [null, { expiryHours: 0, reminderHoursBeforeExpiry: 0, requireDateOfBirthOnCompletion: false }],
    [{ expiryHours: '24' }, { expiryHours: 0, reminderHoursBeforeExpiry: 0, requireDateOfBirthOnCompletion: false }],
    [{ expiryHours: Number.NaN }, { expiryHours: 0, reminderHoursBeforeExpiry: 0, requireDateOfBirthOnCompletion: false }],
    [{ expiryHours: 48, reminderHoursBeforeExpiry: 6, requireDateOfBirthOnCompletion: true }, { expiryHours: 48, reminderHoursBeforeExpiry: 6, requireDateOfBirthOnCompletion: true }],
    [{ expiryHours: 48, requireDateOfBirthOnCompletion: 1 }, { expiryHours: 48, reminderHoursBeforeExpiry: 0, requireDateOfBirthOnCompletion: false }],
  ])('%j', (raw, expected) => {
    expect(normalize(raw)).toEqual(expected);
  });
});

describe('quick registration client', () => {
  it('reads and writes /api/v1/settings/quick-registration and returns the normalised answer', async () => {
    put.mockResolvedValue({ data: { expiryHours: 48, reminderHoursBeforeExpiry: 6, requireDateOfBirthOnCompletion: true } });
    const saved = await quickRegistrationSettingsApi.put({ expiryHours: 48, reminderHoursBeforeExpiry: 6, requireDateOfBirthOnCompletion: true });
    expect(put).toHaveBeenCalledWith('/api/v1/settings/quick-registration', { expiryHours: 48, reminderHoursBeforeExpiry: 6, requireDateOfBirthOnCompletion: true });
    expect(saved.requireDateOfBirthOnCompletion).toBe(true);
  });
});

describe('company settings', () => {
  it.each([
    ['null optional fields (what the server sends for an empty IBAN) become empty text', { legalName: 'A', dic: null, iban: null, bankAccount: null, dataBox: null }, { dic: '', iban: '', bankAccount: '', dataBox: '' }],
    ['a number that is not a number becomes 0, never NaN', { invoiceDueDays: '14' }, { invoiceDueDays: 0 }],
    ['an Infinity becomes 0', { invoiceDueDays: Number.POSITIVE_INFINITY }, { invoiceDueDays: 0 }],
    ['a 14-day due date survives', { invoiceDueDays: 14 }, { invoiceDueDays: 14 }],
    ['the printed "premises" the server also sends is not part of the form', { premises: 'Budova' }, {}],
  ])('%s', (_name, raw, expected) => {
    const out = normalizeCompanySettings(raw);
    expect(out).toMatchObject(expected);
    expect(out).not.toHaveProperty('premises');
    for (const value of Object.values(out)) expect(value === null || value === undefined).toBe(false);
  });

  it('puts the whole company to /api/v1/settings/company', async () => {
    const company = normalizeCompanySettings({ legalName: 'A', ico: '23351632', invoiceDueDays: 14 });
    put.mockResolvedValue({ data: company });
    await companySettingsApi.put(company);
    expect(put).toHaveBeenCalledWith('/api/v1/settings/company', company);
  });
});

describe('media storage', () => {
  it.each([
    [{ provider: '', enabled: null, cloudName: null, apiKey: null, hasSecret: null, uploadPreset: null }, { provider: 'cloudinary', enabled: false, cloudName: '', apiKey: '', hasSecret: false, uploadPreset: '' }],
    [{ provider: 'cloudinary', enabled: true, cloudName: 'c', apiKey: 'k', hasSecret: true, uploadPreset: 'p' }, { provider: 'cloudinary', enabled: true, cloudName: 'c', apiKey: 'k', hasSecret: true, uploadPreset: 'p' }],
    [{ value: { provider: 'cloudinary', enabled: true, cloudName: 'c', apiKey: 'k', hasSecret: false, uploadPreset: '' } }, { provider: 'cloudinary', enabled: true, cloudName: 'c', apiKey: 'k', hasSecret: false, uploadPreset: '' }],
  ])('reads %j', (raw, expected) => {
    expect(parseMediaStorage(raw)).toEqual(expected);
  });

  it('refuses an answer that is not an object rather than showing a blank form as if saved', () => {
    expect(() => parseMediaStorage('nonsense')).toThrow();
  });

  it('never reads a secret back: the type has hasSecret only', () => {
    const parsed = parseMediaStorage({ provider: 'cloudinary', enabled: true, cloudName: 'c', apiKey: 'k', hasSecret: true, uploadPreset: '', apiSecret: 'LEAK' });
    expect(JSON.stringify(parsed)).not.toContain('LEAK');
  });

  it.each([
    [{ enabled: true, cloudName: 'c', hasSecret: true }, true],
    [{ enabled: false, cloudName: 'c', hasSecret: true }, false],
    [{ enabled: true, cloudName: '  ', hasSecret: true }, false],
    [{ enabled: true, cloudName: 'c', hasSecret: false }, false],
  ])('ready(%j) = %s', (settings, expected) => {
    expect(isMediaStorageReady(settings)).toBe(expected);
  });

  it('puts what it is given, with the secret only when present', async () => {
    put.mockResolvedValue({ data: { provider: 'cloudinary', enabled: false, cloudName: '', apiKey: '', hasSecret: false, uploadPreset: '' } });
    await mediaStorageApi.put({ provider: 'cloudinary', enabled: false, cloudName: '', apiKey: '', uploadPreset: '' });
    const sent = put.mock.calls[0][1] as Record<string, unknown>;
    expect(put.mock.calls[0][0]).toBe('/api/v1/settings/media-storage');
    expect('apiSecret' in sent).toBe(false);
  });
});

describe('integrations', () => {
  it('reads the nested ADAM block and the retired MEDISTAR', async () => {
    get.mockResolvedValue({ data: { adam: { enabled: true, baseUrl: 'https://a', username: 'u', hasPassword: true }, medistar: { status: 'retired' } } });
    const loaded = await integrationsApi.get();
    expect(loaded.adam).toEqual({ enabled: true, baseUrl: 'https://a', username: 'u', hasPassword: true });
    expect(loaded.medistar.status).toBe('retired');
  });

  it('turns an answer without an adam block into an error instead of an empty form', async () => {
    get.mockResolvedValue({ data: { medistar: { status: 'retired' } } });
    await expect(integrationsApi.get()).rejects.toThrow();
  });

  it('fills missing text with empty text and a missing switch with off', async () => {
    get.mockResolvedValue({ data: { adam: {} } });
    expect((await integrationsApi.get()).adam).toEqual({ enabled: false, baseUrl: '', username: '', hasPassword: false });
  });

  it('wraps the save as { adam } and puts to /api/v1/settings/integrations', async () => {
    put.mockResolvedValue({ data: { adam: { enabled: false, baseUrl: '', username: '', hasPassword: false } } });
    await integrationsApi.save({ enabled: false, baseUrl: 'https://a', username: 'u' });
    expect(put).toHaveBeenCalledWith('/api/v1/settings/integrations', { adam: { enabled: false, baseUrl: 'https://a', username: 'u' } });
  });

  it.each([
    [{ response: { data: { message: 'Pro zapnutí integrace vyplňte heslo.' } } }, 'Pro zapnutí integrace vyplňte heslo.'],
    [{ response: { data: { message: '   ' } } }, 'fallback'],
    [{ response: { data: null } }, 'fallback'],
    [null, 'fallback'],
  ])('error text of %j', (error, expected) => {
    expect(integrationsErrorText(error, 'fallback')).toBe(expected);
  });
});

describe('e-mail templates client', () => {
  const template = { code: 'booking-confirmation', name: 'N', category: 'rezervace', description: 'D', subject: 'S', bodyHtml: '<p>B</p>', placeholders: [], isCustomized: false, version: 1 };

  it('lists from /api/email-templates', async () => {
    get.mockResolvedValue({ data: [template] });
    expect(await emailTemplatesApi.list()).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/api/email-templates');
  });

  it('encodes the code in every address', async () => {
    get.mockResolvedValue({ data: template });
    post.mockResolvedValue({ data: template });
    put.mockResolvedValue({ data: template });
    await emailTemplatesApi.get('a/b c');
    await emailTemplatesApi.reset('a/b c');
    expect(get).toHaveBeenCalledWith('/api/email-templates/a%2Fb%20c');
    expect(post).toHaveBeenCalledWith('/api/email-templates/a%2Fb%20c/reset', {});
  });

  it('saves { subject, bodyHtml } only', async () => {
    put.mockResolvedValue({ data: template });
    await emailTemplatesApi.save('booking-confirmation', 'Předmět', '<p>Text</p>');
    expect(put).toHaveBeenCalledWith('/api/email-templates/booking-confirmation', { subject: 'Předmět', bodyHtml: '<p>Text</p>' });
  });

  it('previews what is on screen, not what is stored', async () => {
    post.mockResolvedValue({ data: { subject: 'S', bodyHtml: 'B' } });
    await emailTemplatesApi.preview('x', 'nový předmět', 'nový text');
    expect(post).toHaveBeenCalledWith('/api/email-templates/x/preview', { subject: 'nový předmět', bodyHtml: 'nový text' });
  });

  it('test-send sends no wording at all: the server tests the SAVED template', async () => {
    post.mockResolvedValue({ data: { sentTo: 'a@b.cz', subject: 'S' } });
    await emailTemplatesApi.testSend('x');
    expect(post).toHaveBeenCalledWith('/api/email-templates/x/test-send', {});
  });

  it('carries the server\'s sentence about an unknown placeholder to the editor', async () => {
    put.mockRejectedValue(refused(400, { code: 'email_template.unknown_placeholder', message: 'Šablona používá zástupný symbol, který tento e-mail nezná: {{neexistuje}}.' }));
    const error = await emailTemplatesApi.save('x', 's', 'b').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BookingApiError);
    expect((error as BookingApiError).serverMessage).toContain('{{neexistuje}}');
  });

  it('an answer that is not a template is an error, not an empty editor', async () => {
    get.mockResolvedValue({ data: { code: 1 } });
    await expect(emailTemplatesApi.get('x')).rejects.toBeInstanceOf(BookingApiError);
  });
});

describe('two-factor client', () => {
  it('reads the status and unwraps a { value } envelope', async () => {
    get.mockResolvedValue({ data: { value: { enabled: true, setupPending: false } } });
    expect(await twoFactorApi.status()).toEqual({ enabled: true, setupPending: false });
    expect(get).toHaveBeenCalledWith('/api/v1/account/two-factor');
  });

  it('sends the code as { code } to confirm and to disable', async () => {
    post.mockResolvedValue({ data: { recoveryCodes: ['a', 'b'] } });
    expect(await twoFactorApi.confirm('123456')).toEqual({ recoveryCodes: ['a', 'b'] });
    await twoFactorApi.disable('654321');
    expect(post).toHaveBeenNthCalledWith(1, '/api/v1/account/two-factor/confirm', { code: '123456' });
    expect(post).toHaveBeenNthCalledWith(2, '/api/v1/account/two-factor/disable', { code: '654321' });
  });

  it('begins setup with an empty body', async () => {
    post.mockResolvedValue({ data: { secret: 'S', otpauthUri: 'otpauth://x' } });
    await twoFactorApi.beginSetup();
    expect(post).toHaveBeenCalledWith('/api/v1/account/two-factor/setup', {});
  });
});

describe('accounts', () => {
  it.each([
    ['account.last_owner_protected', 'Posledního aktivního vlastníka nejde vypnout ani mu vzít roli.'],
    ['account.email_already_exists', 'Účet s tímto e-mailem už existuje.'],
    ['account.email_invalid', 'E-mail není ve správném tvaru.'],
    ['account.display_name_invalid', 'Vyplňte jméno a příjmení.'],
    ['account.not_found', 'Tenhle účet už neexistuje. Obnovte seznam.'],
    ['access.denied', 'Na tohle nemáte oprávnění.'],
    ['something.else', 'Požadavek se nepodařilo provést.'],
  ])('refusal %s is said in Czech', (code, text) => {
    expect(accountRefusal({ response: { data: { code } } })).toBe(text);
  });

  it('a refusal with no body at all still says something', () => {
    expect(accountRefusal(undefined)).toBe('Požadavek se nepodařilo provést.');
  });

  it('has a Czech label for every role it can assign', () => {
    for (const role of USER_ACCOUNT_ROLES) expect(ROLE_LABELS[role].length).toBeGreaterThan(2);
  });

  it('sets access with { isActive } and the role with { role }', async () => {
    put.mockResolvedValue({ data: { userId: '1' } });
    await userAccountsApi.setActive('u1', false);
    await userAccountsApi.assignRole('u1', 'Staff');
    expect(put).toHaveBeenNthCalledWith(1, '/api/v1/users/u1/active', { isActive: false });
    expect(put).toHaveBeenNthCalledWith(2, '/api/v1/users/u1/role', { role: 'Staff' });
  });

  it('a list that is not a list is an empty list', async () => {
    get.mockResolvedValue({ data: { oops: true } });
    expect(await userAccountsApi.list()).toEqual([]);
  });
});

describe('per-employee permissions', () => {
  it('sends granted: null for "podle role", true and false otherwise', async () => {
    put.mockResolvedValue({ data: [] });
    await userPermissionsApi.set('u', 'billing.manage', null);
    await userPermissionsApi.set('u', 'billing.manage', true);
    await userPermissionsApi.set('u', 'patients.export', false);
    expect(put.mock.calls.map((c) => c[1])).toEqual([{ granted: null }, { granted: true }, { granted: false }]);
    expect(put.mock.calls[2][0]).toBe('/api/v1/users/u/permissions/patients.export');
  });

  it('has a label for every permission the server sent the owner at sign-in', () => {
    for (const permission of [
      'billing.approve', 'billing.manage', 'bookings.cancel', 'bookings.create', 'bookings.edit', 'communication.manage',
      'documents.manage', 'documents.view', 'patients.edit', 'patients.export', 'patients.register',
      'patients.sensitive_identity.view', 'patients.view', 'patients.view_all', 'questionnaires.manage', 'roles.manage',
      'settings.clinic.manage', 'users.manage',
    ]) {
      expect(PERMISSION_LABELS[permission], permission).toBeDefined();
    }
  });

  it('no longer claims that communication.manage opens nothing - the e-mail templates need it', () => {
    expect(PERMISSION_LABELS['communication.manage'].detail).not.toContain('nic neotvírá');
    expect(PERMISSION_LABELS['communication.manage'].detail).toContain('SMS a e-maily');
  });
});

describe('feedback list', () => {
  it('reads /api/v1/feedback as it is', async () => {
    get.mockResolvedValue({ data: [{ id: 'f', appointmentId: 'a', patientId: 'p', rating: 5, comment: null, invitedAtUtc: 'x', submittedAtUtc: 'y' }] });
    expect(await listFeedback()).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/api/v1/feedback');
  });
});

describe('document rules client', () => {
  const rule = { id: 'r', templateId: 't', templateName: 'T', clinicServiceId: 's', serviceName: 'S', serviceExists: true, validityMonths: 12, warnDaysBefore: 30, firstVisitOnly: false, blocksBooking: false };

  it('adds with { templateId, clinicServiceId } and updates with the four settings', async () => {
    post.mockResolvedValue({ data: rule });
    put.mockResolvedValue({ data: rule });
    await documentRequirementsApi.add('t', 's');
    await documentRequirementsApi.update('r', { validityMonths: 6, warnDaysBefore: 10, firstVisitOnly: true, blocksBooking: false });
    expect(post).toHaveBeenCalledWith('/api/documents/requirements', { templateId: 't', clinicServiceId: 's' });
    expect(put).toHaveBeenCalledWith('/api/documents/requirements/r', { validityMonths: 6, warnDaysBefore: 10, firstVisitOnly: true, blocksBooking: false });
  });

  it('reads a rule whose service is gone (null id, no name) without throwing', async () => {
    get.mockResolvedValue({ data: [{ ...rule, clinicServiceId: null, serviceName: null, serviceExists: false }] });
    const [only] = await documentRequirementsApi.list();
    expect(only.clinicServiceId).toBeNull();
    expect(only.serviceName).toBe('');
  });

  it('reads months and days sent as text', async () => {
    get.mockResolvedValue({ data: [{ ...rule, validityMonths: '6', warnDaysBefore: '10' }] });
    const [only] = await documentRequirementsApi.list();
    expect([only.validityMonths, only.warnDaysBefore]).toEqual([6, 10]);
  });

  it('deletes by id', async () => {
    del.mockResolvedValue({});
    await documentRequirementsApi.remove('r');
    expect(del).toHaveBeenCalledWith('/api/documents/requirements/r');
  });
});

describe('document templates client', () => {
  it('asks for the switched-off ones only when told to', async () => {
    get.mockResolvedValue({ data: [] });
    await documentsApi.getTemplates();
    await documentsApi.getTemplates(true);
    expect(get).toHaveBeenNthCalledWith(1, '/api/documents/templates');
    expect(get).toHaveBeenNthCalledWith(2, '/api/documents/templates?includeInactive=true');
  });

  it('puts the whole template: name, description and isActive', async () => {
    put.mockResolvedValue({ data: { id: 'i' } });
    await documentsApi.updateTemplate('i', { name: 'N', description: '', isActive: false });
    expect(put).toHaveBeenCalledWith('/api/documents/templates/i', { name: 'N', description: '', isActive: false });
  });
});

describe('questionnaire option keys', () => {
  it('keys a new question\'s choices by place', () => {
    expect(toOptions('sport', 'A\nB\nC').map((o) => o.key)).toEqual(['sport_1', 'sport_2', 'sport_3']);
  });

  it('falls back to "volba" while the question has no key yet', () => {
    expect(toOptions('', 'A').map((o) => o.key)).toEqual(['volba_1']);
  });

  it.each([
    ['a typo fixed in place keeps its key', [['q_1', 'Ne'], ['q_2', 'Ano']], 'Ne\nAno!', ['q_1', 'q_2']],
    ['removing the first choice does not renumber the rest', [['q_1', 'Ne'], ['q_2', 'Ano'], ['q_3', 'Možná']], 'Ano\nMožná', ['q_2', 'q_3']],
    ['reordering keeps each choice\'s key', [['q_1', 'Ne'], ['q_2', 'Ano']], 'Ano\nNe', ['q_2', 'q_1']],
    ['a new choice gets the smallest number not used', [['q_1', 'Ne'], ['q_3', 'Ano']], 'Ne\nAno\nMožná', ['q_1', 'q_3', 'q_2']],
    ['a seeded key that is not q_n is kept', [['rekrea', 'Rekreační'], ['amater', 'Amatérská']], 'Rekreační\nAmatérská\nPro', ['rekrea', 'amater', 'q_1']],
    ['blank lines and spaces around a line are ignored', [['q_1', 'Ne']], '  Ne  \n\n   \n', ['q_1']],
  ])('%s', (_name, existing, text, keys) => {
    const out = toOptions('q', text, (existing as string[][]).map(([key, displayText]) => ({ key, displayText })));
    expect(out.map((o) => o.key)).toEqual(keys);
    expect(out.map((o) => o.sortOrder)).toEqual(out.map((_, i) => i + 1));
    expect(new Set(out.map((o) => o.key)).size).toBe(out.length);
  });

  it.each([
    ['bolest_hrudi', true], ['s1_cukrovka', true], ['a', true], ['1', true], ['q_1_x', true],
    ['', false], ['Bolest', false], ['bolest hrudi', false], ['bolest-hrudi', false], ['_x', false], ['bolest_hrudí', false], ['Špatný klíč', false],
  ])('key "%s" valid = %s', (key, valid) => {
    expect(isValidQuestionKey(key)).toBe(valid);
  });

  it('shows the server\'s own refusal sentence, else a fixed one', () => {
    expect(refusalText({ response: { data: { message: 'Dvě otázky nesmí mít stejný klíč.' } } })).toBe('Dvě otázky nesmí mít stejný klíč.');
    expect(refusalText(undefined)).toBe('Změnu se nepodařilo uložit. Zkuste to prosím znovu.');
  });
});

describe('site content client', () => {
  it('encodes the slot key in the address and puts only the changed fields', async () => {
    put.mockResolvedValue({ data: { kind: 'text', text: 'T' } });
    await siteContentAdminApi.putSlot('home.hero title', { text: 'T' });
    expect(put).toHaveBeenCalledWith('/api/v1/site-content/slots/home.hero%20title', { text: 'T' });
  });

  it('deletes a slot to give back the built-in default', async () => {
    del.mockResolvedValue({});
    await siteContentAdminApi.deleteSlot('home.hero');
    expect(del).toHaveBeenCalledWith('/api/v1/site-content/slots/home.hero');
  });

  it('reads the empty site the dev API sends', () => {
    expect(parseAdminSiteContent({ version: 'v', slots: {}, partners: [], faq: [] })).toEqual({ version: 'v', slots: {}, partners: [], faq: [] });
  });

  it.each([
    [{ message: 'Obsah nelze uložit: Zadejte text.', errors: { text: ['x'] } }, 'Obsah nelze uložit: Zadejte text.'],
    [{ errors: { text: ['Zadejte text.'] } }, 'Zadejte text.'],
    [{}, 'záloha'],
  ])('problem sentence of %j', (data, expected) => {
    expect(problemOf({ response: { data } }, 'záloha')).toBe(expected);
  });
});

describe('change history client', () => {
  const page = { items: [{ at: '2026-10-20T08:00:00Z', user: 'a@b.cz', scope: 'consent', label: 'L', before: 'x', after: 'y' }], total: 1 };

  it('turns a picked day into the whole of that day, in the browser\'s time zone', () => {
    expect(dayStart('2026-10-20')).toBe(new Date(2026, 9, 20, 0, 0, 0, 0).toISOString());
    expect(dayEnd('2026-10-20')).toBe(new Date(2026, 9, 20, 23, 59, 59, 999).toISOString());
  });

  it('the same day as "from" and "to" is a span of a day, not of nothing', () => {
    expect(new Date(dayEnd('2026-10-20')).getTime() - new Date(dayStart('2026-10-20')).getTime()).toBeGreaterThan(23 * 3600 * 1000);
  });

  it.each(['', 'junk', '2026-10-20T10:00:00Z', '20.10.2026'])('leaves %j untouched (not a bare date)', (value) => {
    expect(dayStart(value)).toBe(value);
    expect(dayEnd(value)).toBe(value);
  });

  it('sends only the filters that are set', async () => {
    get.mockResolvedValue({ data: page });
    await fetchAuditChanges({ take: 25, skip: 50, scope: '', from: '', to: '', user: '' });
    expect(get).toHaveBeenCalledWith('/api/v1/audit/changes', { params: { take: 25, skip: 50 } });
  });

  it('asks the per-screen panel for five by default', async () => {
    get.mockResolvedValue({ data: page });
    await fetchSettingChanges('consent');
    expect(get).toHaveBeenCalledWith('/api/v1/settings/changes', { params: { scope: 'consent', take: 5 } });
  });

  it('skips rows without a time and keeps the server total', async () => {
    get.mockResolvedValue({ data: { items: [{ label: 'no time' }, ...page.items], total: 9 } });
    const result = await fetchAuditChanges({ take: 25, skip: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(9);
  });

  it('an answer without items is an error the page can show', async () => {
    get.mockResolvedValue({ data: { total: 3 } });
    await expect(fetchAuditChanges({ take: 25, skip: 0 })).rejects.toThrow();
  });

  it.each([
    [null, '—'], [undefined, '—'], ['', '—'], [true, 'ano'], [false, 'ne'], ['text', 'text'], [{ a: 1 }, '{"a":1}'],
  ])('writes %j as %s', (value, text) => {
    expect(formatChangeValue(value)).toBe(text);
  });

  it('cuts a long value at 120 characters with an ellipsis', () => {
    const out = formatChangeValue('x'.repeat(200));
    expect(out).toHaveLength(118);
    expect(out.endsWith('…')).toBe(true);
  });

  it('writes an unreadable time as it came', () => {
    expect(formatChangeTime('not a date')).toBe('not a date');
  });
});
