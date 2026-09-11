/*
 * The public questionnaire must send an address, because without one the
 * server refuses the whole submission.
 *
 * This is not a hypothetical. `IntakeRequest` had no `address` at all and the
 * form never collected one, so `/dotaznik` - routed, live, and looking
 * perfectly ordinary - could not be submitted by anybody. Every attempt came
 * back `400 { errors: { Address: [...] } }`. Typecheck, lint and build were all
 * green throughout: nothing here is a type error, the field simply was not
 * there.
 *
 * It was found while checking somebody else's fix, by reading the error body
 * instead of only the status code.
 *
 * What would have to break for these to fail: dropping `address` from the
 * request again, sending the street and town instead of the code the register
 * wants, or losing the idempotency header that stops a double-tap becoming two
 * patients.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('axios', () => {
  const create = () => ({
    post,
    interceptors: { response: { use: vi.fn() }, request: { use: vi.fn() } },
  });
  return { default: { create, isAxiosError: () => false }, isAxiosError: () => false };
});

const { submitIntake } = await import('./publicIntake');
import type { IntakeRequest } from './publicIntake';
import { Sex } from '../services/publicIntake/validation';

const request = (): IntakeRequest => ({
  identity: {
    givenName: 'Eva',
    familyName: 'Testovaci',
    dateOfBirth: '1989-11-09',
    sex: Sex.Female,
    birthNumber: '8911099637',
  },
  contact: { email: 'eva@example.invalid', phone: '+420777123995' },
  address: { ruianAddressPointCode: 25381521 },
  insurance: { kind: 'czech', insuranceNumber: '8911099637', insurerCode: 111 },
  consents: [{ policyCode: 'treatment', granted: true }],
  websiteUrl: '',
});

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: { outcome: 0, referenceCode: 'ZD-2026-000001' } });
});

const sentBody = () => post.mock.calls[0][1] as IntakeRequest;

describe('submitIntake', () => {
  it('sends the address, as the register point code and nothing else', async () => {
    await submitIntake(request());

    expect(post).toHaveBeenCalledWith('/api/public/intake', expect.anything(), expect.anything());
    expect(sentBody().address).toEqual({ ruianAddressPointCode: 25381521 });
  });

  it('does not invent street, town or postal code - the server looks those up', async () => {
    await submitIntake(request());

    expect(Object.keys(sentBody().address)).toEqual(['ruianAddressPointCode']);
  });

  it('sends the code as a number, because the register keys on a long', async () => {
    await submitIntake(request());

    expect(typeof sentBody().address.ruianAddressPointCode).toBe('number');
  });

  /* Two taps on "Odeslat" must not become two patients. */
  it('carries an idempotency key', async () => {
    await submitIntake(request());

    const config = post.mock.calls[0][2] as { headers: Record<string, string> };
    expect(config.headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('keeps the same key across retries of one questionnaire', async () => {
    await submitIntake(request());
    await submitIntake(request());

    const first = (post.mock.calls[0][2] as { headers: Record<string, string> }).headers;
    const second = (post.mock.calls[1][2] as { headers: Record<string, string> }).headers;
    expect(second['Idempotency-Key']).toBe(first['Idempotency-Key']);
  });
});
