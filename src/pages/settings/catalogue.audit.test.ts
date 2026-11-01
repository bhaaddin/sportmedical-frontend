/*
 * Audit of the second half of Nastavení (Komunikace a dokumenty, Můj účet and the whole Administrace):
 * what each role may open, that the menu and the router agree about it, where each
 * screen's change history is filed, and what the hub search finds.
 */
import { describe, it, expect } from 'vitest';
import staffRaw from '../../StaffApp.tsx?raw';
import {
  SETTINGS_SECTIONS,
  scopeOf,
  searchSections,
  searchSettingsItems,
  settingsItemAt,
  visibleSections,
  type SettingsItem,
} from './catalogue';

const MINE = ['komunikace-a-dokumenty', 'ucet', 'administrace'];
const myItems = SETTINGS_SECTIONS.filter((s) => MINE.includes(s.id)).flatMap((s) => s.items.map((i) => ({ section: s, item: i })));
const byId = (id: string): SettingsItem => {
  const hit = myItems.find((x) => x.item.id === id);
  if (hit === undefined) throw new Error(`no item ${id}`);
  return hit.item;
};

const ALL_PERMISSIONS = [
  'patients.view', 'patients.register', 'patients.edit', 'patients.sensitive_identity.view', 'patients.view_all',
  'settings.clinic.manage', 'users.manage', 'roles.manage', 'bookings.create', 'bookings.edit', 'bookings.cancel',
  'questionnaires.manage', 'billing.manage', 'documents.view', 'documents.manage', 'communication.manage',
];

const idsFor = (held: string[]) =>
  visibleSections(held).filter((s) => MINE.includes(s.id)).flatMap((s) => s.items.map((i) => i.id)).sort();

describe('the router asks for the permission the menu lists', () => {
  /* <Route path="/x" element={<RequirePermission of="p">…}  or  element={<Page />} for everybody. */
  const routeRequirement = (path: string): string | null | undefined => {
    const escaped = path.replace(/[/]/g, '\\/');
    const line = new RegExp(`<Route path="${escaped}" element=\\{([^\\n]*)`).exec(staffRaw as string);
    if (line === null) return undefined;
    const guard = /<RequirePermission of="([a-z._]+)"/.exec(line[1]);
    return guard === null ? null : guard[1];
  };

  it.each(myItems.map(({ item }) => [item.id, item.to, item.requires ?? null] as const))(
    '%s (%s) needs %s in the menu and on the route',
    (_id, to, requires) => {
      const onRoute = routeRequirement(to);
      expect(onRoute).not.toBeUndefined();
      expect(onRoute).toBe(requires);
    },
  );
});

describe('who sees what in the second half of Nastavení', () => {
  const OPEN_TO_EVERYBODY = ['hodnoceni-pacientu', 'dvoufazove'];

  it('shows an owner (every permission) all 22 screens', () => {
    expect(idsFor(ALL_PERMISSIONS)).toHaveLength(22);
    expect(idsFor(ALL_PERMISSIONS)).toEqual(myItems.map((x) => x.item.id).sort());
  });

  it('shows somebody with no permission only the two screens that need none', () => {
    expect(idsFor([])).toEqual([...OPEN_TO_EVERYBODY].sort());
  });

  it.each([
    ['communication.manage', ['zpravy']],
    ['questionnaires.manage', ['zdravotni-dotaznik']],
    ['users.manage', ['tym']],
  ])('%s alone adds exactly %j', (permission, extra) => {
    expect(idsFor([permission])).toEqual([...OPEN_TO_EVERYBODY, ...extra].sort());
  });

  it('settings.clinic.manage opens the administration screens, Zprávy (reminders, sending) and neither single-permission one', () => {
    const ids = idsFor(['settings.clinic.manage']);
    expect(ids).toHaveLength(20);
    for (const closed of ['zdravotni-dotaznik', 'tym']) expect(ids).not.toContain(closed);
    for (const open of ['souhlasy', 'dokumenty-sablony', 'pravidla-dokumentu', 'udaje-pacienta', 'rychla-registrace', 'odkaz-registrace', 'media-a-texty', 'uloziste-medii', 'firma-a-faktury', 'integrace', 'historie-zmen', 'audit', 'zdravi', 'zabezpeceni-zalohy', 'zpravy', 'fronta-emailu', 'bezpecnostni-pravidla', 'verejny-web']) {
      expect(ids).toContain(open);
    }
  });

  it.each(['billing.manage', 'documents.manage', 'documents.view', 'roles.manage', 'patients.edit'])(
    'a permission that guards none of these screens (%s) opens nothing extra',
    (permission) => {
      expect(idsFor([permission])).toEqual([...OPEN_TO_EVERYBODY].sort());
    },
  );

  it('drops a whole group when nothing in it is allowed (the Administrace for a questionnaire manager)', () => {
    const groups = visibleSections(['questionnaires.manage']).map((s) => s.id);
    expect(groups).not.toContain('administrace');
    expect(groups).toContain('komunikace-a-dokumenty');
  });

  it('accepts a Set as well as an array of permissions', () => {
    expect(visibleSections(new Set(['users.manage'])).flatMap((s) => s.items.map((i) => i.id))).toContain('tym');
  });

  it('reads an unknown permission name as nothing', () => {
    expect(idsFor(['users.manage ', 'USERS.MANAGE', 'users'])).toEqual([...OPEN_TO_EVERYBODY].sort());
  });
});

