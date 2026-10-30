/* Five callers on one page ask the server for the clinic once; a failure is not remembered. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const publicGet = vi.fn();
vi.mock('axios', async (orig) => {
  const real = await orig<typeof import('axios')>();
  return { ...real, default: { ...real.default, create: () => ({ get: publicGet }) } };
});
vi.mock('./client', () => ({ client: { get: vi.fn(), put: vi.fn() } }));

const { readPublicClinic, resetPublicClinicCache } = await import('./clinicSettings');

beforeEach(() => { publicGet.mockReset(); resetPublicClinicCache(); });

describe('readPublicClinic', () => {
  it('sends one request for concurrent and later callers', async () => {
    publicGet.mockResolvedValue({ data: { name: 'ZZ test', email: 'a@b.cz', phone: '', address: '' } });
    const all = await Promise.all([readPublicClinic(), readPublicClinic(), readPublicClinic(), readPublicClinic(), readPublicClinic()]);
    await readPublicClinic();
    expect(publicGet).toHaveBeenCalledTimes(1);
    expect(all.every((c) => c.name === 'ZZ test')).toBe(true);
  });

  it('does not remember a failure', async () => {
    publicGet.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce({ data: { name: 'ZZ test' } });
    expect((await readPublicClinic()).name).toBe('');
    expect((await readPublicClinic()).name).toBe('ZZ test');
    expect(publicGet).toHaveBeenCalledTimes(2);
  });
});
