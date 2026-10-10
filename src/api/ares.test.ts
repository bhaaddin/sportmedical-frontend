/*
 * ARES client: the IČO gate, the tolerant reader and the refusal table
 * (the server's own sentence first, a Czech fallback when it sent none).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('./client', () => ({ default: { get }, client: { get } }));

const { AresError, aresApi, isPlausibleIco, normalizeIco, readAresManagement, readAresSubject, toAresError } = await import('./ares');

/* Two real-shaped IČO with the right check digit, and one with eight digits and the wrong one. */
const VALID = '25596641';
const VALID_2 = '27082440';
const WRONG_CHECK = '12345678';

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

/* A block body on purpose: `() => get.mockReset()` would return the mock, and vitest runs a hook's return value as its cleanup. */
beforeEach(() => {
  get.mockReset();
});

describe('isPlausibleIco', () => {
  it('wants eight digits and the Czech mod-11 check digit; spaces do not count', () => {
    expect(isPlausibleIco(VALID)).toBe(true);
    expect(isPlausibleIco(VALID_2)).toBe(true);
    expect(isPlausibleIco('255 966 41')).toBe(true);
    expect(isPlausibleIco(WRONG_CHECK)).toBe(false);
    expect(isPlausibleIco('2559664')).toBe(false);
    expect(isPlausibleIco('')).toBe(false);
    expect(isPlausibleIco('abcdefgh')).toBe(false);
    expect(normalizeIco(' 255 966 41 ')).toBe(VALID);
  });
});

describe('readAresSubject', () => {
  it('reads the contract and turns every missing field into null, an absent isActive into true', () => {
    const s = readAresSubject({ ico: VALID, name: 'Seznam.cz, a.s.', dic: 'CZ25596641', street: 'Radlická 3294/10', city: 'Praha', postalCode: '15000', isActive: true, fetchedAtUtc: '2026-10-10T08:00:00Z' });
    expect(s).toMatchObject({ ico: VALID, name: 'Seznam.cz, a.s.', dic: 'CZ25596641', street: 'Radlická 3294/10', city: 'Praha', postalCode: '15000', isActive: true });
    expect(s.legalForm).toBeNull();
    expect(s.established).toBeNull();
    expect(s.management).toEqual([]);

    const bare = readAresSubject({ ico: VALID, name: 'Spolek' });
    expect(bare.dic).toBeNull();
    expect(bare.street).toBeNull();
    expect(bare.isActive).toBe(true);
    expect(readAresSubject({ ico: VALID, name: 'Spolek', isActive: false }).isActive).toBe(false);
  });

  it('refuses a body that is not a subject at all', () => {
    expect(() => readAresSubject({})).toThrow(AresError);
    expect(() => readAresSubject(null)).toThrow(AresError);
  });

  it('reads the statutory body, skipping rows without a name', () => {
    expect(readAresManagement([
      { fullName: 'Jan Novák', role: 'předseda', since: '2020-01-01', until: null },
      { role: 'nikdo' },
      { fullName: 'Eva Nová' },
    ])).toEqual([
      { fullName: 'Jan Novák', role: 'předseda', since: '2020-01-01', until: null },
      { fullName: 'Eva Nová', role: '', since: null, until: null },
    ]);
    expect(readAresManagement(undefined)).toEqual([]);
    expect(readAresManagement('x')).toEqual([]);
  });
});

describe('toAresError', () => {
  it('shows the server\'s own sentence for 400, 404 and 502 with their codes', () => {
    expect(toAresError(refused(400, { code: 'ares.ico_invalid', message: 'IČO musí mít osm číslic.' }))).toMatchObject({ code: 'ares.ico_invalid', message: 'IČO musí mít osm číslic.', status: 400 });
    expect(toAresError(refused(404, { code: 'ares.not_found', message: 'Subjekt nenalezen.' }))).toMatchObject({ code: 'ares.not_found', message: 'Subjekt nenalezen.' });
    expect(toAresError(refused(502, { code: 'ares.unavailable', message: 'ARES neodpovídá.' }))).toMatchObject({ code: 'ares.unavailable', message: 'ARES neodpovídá.' });
  });

  it('falls back to its own Czech sentence when the server sent none, by status', () => {
    expect(toAresError(refused(404, {})).message).toBe('Subjekt s tímto IČO v ARES není.');
    expect(toAresError(refused(502, '')).message).toBe('ARES teď neodpovídá. Zkuste to za chvíli.');
    expect(toAresError(refused(503, {})).code).toBe('ares.unavailable');
    expect(toAresError(refused(500, {})).code).toBe('ares.failed');
    expect(toAresError(new AxiosError('net')).code).toBe('ares.offline');
    expect(toAresError(new Error('boom')).message).toBe('Načtení z ARES se nepodařilo.');
  });
});

describe('aresApi.lookup', () => {
  it('asks GET /api/ares/{ico} without spaces and reads the answer', async () => {
    get.mockResolvedValue({ data: { ico: VALID, name: 'Seznam.cz, a.s.' } });
    const s = await aresApi.lookup('255 966 41');
    expect(get).toHaveBeenCalledWith(`/api/ares/${VALID}`);
    expect(s.name).toBe('Seznam.cz, a.s.');
  });

  it('refuses an implausible IČO before any request', async () => {
    await expect(aresApi.lookup(WRONG_CHECK)).rejects.toMatchObject({ code: 'ares.ico_invalid' });
    expect(get).not.toHaveBeenCalled();
  });

  it('turns a refusal into an AresError', async () => {
    get.mockRejectedValue(refused(404, { code: 'ares.not_found', message: 'Nenalezeno.' }));
    const thrown = await aresApi.lookup(VALID).then(() => null, (e: unknown) => e);
    expect(thrown).toBeInstanceOf(AresError);
    expect((thrown as InstanceType<typeof AresError>).code).toBe('ares.not_found');
    expect((thrown as InstanceType<typeof AresError>).message).toBe('Nenalezeno.');
    expect((thrown as InstanceType<typeof AresError>).status).toBe(404);
  });
});
