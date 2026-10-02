/* ══════════════════════════════════════════════════════════════
   PUBLIC SITE — EDITABLE COPY

   Every sentence a patient reads on /objednat that is NOT a price, a service,
   a contact or an opening hour lives here. Prices, services, the telephone,
   the e-mail and the address come from the API at runtime (the clinic edits
   them in Nastavení); this file holds the marketing copy, the document links,
   the FAQ, the club offer and the partner names — the things that were copied
   from https://sportmedical-diagnostics.cz on 3. 10. 2026 and that Matko edits
   by hand.

   Keep it plain Czech. No code here needs touching to change a sentence.
   ══════════════════════════════════════════════════════════════ */

export interface PublicLink {
  label: string;
  href: string;
}

/** The clinic's legal identity and website. Not in the API; edit here. */
export const SITE = {
  brand: 'SportMedical',
  brandSuffix: 'Diagnostics',
  website: 'https://sportmedical-diagnostics.cz',
  legalName: 'SportMedical Diagnostics s.r.o.',
  ico: '23351632',
  registeredOffice: 'Krátká 283, 252 65 Tursko',
  /**
   * Shown in the footer and the contact block when the API does not send
   * opening hours (GET /api/public/clinic has no such field yet). Once it
   * does, the API wins and this line is ignored.
   */
  hoursFallback: 'Po–Pá 8:00–18:00 · So 8:00–18:00 · Ne zavřeno',
  /** One line on how to get there; leave '' to hide the row. */
  transport: 'Metro C Kačerov · bus Lísek, Kačerov · vlak Praha-Kačerov · autem po Magistrále / Jižní spojce' as string,
  /** Links into the clinic's website, for the footer. */
  websitePages: [
    { label: 'Sportovní lékařské prohlídky', href: 'https://sportmedical-diagnostics.cz/pages/sportovni-lekarske-prohlidky' },
    { label: 'Sportovní diagnostika', href: 'https://sportmedical-diagnostics.cz/pages/sportovni-diagnostika' },
    { label: 'InBody 770', href: 'https://sportmedical-diagnostics.cz/pages/inbody' },
    { label: 'VO₂max analýza', href: 'https://sportmedical-diagnostics.cz/pages/vo2max-analyza' },
    { label: 'Ceník služeb', href: 'https://sportmedical-diagnostics.cz/pages/cenik-sluzeb' },
  ] satisfies PublicLink[],
  policies: [
    { label: 'Ochrana osobních údajů (GDPR)', href: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/GDPR_final.pdf?v=1780561628' },
  ] satisfies PublicLink[],
} as const;

/** The first screen of /objednat. */
export const HERO = {
  eyebrow: 'Praha 4 · Kačerov',
  headline: 'Sportovní lékařské prohlídky a diagnostika',
  lead: 'Posudek o zdravotní způsobilosti ke sportu, zátěžové testy a diagnostika pohybu na jednom místě. Termín si vyberete online, dotazník vyplníte z domova a na místě už jen přijdete.',
  primaryCta: 'Vybrat vyšetření',
  secondaryCta: 'Zobrazit ceník',
  trust: [
    'Pohodlná online rezervace',
    'Rychlé termíny',
    'Testování přímo v klubu',
  ],
} as const;

/** "Jak to probíhá" — three steps. */
export const HOW_IT_WORKS = [
  {
    title: 'Vyberte termín',
    text: 'Zvolte vyšetření, den a čas. Termín je váš okamžitě a potvrzení vidíte na obrazovce.',
  },
  {
    title: 'Vyplňte dotazník z domova',
    text: 'Zdravotní dotazník a registraci vyplníte online za pár minut. Nic nemusíte tisknout.',
  },
  {
    title: 'Přijďte s výpisem',
    text: 'Vezměte výpis ze zdravotní dokumentace od praktického lékaře a sportovní oblečení. Zbytek zařídíme my.',
  },
] as const;

export interface PublicDocument {
  title: string;
  /** When it is needed, in the patient's words. */
  when: string;
  url: string;
  /** Shown as a warning line under the title; empty for none. */
  note?: string;
  /** Marks a document the visit cannot happen without. */
  required?: boolean;
}

/** "Co vzít s sebou" — the PDFs from the clinic's website. */
export const DOCUMENTS: PublicDocument[] = [
  {
    title: 'Výpis ze zdravotní dokumentace',
    when: 'Při první návštěvě a vždy, když se změnil váš zdravotní stav.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/VYPIS_ze_zdravtni_dokumentace.pdf?v=1780562021',
    note: 'Bez výpisu od praktického lékaře nelze vystavit posudek o zdravotní způsobilosti ke sportu.',
    required: true,
  },
  {
    title: 'Zdravotní dotazník',
    when: 'Před každým vyšetřením — vyplníte ho online při objednání, tiskový formulář je pro jistotu.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/zdravotni_dotaznik.pdf?v=1780561779',
  },
  {
    title: 'Souhlas pacienta (GDPR)',
    when: 'Jen při první návštěvě.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/GDPR_final.pdf?v=1780561628',
  },
  {
    title: 'Souhlas zákonného zástupce',
    when: 'Pro nezletilé, kteří přijdou bez rodiče.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/Souhlas_zakonneho_zastupce_3ff9ec9a-fe46-4e0f-8fd0-2fae5adce636.pdf?v=1780561681',
  },
];

/** "Doporučení před vyšetřením" — informational PDFs. */
export const GUIDES: PublicDocument[] = [
  {
    title: 'Sportovní lékařské prohlídky – doporučení',
    when: 'Co jíst, co si vzít a jak se připravit na zátěžový test.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/Informace_pro_pacienta_-_SPORTOVNI_LEKARSKE_PROHLIDKY_8d9a3bc7-2396-403c-8d63-8368a8ef6d29.pdf?v=1780564931',
  },
  {
    title: 'Sportovní diagnostika – doporučení',
    when: 'Jak se připravit na měření na silových platformách.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/Informace_pro_pacienta_Sportovni_diagnostika.pdf?v=1769076502',
  },
  {
    title: 'InBody měření – doporučení',
    when: 'Co dodržet, aby měření tělesného složení bylo přesné.',
    url: 'https://cdn.shopify.com/s/files/1/0913/0799/9614/files/Informace_pro_pacienta_InBody_971717d8-51ee-4e1f-8011-cb13018d3178.pdf?v=1780564468',
  },
];

/** The club / team offer. */
export const CLUB = {
  eyebrow: 'Pro kluby a týmy',
  title: 'Otestujeme celý tým — u nás, nebo přímo u vás v klubu',
  text: 'Mobilní testování po celé České republice: přijedeme za vámi s přístroji i lékařem. Výjezd od 30 sportovců, zvýhodněná cenová nabídka a individuální podmínky, flexibilní termíny včetně víkendů.',
  bullets: [
    'Prohlídky i diagnostika v jednom dni',
    'Hromadná rezervace s odkazem pro každého sportovce',
    'Množstevní sleva podle velikosti skupiny',
  ],
  cta: 'Poptat testování pro klub',
  /** Subject line of the e-mail the button opens. */
  mailSubject: 'Poptávka — testování pro klub',
} as const;

/** Clubs the clinic works with, as the website lists them. */
export const PARTNERS: string[] = [
  'SGB Multisport Academy',
  'VK Blesk',
  'Fall and Get Up / Sportovní klinika',
  'Black Angels',
  'Basket Újezd nad Lesy',
  'FK Dukla Jižní Město',
  'SK Joudrs',
  'Beach klub Ládví',
  'Strong Girls',
  'Zdravotní agentura',
];

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
