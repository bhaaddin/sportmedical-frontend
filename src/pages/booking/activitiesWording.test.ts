/*
 * What the činnosti screen says about taking one out of the offer.
 *
 * Etapa 4, D9: `DELETE /api/activities/{id}` ARCHIVES. Nothing that appointments,
 * blocks or orders reference is removed, so the screen must never say "Smazat"
 * (or claim that it cannot be undone) beside a working "Obnovit". The visible
 * behaviour (confirm text, archived list, restore) is in ActivitiesPage.archive.test.tsx;
 * this guards the source against the old wording creeping back.
 */
import { describe, it, expect } from 'vitest';
import pageSource from './ActivitiesPage.tsx?raw';
import servicesSource from './ClinicServicesPage.tsx?raw';

describe('archive wording', () => {
  it.each([
    ['ActivitiesPage', pageSource as string],
    ['ClinicServicesPage', servicesSource as string],
  ])('%s does not call archiving deleting', (_name, source) => {
    expect(source).not.toContain('booking.common.delete');
    expect(source).not.toMatch(/>\s*Smazat\s*</);
    expect(source).not.toMatch(/Smazat (službu|činnost)/);
    expect(source).not.toMatch(/nelze vrátit/);
  });

  it('uses Archivovat for the action', () => {
    expect(pageSource as string).toContain('archive: "Archivovat"');
    expect(servicesSource as string).toContain("archive: 'Archivovat'");
  });
});
