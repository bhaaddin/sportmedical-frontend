import { describe, expect, it } from 'vitest';
import { memoryRef } from './testRefs';
import {
  GROUP_LIMIT, NOW, emptyView, entityCommand, flatten, fold, moveIndex, rankCommands, resolveState, scoreCommand, sectionsOf,
  serverSearchAllowed, staticCommands, wordsOf, type Command,
} from './commandModel';

const cmd = (over: Partial<Command> & { label: string }): Command => ({ id: over.label, group: 'page', to: '/x', ...over });

describe('fold / wordsOf', () => {
  it('ignores case and diacritics and collapses spaces', () => {
    expect(fold('  Nová   OBJEDNÁVKA ')).toBe('nova objednavka');
    expect(wordsOf('Nová  objednávka')).toEqual(['nova', 'objednavka']);
    expect(wordsOf('   ')).toEqual([]);
  });
});

describe('scoreCommand', () => {
  it('ranks an exact label above a prefix above a word prefix above a substring above a keyword above a hint', () => {
    const w = wordsOf('fakt');
    const exact = scoreCommand(wordsOf('faktury'), cmd({ label: 'Faktury' }));
    const prefix = scoreCommand(w, cmd({ label: 'Faktury' }));
    const word = scoreCommand(w, cmd({ label: 'Účetní faktury' }));
    const inside = scoreCommand(w, cmd({ label: 'Nefaktura' }));
    const keyword = scoreCommand(w, cmd({ label: 'Doklady', keywords: ['faktury'] }));
    const hint = scoreCommand(w, cmd({ label: 'Doklady', hint: 'faktury a platby' }));
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(inside);
    expect(inside).toBeGreaterThan(keyword);
    expect(keyword).toBeGreaterThan(hint);
    expect(hint).toBeGreaterThan(0);
  });

  it('needs every word, in any order, and is 0 when one is missing', () => {
    const c = cmd({ label: 'Nová objednávka' });
    expect(scoreCommand(wordsOf('nova obj'), c)).toBeGreaterThan(0);
    expect(scoreCommand(wordsOf('obj nova'), c)).toBeGreaterThan(0);
    expect(scoreCommand(wordsOf('nova faktura'), c)).toBe(0);
    expect(scoreCommand([], c)).toBe(0);
  });

  it('matches without diacritics', () => {
    expect(scoreCommand(wordsOf('objednavka'), cmd({ label: 'Nová objednávka' }))).toBeGreaterThan(0);
    expect(scoreCommand(wordsOf('MARKOVA'), cmd({ label: 'Jana Marková' }))).toBeGreaterThan(0);
  });
});

describe('rankCommands', () => {
  const list = [
    cmd({ id: 'a', label: 'Karta Jana' }),
    cmd({ id: 'b', label: 'Jana Marková', group: 'patient', entity: { kind: 'patient', id: 'p1', label: 'Jana Marková' } }),
    cmd({ id: 'c', label: 'Jana Nováková', group: 'patient', entity: { kind: 'patient', id: 'p2', label: 'Jana Nováková' } }),
    cmd({ id: 'd', label: 'Fakturace' }),
  ];

  it('returns nothing for an empty query and drops what does not answer', () => {
    expect(rankCommands('', list)).toEqual([]);
    expect(rankCommands('   ', list)).toEqual([]);
    expect(rankCommands('zzz', list)).toEqual([]);
    expect(rankCommands('jana', list).map((c) => c.id)).not.toContain('d');
  });

  it('prefers a prefix over a word prefix, and keeps the given order between equals', () => {
    const ranked = rankCommands('jana', list).map((c) => c.id);
    expect(ranked.slice(0, 2)).toEqual(['b', 'c']);
    expect(ranked[2]).toBe('a');
  });

  it('lifts what is pinned above what is only recent above the rest', () => {
    const plain = rankCommands('jana', list).map((c) => c.id);
    const recent = rankCommands('jana', list, { recents: [memoryRef('p2', 'Jana Nováková')] }).map((c) => c.id);
    const pinned = rankCommands('jana', list, { pinned: [memoryRef('p2', 'Jana Nováková')], recents: [memoryRef('p1', 'Jana Marková')] }).map((c) => c.id);
    expect(plain[0]).toBe('b');
    expect(recent[0]).toBe('c');
    expect(pinned[0]).toBe('c');
    expect(pinned[1]).toBe('b');
  });
});