describe('where each screen files its changes (Historie změn)', () => {
  /*
   * Measured on the dev API, 2026-10-20: the history stores a setting under the first words of its
   * key; the catalogue used the screen's id, which matched nothing for five of these screens.
   */
  it.each([
    ['zpravy', 'booking.reminderHoursBefore'],
    ['souhlasy', 'consent'],
    ['udaje-pacienta', 'patients'],
    ['rychla-registrace', 'registration.quick'],
    ['odkaz-registrace', 'intake'],
    ['uloziste-medii', 'media'],
    ['firma-a-faktury', 'company'],
    ['integrace', 'integrations'],
    ['bezpecnostni-pravidla', 'security'],
  ])('%s is filed under %s', (id, scope) => {
    expect(scopeOf(byId(id))).toBe(scope);
  });

  it.each([
    'hodnoceni-pacientu', 'zdravotni-dotaznik', 'dokumenty-sablony', 'pravidla-dokumentu',
    'media-a-texty', 'tym', 'dvoufazove', 'historie-zmen', 'audit', 'zdravi',
  ])('%s writes nothing to the settings history, so it has no scope', (id) => {
    expect(scopeOf(byId(id))).toBeNull();
  });

  it('an item that says nothing keeps its id as the scope (the rule the other half relies on)', () => {
    expect(scopeOf({ area: 'daily', id: 'x', label: 'x', description: 'x', to: '/x', keywords: [] })).toBe('x');
  });
});

describe('the hub search finds the second half by what a person would type', () => {
  const sections = visibleSections(ALL_PERMISSIONS);
  const first = (query: string) => searchSettingsItems(sections, query)[0]?.item.id;

  it.each([
    ['heslo', 'dvoufazove'],
    ['2fa', 'dvoufazove'],
    ['iban', 'firma-a-faktury'],
    ['splatnost', 'firma-a-faktury'],
    ['cloudinary', 'uloziste-medii'],
    ['adam', 'integrace'],
    ['marketing', 'souhlasy'],
    ['gdpr', 'souhlasy'],
    ['adresa webu', 'odkaz-registrace'],
    ['predregistrace', 'odkaz-registrace'],
    ['sms', 'zpravy'],
    ['predmet', 'zpravy'],
    ['hvezdicky', 'hodnoceni-pacientu'],
    ['anamneza', 'zdravotni-dotaznik'],
    ['rodne cislo', 'udaje-pacienta'],
    ['datova schranka', 'firma-a-faktury'],
    ['kdo zmenil', 'historie-zmen'],
    ['chyby', 'zdravi'],
    ['reset hesla', 'tym'],
    ['povinne dokumenty', 'pravidla-dokumentu'],
  ])('"%s" lands on %s first', (query, id) => {
    expect(first(query)).toBe(id);
  });

  it('ignores case and diacritics in the query', () => {
    expect(first('ÚLOŽIŠTĚ')).toBe(first('uloziste'));
    expect(first('Dvoufázové')).toBe('dvoufazove');
  });

  it('narrows with every word, so an extra word can only remove hits', () => {
    const wide = searchSettingsItems(sections, 'dokument').length;
    const narrow = searchSettingsItems(sections, 'dokument pravidlo').length;
    expect(narrow).toBeGreaterThan(0);
    expect(narrow).toBeLessThan(wide);
  });

  it('finds nothing for gibberish and everything for an empty query', () => {
    expect(searchSettingsItems(sections, 'qzxwv')).toEqual([]);
    expect(searchSettingsItems(sections, '   ')).toHaveLength(sections.flatMap((s) => s.items).length);
  });

  it('never offers a screen the person may not open', () => {
    const limited = visibleSections(['communication.manage']);
    const ids = searchSettingsItems(limited, 'iban').map((h) => h.item.id);
    expect(ids).not.toContain('firma-a-faktury');
  });

  it('searchSections puts a group with a label hit first', () => {
    const result = searchSections(sections, 'komunikace');
    expect(result[0].id).toBe('komunikace-a-dokumenty');
  });
});

describe('addresses inside the second half', () => {
  it.each(myItems.map(({ item }) => item.to))('%s and a sub-path of it are the same screen', (to) => {
    expect(settingsItemAt(to)?.item.to).toBe(to);
    expect(settingsItemAt(`${to}/neco`)?.item.to).toBe(to);
  });

  it('knows nothing about a path that only starts alike', () => {
    expect(settingsItemAt('/nastaveni/souhlasyx')).toBeNull();
  });
});
