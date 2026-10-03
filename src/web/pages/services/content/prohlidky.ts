/* Sportovní lékařské prohlídky — wording of the live page
   https://sportmedical-diagnostics.cz/pages/sportovni-lekarske-prohlidky (and, for preparation,
   duration and validity, the FAQ of /pages/contact). Copied as published; Slovak words and
   obvious typos corrected. No amount: the prices come from the price list. */

import type { CardDef, LineLibrary } from './cards';

export const PROHLIDKY_HERO = {
  eyebrow: 'Služby',
  title: 'Sportovní lékařské prohlídky',
  lead:
    'Provádíme sportovně-lékařská vyšetření zaměřená na posouzení zdravotního stavu, s důrazem na funkci kardiopulmonálního aparátu, toleranci fyzické zátěže a bezpečnost sportovní činnosti. Vyšetření probíhají pod odborným dohledem specializovaných lékařů a s využitím nejmodernějších diagnostických přístrojů. Rozsah vyšetření je vždy přizpůsoben věku, sportovní úrovni a účelu prohlídky – od základní preventivní kontroly až po komplexní zátěžová vyšetření s detailním hodnocením reakce organismu na zátěž. Výstupem je odborný lékařský posudek.',
  photoCaption: 'prohlídka u lékaře',
} as const;

/* ── The three examinations ── */

export const EXAMS_INTRO = {
  title: 'Komplexní vyšetření zaměřené na reakci těla při fyzické zátěži',
  lead:
    'Sportovní lékařské prohlídky nejsou určeny pouze výkonnostním a rekreačním sportovcům nebo uchazečům o sportovní školy a gymnázia, ale komukoliv, kdo chce mít jistotu, že je jeho tělo připraveno na sportovní aktivitu bezpečně a bez zdravotních rizik. Nabízíme více variant prohlídek s různým rozsahem, které si klient může zvolit podle svých potřeb nebo dle požadavků sportovního klubu, školy či svazu. S výběrem vhodného typu rádi pomůžeme – ať už jde o základní posouzení zdravotní způsobilosti, nebo o komplexní zátěžové testy včetně spiroergometrie. Cílem vyšetření je spolehlivě zhodnotit zdravotní stav a odhalit případná rizika, která se mohou projevit až při fyzické zátěži. Vyšetření proto doporučujeme nejen sportovcům, ale všem, kteří ke sportu přistupují zodpovědně a chtějí znát reakci svého srdce a organismu při zátěži.',
} as const;

export interface ExamDef {
  title: string;
  text: string;
  bullets: readonly string[];
  /** The full description (the second text the live page has per examination). */
  more: string;
  /** Matches the examination's price-list row by name. */
  pattern: RegExp;
  photoCaption: string;
}

