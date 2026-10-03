/* ══════════════════════════════════════════════════════════════
   THE CLINIC'S CONTACT DETAILS, AS THE COMPANY PAGES NEED THEM

   Phone, e-mail, address and opening hours come from the clinic's own settings
   (GET /api/public/clinic, via usePublicClinic). A field the clinic has not filled
   in falls back to the shared `site.footer.*` text slots — the same fallback the
   footer uses, so the page and the footer can never disagree.
   ══════════════════════════════════════════════════════════════ */

import { useSlotText } from '../../../site/SlotText';
import { hoursLines } from '../../../components/public/PublicFooter';
import { telHref } from '../../../components/public/brand';
import { usePublicClinic } from '../../data';

export interface HoursRow {
  label: string;
  value: string;
  closed: boolean;
}

export interface ParsedHours {
  rows: HoursRow[];
  /** Lines that are not "day  time" — "provoz podle objednání". */
  notes: string[];
}

const HOURS_LINE = /^(.+?)\s+(\d{1,2}[:.]\d{2}\s*[–—-]\s*\d{1,2}[:.]\d{2}|zav[řr]eno.*)$/i;

/** ["Po–Pá 8:00–18:00", "Ne zavřeno", "provoz podle objednání"] → rows + notes. */
export function parseHours(lines: string[]): ParsedHours {
  const rows: HoursRow[] = [];
  const notes: string[] = [];
  for (const line of lines) {
    const match = HOURS_LINE.exec(line.trim());
    if (match === null) {
      if (line.trim() !== '') notes.push(line.trim());
      continue;
    }
    const value = match[2].trim();
    rows.push({ label: match[1].trim(), value, closed: /^zav[řr]eno/i.test(value) });
  }
  return { rows, notes };
}

/** A search on Mapy.cz — a plain link, no embedded map, nothing loaded from a third party. */
export const mapyCzHref = (address: string): string => `https://mapy.cz/zakladni?q=${encodeURIComponent(address)}`;

export interface ContactDetails {
  phone: string;
  phoneHref: string;
  email: string;
  /** The address, one line per row. */
  addressLines: string[];
  /** The address as one line, for a map search. */
  addressOneLine: string;
  /** True when the clinic's own settings supplied the address (and not the slot default). */
  addressFromApi: boolean;
  hours: ParsedHours;
  /** The company's own entries from the clinic settings; '' = not filled in (then nothing is shown for it). */
  company: { dic: string; bankAccount: string; dataBox: string };
}

export function useContactDetails(): ContactDetails {
  const clinic = usePublicClinic();
  const slotPhone = useSlotText('site.footer.phone');
  const slotEmail = useSlotText('site.footer.email');
  const slotAddress = useSlotText('site.footer.address');
  const slotHours = useSlotText('site.footer.hours');

  const phone = clinic.phone.trim() !== '' ? clinic.phone.trim() : slotPhone;
  const email = clinic.email.trim() !== '' ? clinic.email.trim() : slotEmail;
  const apiAddress = clinic.address.trim();
  const addressLines = (apiAddress !== '' ? apiAddress : slotAddress).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const apiHours = clinic.openingHours?.trim() ?? '';
  const hours = parseHours(apiHours !== '' ? hoursLines(apiHours) : slotHours.split('\n'));

  return {
    phone,
    phoneHref: telHref(phone),
    email,
    addressLines,
    addressOneLine: addressLines.join(', '),
    addressFromApi: apiAddress !== '',
    hours,
    company: { dic: clinic.dic?.trim() ?? '', bankAccount: clinic.bankAccount?.trim() ?? '', dataBox: clinic.dataBox?.trim() ?? '' },
  };
}
