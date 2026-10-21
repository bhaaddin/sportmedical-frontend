import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PINNED, MAX_RECENTS, RECENT_TTL_MS, clearRecents, emptyMemory, forgetRecents, getMemory, isPinned, memoryKey, parseMemory,
  recentsWithoutPins, rememberOpened, resetMemoryCacheForTests, serializeMemory, togglePin, togglePinned, touch,
} from './memory';

const NOW = Date.UTC(2026, 9, 21, 9, 0, 0);
const patient = (n: number) => ({ kind: 'patient', id: `p${n}`, label: `Pacient ${n}` });

describe('parseMemory: storage may hold anything', () => {
  it.each([[null], [undefined], [''], ['not json'], ['null'], ['42'], ['[]'], ['{"v":2,"recents":[]}'], ['{"recents":[{"kind":"patient"}]}']])(
    'reads %# as an empty memory, never an error',
    (raw) => {
      expect(parseMemory(raw as string | null, NOW)).toEqual(emptyMemory());
    },
  );

  it('drops junk entries but keeps the good ones', () => {
    const raw = JSON.stringify({
      v: 1,
      recents: [null, 5, 'x', { kind: 'bogus', id: 'a', label: 'A' }, patient(1), { kind: 'patient', id: 'p9', label: '850101/1234' }, { ...patient(2), at: NOW }],
      pinned: 'not a list',
    });
    const memory = parseMemory(raw, NOW);
    expect(memory.recents.map((r) => r.id)).toEqual(['p1', 'p2']);
    expect(memory.pinned).toEqual([]);
  });

  it('forgets recents older than 30 days and keeps pins for ever', () => {
    const old = NOW - RECENT_TTL_MS - 1000;
    const raw = JSON.stringify({ v: 1, recents: [{ ...patient(1), at: old }, { ...patient(2), at: NOW - 1000 }], pinned: [{ ...patient(3), at: old }] });
    const memory = parseMemory(raw, NOW);
    expect(memory.recents.map((r) => r.id)).toEqual(['p2']);
    expect(memory.pinned.map((r) => r.id)).toEqual(['p3']);
  });

  it('removes duplicates and caps the lists', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...patient(i), at: NOW }));
    const memory = parseMemory(JSON.stringify({ v: 1, recents: [...many, ...many], pinned: many }), NOW);
    expect(memory.recents).toHaveLength(MAX_RECENTS);
    expect(memory.pinned).toHaveLength(MAX_PINNED);
    expect(new Set(memory.recents.map((r) => r.id)).size).toBe(MAX_RECENTS);
  });

  it('keeps only ids and labels: an extra field in storage never comes back out', () => {
    const raw = JSON.stringify({ v: 1, recents: [{ ...patient(1), at: NOW, birthNumber: '850101/1234', insuranceNumber: '111', phone: '777' }], pinned: [] });
    const out = serializeMemory(parseMemory(raw, NOW));
    expect(out).not.toContain('850101');
    expect(out).not.toContain('insuranceNumber');
    expect(out).not.toContain('777');
  });
});

describe('touch / togglePin', () => {
  it('moves what was opened to the front and keeps at most 12', () => {
    let m = emptyMemory();
    for (let i = 0; i < 20; i += 1) m = touch(m, patient(i), NOW + i * 120_000);
    expect(m.recents).toHaveLength(MAX_RECENTS);
    expect(m.recents[0].id).toBe('p19');
    m = touch(m, patient(15), NOW + 99_000_000);
    expect(m.recents[0].id).toBe('p15');
    expect(m.recents.filter((r) => r.id === 'p15')).toHaveLength(1);
  });

  it('does not rewrite when the same thing is opened again within a minute', () => {
    const m = touch(emptyMemory(), patient(1), NOW);
    expect(touch(m, patient(1), NOW + 30_000)).toBe(m);
    expect(touch(m, patient(1), NOW + 61_000)).not.toBe(m);
  });

  it('ignores a ref that is junk or looks like an identifier', () => {
    const m = emptyMemory();
    expect(touch(m, { kind: 'patient', id: 'p1', label: '8501011234' }, NOW)).toBe(m);
    expect(touch(m, 'junk', NOW)).toBe(m);
  });

  it('pins and unpins, refuses a thirteenth pin and keeps a pinned label current', () => {
    let m = emptyMemory();
    m = togglePin(m, patient(1), NOW);
    expect(isPinned(m, { kind: 'patient', id: 'p1' })).toBe(true);
    m = togglePin(m, patient(1), NOW);
    expect(isPinned(m, { kind: 'patient', id: 'p1' })).toBe(false);

    for (let i = 0; i < MAX_PINNED; i += 1) m = togglePin(m, patient(i), NOW);
    expect(m.pinned).toHaveLength(MAX_PINNED);
    expect(togglePin(m, patient(99), NOW)).toBe(m);

    m = touch(m, { ...patient(3), label: 'Nové jméno' }, NOW);
    expect(m.pinned.find((p) => p.id === 'p3')?.label).toBe('Nové jméno');
  });

  it('shows a pinned entry once: recentsWithoutPins hides it', () => {
    let m = touch(touch(emptyMemory(), patient(1), NOW), patient(2), NOW);
    m = togglePin(m, patient(1), NOW);
    expect(recentsWithoutPins(m).map((r) => r.id)).toEqual(['p2']);
    expect(forgetRecents(m).recents).toEqual([]);
    expect(forgetRecents(m).pinned).toHaveLength(1);
  });
});

describe('the browser store', () => {
  beforeEach(() => {
    localStorage.clear();
    resetMemoryCacheForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps one slot per signed-in account', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
    expect(memoryKey()).toBe('sm-shelf:u-1');
    rememberOpened(patient(1));
    expect(getMemory().recents.map((r) => r.id)).toEqual(['p1']);

    localStorage.setItem('user', JSON.stringify({ id: 'u-2' }));
    expect(memoryKey()).toBe('sm-shelf:u-2');
    expect(getMemory().recents).toEqual([]);

    localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
    expect(getMemory().recents.map((r) => r.id)).toEqual(['p1']);
  });

  it('falls back to a shared slot when the stored user is junk', () => {
    localStorage.setItem('user', '{{{');
    expect(memoryKey()).toBe('sm-shelf:anon');
    localStorage.setItem('user', JSON.stringify({ id: '../../token' }));
    expect(memoryKey()).toBe('sm-shelf:anon');
  });

  it('writes only ids and labels', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
    rememberOpened({ ...patient(1), birthNumber: '850101/1234' });
    const raw = localStorage.getItem('sm-shelf:u-1') ?? '';
    expect(raw).toContain('Pacient 1');
    expect(raw).not.toContain('850101');
    expect(raw).not.toContain('birthNumber');
  });

  it('pins, unpins and clears the recents', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
    rememberOpened(patient(1));
    togglePinned(patient(2));
    expect(getMemory().pinned).toHaveLength(1);
    clearRecents();
    expect(getMemory().recents).toEqual([]);
    expect(getMemory().pinned).toHaveLength(1);
    togglePinned(patient(2));
    expect(getMemory().pinned).toEqual([]);
  });

  it('still works for this visit when storage refuses to write (private mode)', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u-1' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => rememberOpened(patient(1))).not.toThrow();
    expect(getMemory().recents.map((r) => r.id)).toEqual(['p1']);
  });

  it('survives storage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getMemory()).toEqual(emptyMemory());
  });
});