export const EXAMS: readonly ExamDef[] = [
  {
    title: 'Základní sportovní prohlídka',
    text: 'Klidové EKG + základní vyšetření plic. Bez zátěžového testování a bez spiroergometrie. Vhodné zejména pro malé děti.',
    bullets: [
      'Klidové 12svodové EKG a měření krevního tlaku',
      'Komplexní tělesná analýza na InBody 770',
      'Antropometrické měření',
      'Fyzikální vyšetření',
      'Bez zátěžového EKG testu',
      'Bez detailní analýzy respiračních plynů (spiroergometrie)',
    ],
    more:
      'Sportovně-lékařské vyšetření zahrnující klidové EKG a základní funkční vyšetření plic. Vyšetření slouží k základnímu posouzení zdravotní způsobilosti ke sportu a bezpečnosti sportovní aktivity, prováděné bez zátěžového EKG testu a bez provádění detailní analýzy respiračních plynů (spiroergometrie). Vhodné zejména pro malé děti při zahájení sportovní činnosti nebo v rámci nejzákladnějšího preventivního posouzení zdravotní způsobilosti. Součástí vyšetření je antropometrické měření a detailní analýza tělesného složení pomocí přístroje InBody 770.',
    pattern: /^zakladni sportovni prohlidka/,
    photoCaption: 'základní sportovní prohlídka',
  },
  {
    title: 'Komplexní sportovní prohlídka',
    text: 'Klidové + zátěžové EKG + základní vyšetření plic. Hodnocení reakce srdce na zátěž bez analýzy respiračních plynů. Vhodné pro širokou veřejnost i výkonnostní sportovce.',
    bullets: [
      'Klidové i zátěžové EKG',
      'Kontinuální záznam EKG během zátěže',
      'Monitorace krevního tlaku každé dvě minuty',
      'Funkční zátěžový test na ergometru',
      'Hodnocení kardiovaskulární odpovědi organismu',
      'InBody 770 analýza',
      'Bez detailní analýzy respiračních plynů (spiroergometrie)',
    ],
    more:
      'Sportovně-lékařské vyšetření zahrnující klidové i zátěžové EKG a základní funkční vyšetření plic. Vyšetření umožňuje posoudit kardiovaskulární odpověď organismu na fyzickou zátěž, včetně hodnocení srdečního rytmu a elektrické aktivity srdce v klidu i při zátěži a posouzení bezpečnosti sportovní aktivity, bez provádění detailní analýzy respiračních plynů (spiroergometrie). Vhodné pro širokou veřejnost, rekreační a amatérské sportovce, výkonnostní i vrcholové sportovce. Součástí vyšetření je antropometrické měření a detailní analýza tělesného složení pomocí přístroje InBody 770.',
    pattern: /^komplexni sportovni prohlidka/,
    photoCaption: 'komplexní sportovní prohlídka',
  },
  {
    title: 'Spiroergometrické vyšetření',
    text: 'Nejkomplexnější zátěžové vyšetření. Detailní analýza kardiopulmonální a metabolické odezvy (srdce, plíce, metabolismus), VO₂max, ventilační a metabolické prahy a tréninkové zóny. Vhodné pro vrcholové a náročné sportovce.',
    bullets: [
      'Klidové i zátěžové EKG',
      'Funkční vyšetření plic',
      'Detailní analýza respiračních plynů (spiroergometrie)',
      'Měření VO₂max',
      'Stanovení ventilačních a metabolických prahů',
      'Určení tréninkových zón',
      'Antropometrické měření',
      'InBody 770 analýza',
    ],
    more:
      'Nejkomplexnější forma sportovně-lékařského vyšetření zahrnující klidové i zátěžové EKG, funkční vyšetření plic a detailní analýzu respiračních plynů (spiroergometrie). Vyšetření slouží ke komplexnímu a detailnímu posouzení funkce kardiopulmonálního aparátu a metabolické odezvy organismu na fyzickou zátěž, ke stanovení tréninkových zón, ventilačních a metabolických prahů, maximální spotřeby kyslíku (VO₂max) a k objektivnímu zhodnocení celkové úrovně aerobní trénovanosti a limitujících faktorů výkonu. Vhodné pro vrcholové a výkonnostní sportovce a pro náročné sportovce, kteří vyžadují maximálně detailní informace pro řízení tréninku a optimalizaci výkonu. Součástí vyšetření je antropometrické měření a detailní analýza tělesného složení pomocí přístroje InBody 770.',
    pattern: /^spiroergometricke vysetreni/,
    photoCaption: 'spiroergometrie na ergometru',
  },
];

/* ── "Nevíte, jaký typ vyšetření zvolit?" — the comparison table ── */

export const CMP = {
  title: 'Nevíte, jaký typ vyšetření zvolit?',
  lead:
    'Rádi vám poradíme s výběrem nejvhodnějšího vyšetření. Tato přehledná tabulka slouží k jasné a srozumitelné orientaci v jednotlivých typech sportovně-lékařských vyšetření. Umožňuje porovnat jejich rozsah, způsob hodnocení a úroveň detailu tak, aby si každý sportovec mohl zvolit variantu odpovídající jeho individuálním potřebám i požadavkům sportovního klubu, svazu, školy nebo účelu, pro který je vyšetření vyžadováno.',
  caption: 'Porovnání sportovních lékařských prohlídek',
  yes: 'Ano',
  no: 'Ne',
  priceLabel: 'Cena',
  /** Column heads: the corner, then the three examinations. */
  heads: [
    'Typ vyšetření',
    'Základní preventivní lékařské vyšetření v klidových podmínkách',
    'Komplexní lékařské vyšetření se zátěžovým testem a detailním kardiovaskulárním hodnocením',
    'Nejdetailnější zátěžové vyšetření s analýzou dýchacích plynů a přesným určením výkonových limitů',
  ],
} as const;

