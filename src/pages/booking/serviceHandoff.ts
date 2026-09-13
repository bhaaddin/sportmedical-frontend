/*
 * The way from a service that is missing something to the screen that adds it.
 *
 * A služba does not own its činnosti - the link lives on the činnost, and the
 * server has no way to accept it from the other side (`ClinicServiceInput` is
 * name, description and sortOrder, nothing more). So the Služby screen can
 * say "this one has no činnost" and cannot fix it, which is exactly what the
 * owner met: a warning telling him to assign činnosti, on a dialog with
 * nowhere to assign them.
 *
 * The honest fix is not to fake the assignment here - it is to carry which
 * service he was looking at to the screen that can, and open it ready.
 */

/** What a service row hands to the screen it sends you to. */
export interface ServiceHandoff {
  clinicServiceId: string;
}

/**
 * Reads the handoff back out of router state.
 *
 * `unknown` on purpose: `useLocation().state` is whatever the last navigation
 * put there, including `null` on a fresh load and anything at all after a back
 * button. A screen that trusts its shape opens a dialog on a page somebody
 * simply opened.
 */
export function handoffFrom(state: unknown): string | null {
  if (state === null || typeof state !== 'object') return null;

  const value = (state as Record<string, unknown>).clinicServiceId;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Whether the service handed over is one the screen can still offer.
 *
 * A retired or deleted service is not something to pre-select: the picker
 * does not list it, so the dialog would open with a value nothing shows and a
 * save button that never moves. Better to open plain and let the person
 * choose.
 *
 * Returns null while the services are still loading - not "no" - because the
 * two are different answers and only one of them should drop the handoff.
 */
export function handoffIsOfferable(
  clinicServiceId: string,
  services: readonly { id: string; isActive: boolean }[] | undefined,
): boolean | null {
  if (services === undefined) return null;
  return services.some((s) => s.id === clinicServiceId && s.isActive);
}
