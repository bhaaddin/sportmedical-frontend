/* ══════════════════════════════════════════════════════════════
   PUBLIC SITE — WHAT IS LEFT IN CODE

   Nothing the clinic would want to change lives here any more: its identity, address,
   contact, opening hours, documents, partner clubs and marketing copy are edited in
   Nastavení (company data, "Média a texty", price list). What remains is the product
   name the header and footer print, the link to the privacy policy, and the default
   FAQ that the admin's own list replaces.
   ══════════════════════════════════════════════════════════════ */

export interface PublicLink {
  label: string;
  href: string;
}

/**
 * What the shell prints that has no editable home yet (src/components/public/PublicFooter.tsx and
 * PublicHeader.tsx belong to the public-site agents, who should move these into slots / company
 * settings: see docs/etapa3/hardcode-audit-frontend.md). Left unchanged so the footer does not change.
 */
export const SITE = {
  brand: 'SportMedical',
  brandSuffix: 'Diagnostics',
  legalName: 'SportMedical Diagnostics s.r.o.',
  policies: [
    { label: 'Ochrana osobních údajů (GDPR)', href: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/GDPR_final.pdf?v=1780561628' },
  ] satisfies PublicLink[],
} as const;

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: 'Jak dlouho posudek platí?',
    a: 'Posudek o zdravotní způsobilosti ke sportu platí zpravidla 12 měsíců od vyšetření. Svaz nebo klub může vyžadovat kratší interval — ověřte si to u svého oddílu.',
  },
  {
    q: 'Co když se nemohu dostavit?',
    a: 'Termín zrušíte nebo přesunete sami z odkazu v potvrzení nebo z portálu — zdarma, dokud do termínu zbývá dost času podle pravidel ordinace. Později nám prosím zavolejte.',
  },
  {
    q: 'Potřebuji výpis od praktického lékaře?',
    a: 'Ano, pro sportovní lékařskou prohlídku je výpis ze zdravotní dokumentace povinný. Bez něj posudek nelze vystavit. Na diagnostiku ani InBody výpis nepotřebujete.',
  },
  {
    q: 'Jak se mám na vyšetření připravit?',
    a: 'Přijďte odpočatí, 2–3 hodiny před zátěžovým testem jen lehké jídlo, bez kávy a alkoholu. Vezměte si sportovní oblečení a obuv. Podrobnosti najdete v doporučení ke stažení výše.',
  },
  {
    q: 'Platí vyšetření pojišťovna?',
    a: 'Sportovní prohlídky a diagnostika jsou hrazené přímo. Platíte na místě kartou nebo hotově; doklad dostanete do portálu i e-mailem. Některé pojišťovny přispívají z fondu prevence — zeptejte se své pojišťovny.',
  },
  {
    q: 'Můžu objednat dítě?',
    a: 'Ano. Nezletilý sportovec přichází s rodičem, nebo přinese podepsaný souhlas zákonného zástupce (ke stažení výše).',
  },
];
