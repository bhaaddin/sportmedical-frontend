import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';
import { cardSlots, gallerySlots, heroSlots } from '../../web/pages/services/slotFactory';

/*
 * Sportovní diagnostika (/web/diagnostika). Defaults: the artboard V-Diagnostika for the headings
 * and captions, the clinic's website for what each device and package measures and delivers.
 * Prices are NOT here: they come from the price list, matched by name.
 */

const HERO = 'Diagnostika › Hero';
const MAIN = 'Diagnostika › Hlavní vyšetření';
const PKG = 'Diagnostika › Balíčky';
const GET = 'Diagnostika › Co dostanete';

export const diagnostikaSlots: SlotDef[] = [
  ...heroSlots('diagnostika', HERO, {
    eyebrow: 'Sportovní diagnostika',
    title: 'Čísla, podle kterých se dá trénovat',
    lead: 'Výkon, reakce na zátěž, asymetrie a dysbalance. ForceDecks, HumanTrak a spiroergometrie v jednom balíčku, nebo samostatně.',
    photoCaption: 'ForceDecks měření',
  }),

  textSlot('diagnostika.main.title', 'Hlavní vyšetření — titulek sekce', MAIN, 'Hlavní vyšetření'),
  textSlot('diagnostika.main.inpackage', 'Hlavní vyšetření — místo ceny u přístrojů, které se objednávají v balíčku', MAIN, 'v balíčku'),
  ...cardSlots('diagnostika.main', MAIN, 'Vyšetření', [
    { title: 'VO₂max analýza', text: 'Maximální spotřeba kyslíku, ventilační a metabolické prahy a individuální tréninkové zóny. Základ pro plánování tréninku.' },
    { title: 'ForceDecks', text: 'Silové desky. Odrazové a dopadové síly, asymetrie a reaktivita svalového systému, měřené nezávisle pro levou a pravou končetinu.' },
    { title: 'HumanTrak', text: '3D analýza pohybu. Rozsahy kloubů, kvalita provedení a kompenzační vzorce.' },
    {
      title: 'Videoinstruovaný kompenzační plán',
      text: 'Plán sestavený podle výsledků diagnostiky, s videoinstruktáží každého cviku a přesnou strukturou: série, opakování, pauzy. Platí tři měsíce, doporučujeme následné retestování.',
    },
  ]),

  textSlot('diagnostika.pkg.title', 'Balíčky — titulek sekce', PKG, 'Balíčky'),
  textSlot('diagnostika.pkg.lead', 'Balíčky — úvod', PKG, 'Komplexní diagnostika zahrnuje základní měření InBody 770 bez příplatku.'),

  textSlot('diagnostika.get.title', 'Co dostanete — titulek sekce', GET, 'Co dostanete'),
  ...cardSlots('diagnostika.get', GET, 'Výstup', [
    { title: 'Základní diagnostika', text: 'Silové testy bez videoinstruktáže, měření na InBody 770 a detailně zpracovaná výstupní zpráva s hodnocením všech metrik.' },
    {
      title: 'Komplexní diagnostika',
      text: 'Přidává synchronizovanou video-biomechanickou analýzu, která pomáhá odhalit kompenzační mechanismy, technické nedostatky a nesprávné pohybové vzorce.',
    },
    { title: 'Výstupní zpráva', text: 'Kompletní přehled všech naměřených hodnot se srozumitelným odborným vysvětlením všech sledovaných metrik.' },
  ]),
  ...gallerySlots('diagnostika.get', GET, 'Galerie', ['ForceDecks', 'HumanTrak', 'výstupní protokol', 'konzultace nad výsledky']),
];