describe('what is offered, and to whom', () => {
  const labels = (held: string[]) => staticCommands(held).map((c) => c.label);

  it('offers the actions and pages a person may open, and hides the rest', () => {
    const none = labels([]);
    expect(none).toContain('Nová objednávka');
    expect(none).toContain('Kalendář');
    expect(none).not.toContain('Nový pacient');
    expect(none).not.toContain('Pacienti');
    expect(none).not.toContain('Fakturace');
    expect(none).not.toContain('Pokladna');
    /* A club's invoicing needs no permission and says whose it is, so it is not mistaken for the money screen. */
    expect(none).toContain('Fakturace · Kluby a týmy');

    const desk = labels(['patients.view', 'patients.register']);
    expect(desk).toContain('Nový pacient');
    expect(desk).toContain('Pacienti');
    expect(desk).toContain('Rychlá registrace');
    expect(desk).toContain('Kontrola registrací');
    expect(desk).not.toContain('Fakturace');

    const cashier = labels(['billing.manage']);
    expect(cashier).toContain('Fakturace');
    expect(cashier).toContain('Pokladna');
    expect(cashier).toContain('Účetní export');
  });

  it('offers "Nový pacient" once: the action wins over the page that opens the same address', () => {
    const rows = staticCommands(['patients.view', 'patients.register']).filter((c) => c.label === 'Nový pacient');
    expect(rows).toHaveLength(1);
    expect(rows[0].group).toBe('action');
  });

  it('names a page once even when the sidebar and the top level both list it', () => {
    const pages = staticCommands(['patients.view']).filter((c) => c.group === 'page');
    const addresses = pages.map((c) => `${c.to}|${JSON.stringify(c.state ?? null)}`);
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(pages.find((c) => c.to === '/patients')?.label).toBe('Pacienti');
  });

  it('starts "Nová objednávka" with a timestamp the calendar reads, and "Klubová objednávka" with its flag', () => {
    const all = staticCommands([]);
    const created = all.find((c) => c.id === 'action-new-appointment')!;
    expect(resolveState(created.state, 1234)).toEqual({ newAppointment: 1234 });
    expect(created.state).toEqual({ newAppointment: NOW });
    expect(resolveState(all.find((c) => c.id === 'action-club-order')!.state)).toEqual({ openClubOrder: true });
    expect(resolveState(undefined)).toBeUndefined();
  });

  it('finds "Nová objednávka" by what a receptionist calls it', () => {
    const ids = (q: string) => rankCommands(q, staticCommands([])).map((c) => c.id);
    expect(ids('nova obj')[0]).toBe('action-new-appointment');
    expect(ids('objednat')[0]).toBe('action-new-appointment');
  });
});

describe('the opening view', () => {
  const pinned = [{ ...memoryRef('p1', 'Jana Marková'), at: 1 }];
  const recents = [
    { ...memoryRef('p2', 'Anna Černá'), at: 2 },
    { kind: 'invoice' as const, id: 'i1', label: 'FA-1', at: 3 },
  ];

  it('shows quick actions, pins, recents and a few pages, in that order', () => {
    const view = emptyView(['patients.view', 'billing.manage'], { pinned, recents });
    expect(view.map((s) => s.id)).toEqual(['actions', 'pinned', 'recents', 'pages']);
    expect(view[1].commands[0].label).toBe('Jana Marková');
  });

  it('hides a pinned or recent entity the person may not open', () => {
    const view = emptyView(['patients.view'], { pinned, recents });
    expect(view.find((s) => s.id === 'recents')?.commands.map((c) => c.label)).toEqual(['Anna Černá']);
    const blind = emptyView([], { pinned, recents });
    expect(blind.map((s) => s.id)).toEqual(['actions', 'pages']);
  });
});

describe('sections and the arrow keys', () => {
  it('groups by kind in the order of each group\'s best row and caps a group', () => {
    const ranked: Command[] = [
      entityCommand({ kind: 'patient', id: '1', label: 'A' }),
      cmd({ id: 'p', label: 'Pacienti', group: 'page' }),
      ...Array.from({ length: 9 }, (_, i) => entityCommand({ kind: 'patient', id: `x${i}`, label: `B${i}` })),
      entityCommand({ kind: 'club', id: 'c', label: 'Klub' }),
    ];
    const sections = sectionsOf(ranked);
    expect(sections.map((s) => s.id)).toEqual(['patient', 'page', 'club']);
    expect(sections[0].commands).toHaveLength(GROUP_LIMIT);
    expect(flatten(sections)).toHaveLength(GROUP_LIMIT + 2);
  });

  it('wraps at both ends and stays at 0 for an empty list', () => {
    expect(moveIndex(0, -1, 5)).toBe(4);
    expect(moveIndex(4, 1, 5)).toBe(0);
    expect(moveIndex(2, 1, 5)).toBe(3);
    expect(moveIndex(3, 1, 0)).toBe(0);
  });
});

describe('privacy of what is typed', () => {
  it('does not send a birth number or a long run of digits to a search endpoint', () => {
    expect(serverSearchAllowed('850101/1234')).toBe(false);
    expect(serverSearchAllowed('8501011234')).toBe(false);
    expect(serverSearchAllowed('123456789')).toBe(false);
    expect(serverSearchAllowed('Marková')).toBe(true);
    expect(serverSearchAllowed('FA-2026-0014')).toBe(true);
  });

  it('does not search for a single character', () => {
    expect(serverSearchAllowed('a')).toBe(false);
    expect(serverSearchAllowed(' a ')).toBe(false);
    expect(serverSearchAllowed('ab')).toBe(true);
  });
});
