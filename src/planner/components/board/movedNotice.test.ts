import { describe, expect, it } from 'vitest';
import { movedNoticeFor } from './useBoardMove';

describe('movedNoticeFor', () => {
  it('names the Zprávy switch when the clinic turned the reschedule e-mail off', () => {
    expect(movedNoticeFor(true, { patientNotified: false, reason: 'switched_off' }))
      .toContain('automatické oznámení o přesunu je vypnuté v Nastavení → Zprávy');
  });
});