/** A cell: true = "Ano", false = "Ne", a string = its own text. */
export type CmpCell = boolean | string;

export const CMP_ROWS: readonly { label: string; cells: readonly [CmpCell, CmpCell, CmpCell] }[] = [
  {
    label: 'Vhodné pro',
    cells: [
      'Děti a sportovce, kteří potřebují pouze základní zdravotní posouzení',
      'Rekreační i výkonnostní sportovce požadující komplexní a podrobnější vyšetření včetně zátěžového testu',
      'Výkonnostní sportovce požadující přesné stanovení tréninkových zón, VO₂max a metabolického profilu na základě zátěžového testu.',
    ],
  },
  { label: 'Antropometrická měření', cells: [true, true, true] },
  { label: 'Segmentální analýza tělesného složení', cells: [true, true, true] },
  { label: 'Základní funkční vyšetření plic (spirometrie)', cells: [true, true, true] },
  { label: 'Klidové měření tlaku a EKG', cells: [true, true, true] },
  { label: 'Ergometr zátěžových testů', cells: ['—', 'kolo / běžecký pás', true] },
  { label: 'Zátěžové EKG a měření tlaku každé 2 minuty', cells: [false, true, true] },
  { label: 'Metabolická analýza plynů (VO₂, VCO₂, ventilace)', cells: [false, false, true] },
  { label: 'Stanovení aerobního a anaerobního prahu', cells: [false, false, true] },
  { label: 'Určení individuálních tréninkových zón', cells: [false, false, true] },
  { label: 'Celková zátěž na pacienta', cells: ['Nízká', 'vyšší až vysoká', 'Vysoká'] },
  { label: 'Délka vyšetření', cells: ['30–40 min', '50–60 min', '60–90 min'] },
];

/* ── Required documents ── */

export const DOCS_INTRO = { title: 'Potřebné dokumenty ke sportovní lékařské prohlídce' } as const;

export const DOCS: readonly { title: string; paras: readonly string[] }[] = [
  {
    title: '1. Výpis ze zdravotní dokumentace',
    paras: [
      'První návštěva: Pokud přicházíte na sportovní lékařskou prohlídku poprvé, je nezbytné předložit aktuální výpis ze zdravotní dokumentace od vašeho praktického lékaře nebo pediatra. ! Bez tohoto výpisu nelze vystavit posudek o zdravotní způsobilosti ke sportu !',
      'Opakovaná návštěva: Při opakovaném vyšetření, pokud se váš zdravotní stav od poslední prohlídky nezměnil, postačí, aby tuto skutečnost praktický lékař výslovně potvrdil v novém výpisu. Není nutné opakovaně dokládat celou zdravotní historii.',
      'Tento požadavek vychází z vyhlášky č. 391/2013 Sb., která stanovuje, že zdravotní způsobilost se posuzuje nejen na základě aktuálního vyšetření, ale i s přihlédnutím k údajům ze zdravotnické dokumentace.',
      'Výpis je vyžadován u všech žadatelů, včetně dětí a mládeže.',
    ],
  },
  {
    title: '2. Zdravotní dotazník',
    paras: [
      'Pro zajištění hladkého průběhu vyšetření vás prosíme o vyplnění zdravotního dotazníku předem. Dotazník slouží ke zjištění základních informací o vašem zdravotním stavu a pomáhá nám přizpůsobit vyšetření vašim aktuálním potřebám. Formulář je třeba vyplnit před každým vyšetřením, abychom měli vždy k dispozici aktuální informace o vašem zdravotním stavu. Vyplněný dokument si prosím přineste s sebou – Zajistíte tak plynulejší a efektivnější průběh vyšetření.',
    ],
  },
  {
    title: '3. Souhlas pacienta (GDPR)',
    paras: [
      'Pro hladký a bezproblémový průběh vyšetření vás prosíme o vyplnění souhlasu se zpracováním osobních údajů ještě před vaší první návštěvou. Tento dokument je nezbytný pro vedení zdravotnické dokumentace a zpracování vašich údajů v souladu s platnými právními předpisy. Souhlas je potřeba vyplnit pouze při první návštěvě. V případě dalších vyšetření již není nutné jej znovu vyplňovat, pokud nedojde ke změně údajů nebo účelu zpracování. Vyplněný dokument si prosím přineste s sebou – Zajistíte tak plynulejší a efektivnější průběh vyšetření.',
    ],
  },
  {
    title: '4. Souhlas zákonného zástupce',
    paras: [
      'Pokud je klient mladší 18 let a přichází na vyšetření bez doprovodu zákonného zástupce, je nutné předložit písemný souhlas s provedením zátěžového vyšetření. Tento dokument slouží jako informovaný souhlas s vyšetřením a potvrzuje, že rodič či jiný zákonný zástupce byl seznámen s jeho povahou a souhlasí s jeho provedením. Souhlas je vyžadován v souladu s platnou legislativou a je nezbytný pro provedení vyšetření u nezletilých osob. Vyplněný dokument si prosím přineste s sebou – Zajistíte tak plynulejší a efektivnější průběh vyšetření.',
    ],
  },
];

