import { describe, expect, it } from 'vitest';
import { resolveSlot } from '../../api/siteContent';
import { DEFAULT_SITE_CONTENT } from '../defaults';
import { formulareSlots } from './formulare';
import { slotDef } from '../siteSlots';

describe('the patient-form slots', () => {
  it('are registered under the group the admin sees, each with its current wording as the default', () => {
    expect(formulareSlots.length).toBeGreaterThan(30);
    for (const def of formulareSlots) {
      expect(def.kind).toBe('text');
      expect(def.key).toMatch(/^[a-z0-9][a-z0-9._-]{0,79}$/);
      expect(def.group.startsWith('Formuláře ›')).toBe(true);
      expect((def.defaultText ?? '').length).toBeGreaterThan(0);
      expect(slotDef(def.key)).toBeDefined();
    }
    expect(new Set(formulareSlots.map((d) => d.key)).size).toBe(formulareSlots.length);
  });

  it('keep the legal wording as it was shown before it became editable', () => {
    const read = (key: string) => resolveSlot(DEFAULT_SITE_CONTENT, key).text;
    expect(read('formulare.consent.treatment.error')).toBe('Bez souhlasu s poskytnutím zdravotních služeb nelze dotazník odeslat.');
    expect(read('formulare.consent.statutory.text')).toContain('zákona č. 372/2011 Sb.');
    expect(read('formulare.consent.rights.text')).toContain('{email}');
  });

  it("show the admin's wording when one is written, the default otherwise", () => {
    const content = {
      ...DEFAULT_SITE_CONTENT,
      slots: {
        'formulare.consent.club.title': { kind: 'text' as const, text: 'Klub' },
        'formulare.consent.report.title': { kind: 'text' as const, text: '   ' },
      },
    };
    expect(resolveSlot(content, 'formulare.consent.club.title').text).toBe('Klub');
    expect(resolveSlot(content, 'formulare.consent.report.title').text).toBe('Lékařská zpráva e-mailem');
  });

  it('hold no clinic data or price', () => {
    const all = formulareSlots.map((d) => d.defaultText).join('\n');
    expect(all).not.toMatch(/fdcgvvp|23351632|606|recepce@|Kč/);
  });
});
