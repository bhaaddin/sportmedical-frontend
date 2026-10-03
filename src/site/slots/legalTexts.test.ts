/*
 * The privacy notice and the terms of a clinic. The Shopify e-shop template that stood here before
 * claimed that patients' data were "sold" and "shared" with marketing partners — false for a health
 * service provider and unacceptable under GDPR. These tests keep that text, and e-shop vocabulary
 * in general, from ever coming back, and keep the minimum a health-service notice must say.
 */
import { describe, it, expect } from 'vitest';
import { SOUKROMI_SECTIONS, soukromiSlots } from './soukromi';
import { PODMINKY_SECTIONS, podminkySlots } from './podminky';

const allText = (sections: readonly { title: string; text: string }[]) =>
  sections.map((s) => `${s.title}\n${s.text}`).join('\n\n');

const privacy = allText(SOUKROMI_SECTIONS);
const terms = allText(PODMINKY_SECTIONS);
const slotDefaults = [...soukromiSlots, ...podminkySlots].map((s) => s.defaultText ?? '').join('\n');

describe('no e-shop template in the legal texts', () => {
  const FORBIDDEN = [
    /\bprodali\b/i,
    /\bsdíleli\b/i,
    /prodej(e|i) osobních/i,
    /obchodní(m)? a marketingov/i,
    /shopify/i,
    /košík|doručen[íi] zboží|vrácení zboží|zakoupen/i,
    /odhlásit se z prodeje/i,
  ];

  it.each(FORBIDDEN.map((p) => [String(p), p] as const))('does not contain %s', (_name, pattern) => {
    expect(privacy).not.toMatch(pattern);
    expect(terms).not.toMatch(pattern);
    expect(slotDefaults).not.toMatch(pattern);
  });
});

describe('the privacy notice of a health service provider', () => {
  it('names the controller and says plainly that data are not sold or passed to marketing partners', () => {
    expect(privacy).toContain('SportMedical Diagnostics s.r.o.');
    expect(privacy).toContain('23351632');
    expect(privacy).toMatch(/neprodáváme a nepředáváme je obchodním ani marketingovým partnerům/);
  });

  it('covers health data, legal bases, retention, rights, the supervisory authority and real processors', () => {
    expect(privacy).toMatch(/zdravotní údaje/i);
    expect(privacy).toMatch(/čl\. 9 odst\. 2 písm\. h\)/);
    expect(privacy).toMatch(/372\/2011/);
    expect(privacy).toMatch(/10 let/);
    for (const right of ['přístup', 'opravu', 'výmaz', 'omezení', 'přenositelnost', 'námitku', 'odvolat souhlas', 'stížnost']) {
      expect(privacy.toLowerCase()).toContain(right);
    }
    expect(privacy).toContain('Úřad pro ochranu osobních údajů');
    for (const processor of ['Render', 'Vercel', 'Cloudinary']) expect(privacy).toContain(processor);
  });

  it('never types the clinic phone, e-mail or address: they come from the settings', () => {
    expect(privacy).toContain('{telefon}');
    expect(privacy).toContain('{email}');
    expect(privacy).toContain('{adresa}');
    expect(privacy).not.toMatch(/\+420|@sportmedical|Jihlavsk/);
  });
});

describe('the terms of a health service provider', () => {
  it('cover ordering, payment, cancellation, complaints and personal data, and point to Storno a reklamace', () => {
    const titles = PODMINKY_SECTIONS.map((s) => s.title.toLowerCase()).join(' | ');
    for (const word of ['objednání', 'platba', 'zrušení', 'reklamace', 'osobních údajů']) expect(titles).toContain(word);
    expect(terms).toContain('Storno a reklamace');
  });

  it('type no price and no percentage: the price list is the only source', () => {
    expect(terms).not.toMatch(/\d[\d  ]*\s?Kč/);
    expect(terms).not.toMatch(/\d\s?%/);
  });

  it('say once more that data are not sold or passed to marketing partners', () => {
    expect(terms).toMatch(/neprodáváme ani nepředáváme/);
  });
});
