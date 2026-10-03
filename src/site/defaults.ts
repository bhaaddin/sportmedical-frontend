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

const partner = (sort: number, name: string, sport: string, description: string, url: string): SitePartner => ({
  id: `default-${sort}`,
  name,
  sport,
  description,
  url,
  sort,
});

/**
 * The nine partner cards of the clinic's live home page (captured 2026-10-03), in the page's order, with
 * the live descriptions and links. Shown until the admin enters a partner of their own (then the admin's
 * list replaces this one). Logos are text until the admin uploads files. The live "Sportovní agentura"
 * card names two web addresses; the list has room for one.
 */
export const DEFAULT_PARTNERS: SitePartner[] = [
  partner(
    1, 'Sportovní agentura', '',
    'Nabízíme: organizaci zdravotní péče u specialistů, sportovní prohlídky, výkonnostní diagnostiku, rehabilitaci a fyzioterapii, prevenci zranění, péči o sportovní kluby a jejich hráče. Rychle. Kvalitně. Odpovědně.',
    'http://www.fallandgetup.com/',
  ),
  partner(
    2, 'Black Angels', 'Florbal',
    'Ambiciózní florbalový klub s dlouhodobě úspěšným systémem práce s mládeží, který vychoval vlastní generaci hráčů až do nejvyšší české soutěže. Staví na moderním tréninkovém přístupu, kvalitních trenérech a rozvoji nejen sportovní výkonnosti, ale i charakteru, odolnosti a týmových hodnot.',
    'https://www.blackangels.cz/',
  ),
  partner(3, 'Basket Újezd nad Lesy', 'Basketbal', 'Dynamicky rostoucí klub, který buduje silnou komunitu a podporuje rozvoj mladých sportovců.', 'https://basketujezd.cz/'),
  partner(4, 'FK Dukla Jižní Město', 'Fotbal', 'Všechny mužské kategorie od školičky až po A tým', 'https://www.fkduklajm.cz/'),
  partner(5, 'SK Joudrs', 'Softball', 'Všechny věkové kategorie mužů i žen od T-ball až po dospělé týmy.', 'https://www.joudrs.cz/'),
  partner(6, 'Beach klub Ládví', 'Beach volejbal', 'Největší mládežnický oddíl s největším beachvolejbalovým areálem v Praze.', 'https://beachklubladvi.cz/'),
  partner(7, 'Strong Girls', 'Rugby', 'dorostenský a ženský klub', 'https://stronggirls.cz/'),
  partner(8, 'SGB Multisport Academy', 'Rugby', 'dětská akademie', ''),
  partner(9, 'VK Blesk', 'Veslování', 'Vítěz českého poháru v roce 2025, 2024, 2023, 2022, 2021 a 2020', 'https://www.vkblesk.cz/'),
];

export const DEFAULT_FAQ: SiteFaq[] = CONTENT_FAQ.map((item, index) => ({
  id: `default-${index + 1}`,
  question: item.q,
  answer: item.a,
  sort: index + 1,
}));

export const DEFAULT_SITE_CONTENT: SiteContent = {
  version: 'defaults',
  slots: {},
  partners: DEFAULT_PARTNERS,
  faq: DEFAULT_FAQ,
};
