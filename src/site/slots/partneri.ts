import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/*
 * Slots of the page /partneri. The cards themselves (name, sport, description, link, logo) are the
 * partner list of "Média a texty" (GET /api/public/site-content); until the admin enters a partner the
 * nine clubs of the live home page (src/site/defaults.ts) are shown. These are the sentences around them,
 * with the live home page's wording.
 */

const HERO = 'Partnerské kluby › Úvod';
const JOIN = 'Partnerské kluby › Staňte se partnerem';

export const partneriSlots: SlotDef[] = [
  textSlot('partneri.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Naši partneři'),
  textSlot('partneri.hero.title', 'Úvod — titulek stránky', HERO, 'Partnerské kluby'),
  textSlot('partneri.hero.lead', 'Úvod — úvodní odstavec', HERO, 'Pomáháme klubům zlepšovat péči o sportovce.', { multiline: true }),
  textSlot('partneri.list.title', 'Seznam — titulek sekce', HERO, 'Kluby, se kterými spolupracujeme'),
  textSlot('partneri.card.cta', 'Karta partnera — odkaz na web klubu', HERO, 'Oficiální web klubu'),

  textSlot('partneri.join.title', 'Staňte se partnerem — titulek', JOIN, 'Staňte se i Vy našimi spokojenými partnery'),
  textSlot('partneri.join.1', 'Staňte se partnerem — řádek 1', JOIN, 'Pomáháme klubům zlepšovat péči o sportovce'),
  textSlot('partneri.join.2', 'Staňte se partnerem — řádek 2', JOIN, 'Zajistíme kompletní zdravotní servis pro Vaše sportovce'),
  textSlot('partneri.join.3', 'Staňte se partnerem — řádek 3', JOIN, 'Dlouhodobá spolupráce na kterou se můžete spolehnout'),
  textSlot('partneri.join.cta', 'Staňte se partnerem — tlačítko (vede na Kontakt)', JOIN, 'Kontaktujte nás'),
  textSlot('partneri.join.clubs', 'Staňte se partnerem — druhé tlačítko (vede na Kluby)', JOIN, 'Nabídka pro sportovní kluby'),
];
