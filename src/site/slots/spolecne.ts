import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Header and footer — shared by every public page. Contact data comes from the clinic's own
   settings (GET /api/public/clinic); these texts are what is shown when it has none. */

const FOOT = 'Společné › Zápatí';

export const spolecneSlots: SlotDef[] = [
  textSlot('site.footer.address', 'Zápatí — adresa (když ji klinika nemá v nastavení)', FOOT, 'Budova GreenLine, 5. patro\nJihlavská 1558/21\n140 00 Praha 4 — Michle', { multiline: true }),
  textSlot('site.footer.phone', 'Zápatí — telefon (když ho klinika nemá v nastavení)', FOOT, '+420 606 785 271'),
  textSlot('site.footer.email', 'Zápatí — e-mail (když ho klinika nemá v nastavení)', FOOT, 'recepce@sportmedical-diagnostics.cz'),
  textSlot('site.footer.hours', 'Zápatí — provozní doba (když ji klinika nemá v nastavení)', FOOT, 'Po–Pá 8:00–18:00\nSo 8:00–18:00\nNe zavřeno\nprovoz podle objednání', { multiline: true }),
  textSlot('site.footer.legal', 'Zápatí — řádek se společností', FOOT, 'SportMedical Diagnostics s.r.o. · IČO 23351632 · Krátká 283, 252 65 Tursko · datová schránka fdcgvvp'),
];