export const INSTRUCTIONS = {
  title: 'Důležité informace před vyšetřením',
  subtitle: 'Sportovní lékařské prohlídky – doporučení pro přípravu a hladký průběh',
  text:
    'Tento dokument slouží jako praktický průvodce pro klienty absolvující některou z námi poskytovaných sportovních lékařských prohlídek. Obsahuje důležité informace k průběhu vyšetření, včetně zátěžového vyšetření, doporučení k přípravě a přehled potřebných dokumentů. Seznámení s těmito pokyny přispívá k plynulému a bezpečnému průběhu sportovní lékařské prohlídky a umožňuje její odborné provedení v plném rozsahu.',
} as const;

/* ── Preparation, duration, contraindications, validity (the FAQ of the live Kontakt page) ── */

export const PREP = {
  title: 'Příprava na zátěžový test: co je důležité vědět a mít sebou?',
  before: {
    title: 'Co je důležité vědět před testem',
    paras: [
      'Dostavte se ideálně 10–15 minut před plánovaným začátkem vyšetření. Nepřicházejte zcela nalačno, avšak vyhněte se těžkým jídlům alespoň dvě hodiny před testem. Ideální je lehká snídaně nebo svačina, například ovoce, jogurt či ovesné vločky.',
      'Nepijte kávu, silný čaj ani energetické nápoje, jelikož mohou ovlivnit srdeční frekvenci. Vyhněte se intenzivní fyzické zátěži alespoň 24 hodin před testem. Pokud se necítíte dobře, kontaktujte nás s dostatečným předstihem.',
    ],
  },
  bring: {
    title: 'Co je potřeba mít s sebou',
    items: [
      'Výpis ze zdravotní dokumentace (vystaví praktický lékař)',
      'Vyplněný zdravotní dotazník (doporučujeme vytisknout předem)',
      'Formulář souhlasu se zpracováním osobních údajů (GDPR)',
      'Sportovní oblečení a obuv (čisté, funkční, pevná obuv s čistou podrážkou)',
      'Ručník a toaletní potřeby (pokud plánujete využít sprchu)',
    ],
  },
  closing: {
    title: 'Závěrečné doporučení',
    paras: ['Důkladná příprava má přímý vliv na přesnost měření. Dbejte na uvedené pokyny a v případě nejasností nás kontaktujte předem.'],
  },
} as const;

export const DURATION = {
  title: 'Jak dlouho trvá celé vyšetření?',
  ergo: {
    title: 'Ergometrické vyšetření',
    paras: [
      'Celé vyšetření trvá přibližně 45–50 minut. Příprava zahrnuje registraci, vyplnění dokumentů (5–10 minut), zátěžová fáze probíhá na ergometru či běžeckém pásu (cca 20 minut) a závěrečná část obsahuje lékařskou interpretaci výsledků (cca 20 minut).',
    ],
  },
  spiro: {
    title: 'Spiroergometrické vyšetření',
    paras: [
      'Trvá přibližně 65–70 minut. Úvodní část zahrnuje přípravu přístrojů a nasazení dýchací masky (10 minut), zátěžová fáze trvá 25–30 minut a závěrečné hodnocení s analýzou parametrů trvá 25–30 minut.',
      'Obě vyšetření probíhají pod odborným lékařským dohledem a jsou zcela bezpečná.',
    ],
  },
} as const;

