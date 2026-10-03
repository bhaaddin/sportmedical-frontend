import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';
import { cardSlots, gallerySlots, heroSlots } from '../../web/pages/services/slotFactory';

/*
 * Sportovní lékařské prohlídky (/web/prohlidky). Defaults: the artboard V-Prohlidky for the headings
 * and captions, the clinic's website for what each examination contains, for whom it is and how
 * long it takes. Prices are NOT here: they come from the price list, matched by name.
 */

const HERO = 'Prohlídky › Hero';
const CMP = 'Prohlídky › Porovnání prohlídek';
const INFO = 'Prohlídky › Důležité informace';
const FLOW = 'Prohlídky › Jak vyšetření probíhá';

const pkg = (n: 1 | 2 | 3, title: string, what: string, forWhom: string, duration: string): SlotDef[] => [
  textSlot(`prohlidky.pkg.${n}.title`, `Prohlídka ${n} — název`, CMP, title),
  textSlot(`prohlidky.pkg.${n}.what`, `Prohlídka ${n} — co je zahrnuto`, CMP, what, { multiline: true }),
  textSlot(`prohlidky.pkg.${n}.for`, `Prohlídka ${n} — pro koho`, CMP, forWhom, { multiline: true }),
  textSlot(`prohlidky.pkg.${n}.duration`, `Prohlídka ${n} — délka`, CMP, duration),
];

export const prohlidkySlots: SlotDef[] = [
  ...heroSlots('prohlidky', HERO, {
    eyebrow: 'Sportovní lékařské prohlídky',
    title: 'Potvrzení, že můžete naplno',
    lead: 'Posouzení zdravotního stavu, reakce na zátěž, asymetrií a dysbalancí. Dvoufázový proces — vyšetření a vyhodnocení s lékařem.',
    photoCaption: 'prohlídka u lékaře',
  }),

  textSlot('prohlidky.cmp.title', 'Porovnání — titulek sekce', CMP, 'Porovnání prohlídek'),
  textSlot('prohlidky.cmp.lead', 'Porovnání — úvod', CMP, 'Všechny tři zahrnují základní měření InBody 770 bez příplatku.'),
  textSlot('prohlidky.cmp.label.what', 'Porovnání — popisek „co je zahrnuto“', CMP, 'Co je zahrnuto'),
  textSlot('prohlidky.cmp.label.for', 'Porovnání — popisek „pro koho“', CMP, 'Pro koho'),
  textSlot('prohlidky.cmp.label.duration', 'Porovnání — popisek „délka“', CMP, 'Délka vyšetření'),
  ...pkg(
    1,
    'Základní sportovní prohlídka',
    'Klidové EKG a základní vyšetření plic, bez zátěžového testování a bez spiroergometrie. Součástí je rozhovor s lékařem, analýza InBody 770, antropometrické měření a fyzikální vyšetření.',
    'Zejména pro malé děti při zahájení sportovní činnosti nebo jako základní preventivní posouzení zdravotní způsobilosti.',
    '30–40 minut',
  ),
  ...pkg(
    2,
    'Komplexní sportovní prohlídka',
    'Klidové i zátěžové EKG a základní vyšetření plic, bez analýzy respiračních plynů. Zahrnuje vyšetření na ergometru (kolo či běžecký pás), kontinuální záznam EKG během zátěže a měření krevního tlaku každé dvě minuty.',
    'Vhodné pro širokou veřejnost i výkonnostní sportovce — rekreační, amatérské i vrcholové.',
    '50–60 minut',
  ),
  ...pkg(
    3,
    'Spiroergometrické vyšetření',
    'Nejkomplexnější forma vyšetření: klidové i zátěžové EKG, funkční vyšetření plic a detailní analýza respiračních plynů. Měří spotřebu kyslíku (VO₂), produkci oxidu uhličitého, ventilační a metabolické prahy, VO₂max a stanovuje tréninkové zóny.',
    'Vhodné pro vrcholové a náročné sportovce, kteří potřebují detailní informace pro řízení tréninku.',
    '60–90 minut',
  ),
  textSlot('prohlidky.cmp.more', 'Porovnání — titulek dalších variant z ceníku', CMP, 'Další varianty'),

  textSlot('prohlidky.info.title', 'Důležité informace — titulek sekce', INFO, 'Důležité informace před vyšetřením'),
  ...cardSlots('prohlidky.info', INFO, 'Informace', [
    {
      title: 'Výpis ze zdravotní dokumentace',
      text: 'Bez výpisu od praktického lékaře nelze vystavit posudek o zdravotní způsobilosti ke sportu. Potřebujete ho při první návštěvě a vždy, když se změnil váš zdravotní stav.',
    },
    { title: 'Vstupní dotazník', text: 'Zdravotní dotazník a registraci vyplníte online za pár minut. Nic nemusíte tisknout.' },
    { title: 'Před vyšetřením', text: 'Přijďte odpočatí, 2–3 hodiny před zátěžovým testem jen lehké jídlo, bez kávy a alkoholu.' },
    { title: 'S sebou', text: 'Sportovní oblečení a obuv. Nezletilý sportovec přichází s rodičem, nebo přinese podepsaný souhlas zákonného zástupce.' },
  ]),

  textSlot('prohlidky.flow.title', 'Jak vyšetření probíhá — titulek sekce', FLOW, 'Jak vyšetření probíhá'),
  textSlot('prohlidky.flow.lead', 'Jak vyšetření probíhá — úvod', FLOW, 'Vyšetření probíhají pod odborným dohledem specializovaných lékařů s využitím nejmodernějšího vybavení.', { multiline: true }),
  ...gallerySlots('prohlidky.flow', FLOW, 'Průběh', [
    'průběh vyšetření — příjem',
    'průběh vyšetření — měření',
    'průběh vyšetření — zátěž',
    'průběh vyšetření — vyhodnocení',
  ]),
];
