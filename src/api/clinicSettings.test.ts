/*
 * `readSettings` must read the rows the shared client hands it.
 *
 * The client's response interceptor already unwraps the server's
 * { success, data } envelope. This function used to read `.data` a second
 * time, found nothing, and the "Veřejný web a kontakty" screen opened blank —
 * so saving it wrote blanks over the clinic's real name, e-mail, telephone and
 * address, and switched a disabled online booking back on.
 *
 * What would have to break for these to fail: someone reads `.data` again, or
 * the function stops filtering to the keys it was asked for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ client: { get, put: vi.fn() } }));

const { readSettings, PUBLIC_CLINIC_KEYS } = await import('./clinicSettings');

beforeEach(() => get.mockReset());

describe('readSettings', () => {
  it('reads the rows the client has already unwrapped', async () => {
    get.mockResolvedValue({
      data: [
        { key: PUBLIC_CLINIC_KEYS.name, value: 'SportMedical' },
        { key: PUBLIC_CLINIC_KEYS.bookingEnabled, value: 'false' },
      ],
    });

    await expect(readSettings(Object.values(PUBLIC_CLINIC_KEYS))).resolves.toEqual({
      [PUBLIC_CLINIC_KEYS.name]: 'SportMedical',
      [PUBLIC_CLINIC_KEYS.bookingEnabled]: 'false',
    });
  });

  it('leaves out keys nobody asked for', async () => {
    get.mockResolvedValue({ data: [{ key: 'security.maxLoginAttempts', value: '5' }] });

    await expect(readSettings([PUBLIC_CLINIC_KEYS.name])).resolves.toEqual({});
  });

  it('returns nothing, rather than throwing, when the body is empty', async () => {
    get.mockResolvedValue({ data: null });

    await expect(readSettings([PUBLIC_CLINIC_KEYS.name])).resolves.toEqual({});
  });
});
