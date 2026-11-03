/*
 * The feature flag of "Pohybová analýza". The module is OFF unless somebody turns it on, so merging it exposes nothing:
 * no route, no rail entry, no palette entry, no card on the patient's page.
 *
 *   flag   localStorage['sm-flag:movement'] === '1'   or the build variable VITE_FEATURE_MOVEMENT=1
 *   mock   localStorage['sm-flag:movement-mock'] === '1'   or VITE_MOVEMENT_MOCK=1
 *          (the fixtures of src/movement/fixtures answer instead of the backend; for development and screenshots only)
 */
export const MOVEMENT_FLAG_KEY = 'sm-flag:movement';
export const MOVEMENT_MOCK_KEY = 'sm-flag:movement-mock';

function stored(key: string): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function movementEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_MOVEMENT === '1' || stored(MOVEMENT_FLAG_KEY);
}

/** The mock only ever answers while the module itself is on. */
export function movementMock(): boolean {
  return movementEnabled() && (import.meta.env.VITE_MOVEMENT_MOCK === '1' || stored(MOVEMENT_MOCK_KEY));
}

export function setMovementFlag(on: boolean, mock = false): void {
  try {
    if (on) localStorage.setItem(MOVEMENT_FLAG_KEY, '1'); else localStorage.removeItem(MOVEMENT_FLAG_KEY);
    if (on && mock) localStorage.setItem(MOVEMENT_MOCK_KEY, '1'); else localStorage.removeItem(MOVEMENT_MOCK_KEY);
  } catch {
    /* storage unavailable: the flag stays off */
  }
}

/** Addresses of the module. */
export const MOVE_PATHS = {
  home: '/pohyb',
  admin: '/pohyb/spravce',
  upload: (patientId?: string) => (patientId === undefined ? '/pohyb/nahrat' : `/pohyb/nahrat?patientId=${encodeURIComponent(patientId)}`),
  clip: (clipId: string) => `/pohyb/klip/${encodeURIComponent(clipId)}`,
  patient: (patientId: string) => `/pohyb/pacient/${encodeURIComponent(patientId)}`,
} as const;