export const WHEN_NOT = {
  title: 'V jakých případech není možné absolvovat zátěžový test?',
  items: [
    'Akutní onemocnění (horečka, infekce)',
    'Krátká doba od dobrání antibiotik nebo kortikoidů (alespoň 7 dní)',
    'Probíhající péče bez ukončené terapie',
    'Nepotvrzená způsobilost ke sportovní činnosti',
    'Nestabilní srdeční onemocnění',
    'Nekompenzované respirační obtíže',
    'Závažné metabolické poruchy',
    'Neurologické stavy vylučující bezpečnou zátěž',
  ],
  paras: ['V těchto případech je test odložen. Doporučujeme konzultaci s ošetřujícím lékařem nebo s odborným týmem.'],
  legalTitle: 'Právní rámec',
  legal: [
    'Lékař vychází ze zákona č. 373/2011 Sb., vyhlášky č. 391/2013 Sb. o zdravotní způsobilosti ke sportu a zákona č. 372/2011 Sb. o zdravotních službách. Bezpečnost klienta je absolutní prioritou.',
  ],
} as const;

export const VALIDITY = {
  title: 'Jak dlouho jsou zdravotní prohlídky platné?',
  paras: [
    'Lékařský posudek o zdravotní způsobilosti ke sportu je platný nejdéle 12 měsíců od data vystavení. Lékař však může určit kratší dobu, pokud to vyžaduje zdravotní stav.',
    'U sportů s vyšším rizikem mohou příslušné organizace vyžadovat zkrácené intervaly kontrol. Platnost se neprodlužuje automaticky – po uplynutí doby je nutné absolvovat nové vyšetření.',
    'Podle § 4 odst. 3 vyhlášky č. 391/2013 Sb. platí, že „platnost lékařského posudku je nejdéle 1 rok“.',
  ],
} as const;

/* ── Packages ── */

export const PACKAGES = {
  title: 'Zvýhodněné balíčky',
  paras: [
    'Balíčky kombinují sportovně-lékařská vyšetření s nejmodernější detailní sportovní diagnostikou a umožňují komplexní posouzení zdravotního stavu, reakce organismu na zátěž, výkonnostních parametrů, funkčních dysbalancí a asymetrií, včetně jejich možného vlivu na výkon či riziko přetížení. Výsledkem je ucelený pohled na fungování organismu v klidu i při zátěži.',
    'Komplexní balíčky jsou koncipovány jako dvoufázový proces, který zajišťuje nejen samotné provedení vyšetření, ale i jejich srozumitelné vyhodnocení a praktickou interpretaci.',
    '1. část – diagnostická: Samotné provedení sportovně-lékařských vyšetření a pokročilé sportovní diagnostiky v rozsahu dle zvoleného balíčku, včetně všech potřebných měření a testů.',
    '2. část – vyhodnocení výsledků: Samostatný termín věnovaný detailnímu vyhodnocení a interpretaci výsledků, jejich vzájemných souvislostí a praktickému vysvětlení závěrů.',
    'Balíčky jsou sestaveny tak, aby nabízely komplexní rozsah vyšetření za cenově výhodnějších podmínek oproti jednotlivě objednávaným službám.',
  ],
} as const;

/* ── Mobile tests for clubs ── */

export const MOBILE = {
  eyebrow: 'NABÍDKA POUZE PRO KLUBY',
  title: 'Mobilní zátěžové testy pro sportovní kluby',
  paras: [
    'Nabízíme možnost realizace sportovně-lékařských prohlídek přímo ve Vašem klubu. Díky mobilnímu diagnostickému vybavení provádíme vyšetření přímo v klubovém prostředí, na které jsou sportovci zvyklí, bez nutnosti cestování. Tento model šetří čas klubu, sportovcům i rodičům, kteří tak nemusí přizpůsobovat svůj pracovní program, celkovou organizaci ani řešit nedostatek volných termínů u sportovního lékaře ve Vašem okolí. Vyšetření jsme schopni zajistit i v rámci Středočeského kraje.',
  ],
  link: 'Nabídka pro kluby',
  photoCaption: 'mobilní testování v klubu',
} as const;

