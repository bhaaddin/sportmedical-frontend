/*
 * The three review actions, and the address each one posts to.
 *
 * Everything on the intake queue used to POST to
 * `/api/patients/intake-review/resolve`. That route does not exist: the server
 * has `/{intakeId}/link`, `/{intakeId}/register` and `/{intakeId}/dismiss`,
 * and the invented one answered 405 because it matched the GET-only detail
 * route with "resolve" standing in for an id.
 *
 * So the queue listed submissions and could act on none of them, and the
 * failure surfaced as "Akci se nepodařilo provést" - which reads like a flaky
 * network, not like a missing route. Nothing caught it because a URL is a
 * string and a string compiles.
 *
 * These tests exist for that: they pin the addresses and the bodies against
 * the running API's OpenAPI document, measured 12. 9. 2026.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('./client', () => ({ default: { post, get: vi.fn() } }));

const { linkIntake, registerIntake, dismissIntake } = await import('./intakeReview');

const INTAKE = '01a092bc-b771-780e-8cee-949bd0c24ed8';
const PATIENT = 'd7a23750-9fbd-472c-b8cb-ee7882144e4c';

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: {} });
});

describe('the review actions', () => {
  it('links to an existing patient at /link, with the patient and the reason', async () => {
    await linkIntake(INTAKE, PATIENT, 'Shoduje se rodné číslo.');

    expect(post).toHaveBeenCalledWith(
      `/api/patients/intake-review/${INTAKE}/link`,
      { patientId: PATIENT, reason: 'Shoduje se rodné číslo.' },
    );
  });

  it('registers a new patient at /register, with no body of its own', async () => {
    await registerIntake(INTAKE);

    expect(post).toHaveBeenCalledWith(`/api/patients/intake-review/${INTAKE}/register`, {});
  });

  it('dismisses at /dismiss, carrying the reason that gets audited', async () => {
    await dismissIntake(INTAKE, 'Duplicitní odeslání.');

    expect(post).toHaveBeenCalledWith(
      `/api/patients/intake-review/${INTAKE}/dismiss`,
      { reason: 'Duplicitní odeslání.' },
    );
  });

  /*
   * The specific shape of the old bug: one route for every decision, with the
   * action in the body. If anything ever posts there again it is back.
   */
  it('never posts to a single "resolve" route', async () => {
    await linkIntake(INTAKE, PATIENT, 'a');
    await registerIntake(INTAKE);
    await dismissIntake(INTAKE, 'b');

    for (const [url] of post.mock.calls) {
      expect(url).not.toMatch(/intake-review\/resolve$/);
    }
  });

  /* The id belongs in the path, not the body - the server reads it from the route. */
  it('puts the intake id in the path', async () => {
    await registerIntake(INTAKE);

    const [url, body] = post.mock.calls[0];
    expect(url).toContain(INTAKE);
    expect(body).not.toHaveProperty('intakeId');
  });
});
