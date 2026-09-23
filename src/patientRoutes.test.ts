/*
 * The patient screens, held against the permissions the server checks behind
 * them: GET /api/patients and /api/patients/{id} need patients.view, PUT
 * /api/patients/{id} needs patients.edit, registering needs patients.register.
 *
 * Until 23. 9. 2026 none of these routes or the sidebar entry asked for
 * anything, so somebody whose patients.view was revoked still saw "Pacienti"
 * and got a refusal on every screen behind it.
 */
import { describe, it, expect } from 'vitest';
import appRaw from './App.tsx?raw';

const appSource = appRaw as string;
const guards = new Map(
  [...appSource.matchAll(/path="(\/[a-z0-9/:-]*)" element=\{<RequirePermission of="([a-z._]+)">/g)]
    .map((m) => [m[1], m[2]] as const),
);

describe('the patient routes', () => {
  it.each([
    ['/patients', 'patients.view'],
    ['/patients/:id', 'patients.view'],
    ['/patients/:id/edit', 'patients.edit'],
    ['/patients/register', 'patients.register'],
  ])('%s asks for %s', (path, permission) => {
    expect(guards.get(path)).toBe(permission);
  });

  it('draws "Pacienti" in the sidebar only for somebody who may see patients', () => {
    expect(appSource).toMatch(/\{ text: 'Pacienti', icon: <People \/>, path: '\/patients', requires: 'patients.view' \}/);
  });
});