export const EQUIPMENT_TEASER = {
  title: 'Nejmodernější diagnostické vybavení',
  link: 'Přístroje, na kterých vyšetřujeme',
} as const;

/* ── Price list of the examinations (✔ / ✘ cards) ── */

export const PRICE_SECTION = {
  title: 'Ceník služeb – sportovní lékařské prohlídky',
  paras: [
    'Nabízíme široké spektrum sportovně lékařských vyšetření, která si můžete zvolit podle svých individuálních potřeb, míry sportovní zátěže i požadovaného rozsahu vyšetření. Jednotlivé typy vyšetření jsou navrženy tak, aby pokrývaly jak základní preventivní kontrolu, tak i komplexní posouzení zdravotního stavu a sportovní připravenosti, včetně vyšetření vyžadovaných sportovními kluby, svazy, školami či jinými organizacemi pro vydání posudku o zdravotní způsobilosti.',
    'Součástí nabídky jsou rovněž cenově zvýhodněné balíčky vyšetření, které propojují sportovně-lékařská vyšetření s vybranými prvky sportovní diagnostiky. Díky této kombinaci je možné získat širší a detailnější pohled na funkční stav organismu, pohybové schopnosti, zatížení pohybového aparátu i individuální rizikové faktory. Balíčky tak umožňují komplexní funkční screening, který propojuje zdravotní hledisko s výkonnostními parametry a poskytuje ucelené podklady pro další trénink, prevenci přetížení i dlouhodobou péči o sportovce.',
    'Všechny typy vyšetření provádíme důrazem na odbornost, přesnost a individuální přístup. Vyberte si konkrétní typ vyšetření nebo balíček, který nejlépe odpovídá vašim aktuálním požadavkům.',
  ],
  more: 'Další varianty',
} as const;

export const EXAM_LINE_PREFIX = 'prohlidky.line';
export const EXAM_CARD_PREFIX = 'prohlidky.card';

export const EXAM_LINES: LineLibrary = {
  anamnesis: { name: 'Komplexní zdravotní a sportovní anamnéza' },
  inbody: { name: 'Tělesná analýza InBody 770 a antropometrické měření' },
  rest: { name: 'Klidové měření: klidové EKG a krevní tlak' },
  doctor: { name: 'Komplexní vyšetření tělovýchovným lékařem' },
  stress: { name: 'Zátěžové měření: zátěžové EKG a krevní tlaky' },
  gas: { name: 'Ventilace plic a výměny plynů (VO₂ a VCO₂)' },
  vo2max: { name: 'Maximální spotřeba kyslíku (VO₂max)' },
  thresholds: { name: 'Ventilační a metabolické prahy (aerobní a anaerobní)' },
  rq: { name: 'Respirační kvocient (RQ)' },
  o2hr: { name: 'O₂/HR – kyslíkový puls' },
};

export const EXAM_CARDS: readonly CardDef[] = [
  {
    id: 'zp',
    title: 'Základní sportovní prohlídka',
    match: { single: /^zakladni sportovni prohlidka/ },
    inc: ['anamnesis', 'inbody', 'rest', 'doctor'],
    exc: ['stress', 'gas', 'vo2max', 'thresholds', 'rq', 'o2hr'],
  },
  {
    id: 'kp',
    title: 'Komplexní sportovní prohlídka',
    badge: true,
    match: { single: /^komplexni sportovni prohlidka/ },
    inc: ['anamnesis', 'inbody', 'rest', 'stress', 'doctor'],
    exc: ['gas', 'vo2max', 'thresholds', 'rq', 'o2hr'],
  },
  {
    id: 'sp',
    title: 'Spiroergometrické vyšetření',
    badge: true,
    match: { single: /^spiroergometricke vysetreni/ },
    inc: ['anamnesis', 'inbody', 'rest', 'stress', 'gas', 'vo2max', 'thresholds', 'rq', 'o2hr', 'doctor'],
    exc: [],
  },
];

/** Which price-list rows the page has already drawn (so "Další varianty" lists only the rest). */
export const SHOWN_EXAM_PATTERNS = EXAMS.map((exam) => exam.pattern);

