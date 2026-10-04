/*
 * What the činnosti screen says about taking one out of the offer.
 *
 * Etapa 4, D9: `DELETE /api/activities/{id}` ARCHIVES. Nothing that appointments,
 * blocks or orders reference is removed, so the screen must never say "Smazat"
 * beside a working "Obnovit". Etapa 6 added a separate permanent "Smazat"
 * (DeleteFlow); archiving keeps its own wording. The visible
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
    /* Etapa 6: a separate, explicit "Smazat" now exists (DeleteFlow, permanent=true).
       The archive confirm itself must still never promise a delete. */
    expect(source).not.toMatch(/archiv[^\r\n]*smaz/i);
  });

  it('uses Archivovat for the action', () => {
    expect(pageSource as string).toContain('archive: "Archivovat"');
    expect(servicesSource as string).toContain("archive: 'Archivovat'");
  });
});
