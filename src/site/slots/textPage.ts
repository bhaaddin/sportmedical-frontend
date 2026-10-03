import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/*
 * The slots of a text page (Obchodní podmínky, Ochrana osobních údajů, Storno a reklamace): a hero,
 * numbered sections (each a title slot and a body slot) and the closing contact block. Shared by the
 * three page files so they cannot drift apart. Body markup: see src/web/pages/company/richText.tsx
 * ("{email}", "{telefon}", "{adresa}" are filled from the clinic's settings, never typed).
 */

export interface TextSection { id: string; title: string; text: string }

export const sectionKey = (prefix: string, id: string, part: 'title' | 'text'): string => `${prefix}.sec.${id}.${part}`;

/** The admin-only note: it is in the admin's list ("Média a texty") and never rendered on the public page. */
export const adminNoteKey = (prefix: string): string => `${prefix}.adminnote`;

export interface TextPageDef {
  prefix: string;
  /** "Obchodní podmínky" — the page name in the admin's group headers. */
  page: string;
  eyebrow: string;
  title: string;
  lead?: string;
  sections: readonly TextSection[];
}

export function textPageSlots(def: TextPageDef): SlotDef[] {
  const hero = `${def.page} › Úvod`;
  const body = `${def.page} › Text`;
  const contact = `${def.page} › Kontaktní údaje`;
  const note = `${def.page} › Poznámka pro správce`;
  return [
    textSlot(`${def.prefix}.hero.eyebrow`, 'Úvod — nadpis nad titulkem', hero, def.eyebrow),
    textSlot(`${def.prefix}.hero.title`, 'Úvod — titulek stránky', hero, def.title),
    ...(def.lead !== undefined ? [textSlot(`${def.prefix}.hero.lead`, 'Úvod — úvodní odstavec', hero, def.lead, { multiline: true })] : []),
    ...def.sections.flatMap((section): SlotDef[] => [
      textSlot(sectionKey(def.prefix, section.id, 'title'), `${section.title} — nadpis oddílu`, body, section.title),
      textSlot(sectionKey(def.prefix, section.id, 'text'), `${section.title} — text oddílu`, body, section.text, { multiline: true }),
    ]),
    textSlot(`${def.prefix}.contact.title`, 'Kontaktní údaje — nadpis', contact, 'Kontaktní údaje'),
    textSlot(`${def.prefix}.contact.lead`, 'Kontaktní údaje — úvodní věta (telefon, e-mail a adresa se berou z nastavení kliniky)', contact, 'SportMedical Diagnostics s.r.o., klinika sportovní medicíny a diagnostiky'),
    textSlot(`${def.prefix}.toc.title`, 'Obsah — nadpis (zobrazí se u dlouhých textů)', body, 'Obsah'),
    textSlot(`${def.prefix}.more.title`, 'Další dokumenty — nadpis', body, 'Další informace'),
    textSlot(
      adminNoteKey(def.prefix),
      'POZNÁMKA PRO SPRÁVCE — na veřejné stránce se nezobrazuje',
      note,
      'Znění k právní kontrole provozovatelem',
    ),
  ];
}
