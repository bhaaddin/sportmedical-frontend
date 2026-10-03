/* ══════════════════════════════════════════════════════════════
   WHAT THE PUBLIC SITE SHOWS WHEN THE API HAS NOTHING

   The API (GET /api/public/site-content) is the owner of partners and FAQ; this
   file is only the fallback, so a page renders — prerendered or in the browser —
   even when the server is asleep or has never been given any. The FAQ is the
   one in src/pages/public/content.ts (shared with the booking page).
   Prices are NEVER here.
   ══════════════════════════════════════════════════════════════ */

import { FAQ as CONTENT_FAQ } from '../pages/public/content';
import type { SiteContent, SiteFaq, SitePartner } from '../api/siteContent';

const partner = (sort: number, name: string, sport: string): SitePartner => ({
  id: `default-${sort}`,
  name,
  sport,
  description: '',
  url: '',
  sort,
});

/** The ten clubs the clinic lists on its website; the sport is what the artboard shows above the name. */
export const DEFAULT_PARTNERS: SitePartner[] = [
  partner(1, 'Black Angels', 'Florbal'),
  partner(2, 'Basket Újezd nad Lesy', 'Basketbal'),
  partner(3, 'FK Dukla Jižní Město', 'Fotbal'),
  partner(4, 'SK Joudrs', 'Softball'),
  partner(5, 'Beach klub Ládví', 'Beach volejbal'),
  partner(6, 'Strong Girls', 'Rugby'),
  partner(7, 'VK Blesk', 'Veslování'),
  partner(8, 'SGB Multisport Academy', 'Rugby'),
  partner(9, 'Fall and Get Up / Sportovní klinika', ''),
  partner(10, 'Zdravotní agentura', ''),
];

export const DEFAULT_FAQ: SiteFaq[] = CONTENT_FAQ.map((item, index) => ({
  id: `default-${index + 1}`,
  question: item.q,
  answer: item.a,
  sort: index + 1,
}));

/** Contact details shown when the clinic's own settings have none (the public clinic answer wins). */
export const DEFAULT_CONTACT = {
  phone: '+420 606 785 271',
  email: 'recepce@sportmedical-diagnostics.cz',
} as const;

export const DEFAULT_SITE_CONTENT: SiteContent = {
  version: 'defaults',
  slots: {},
  partners: DEFAULT_PARTNERS,
  faq: DEFAULT_FAQ,
};
