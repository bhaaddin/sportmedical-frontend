/*
 * The message body as the visual editor holds it, and back.
 *
 * The server stores HTML with `{{key}}` placeholders. The editor shows the same HTML, cleaned of anything that could run,
 * with every placeholder turned into a labelled chip ("Jméno") the person cannot type into. Saving turns each chip back
 * into its `{{key}}`. Nobody ever sees a brace or a tag unless they open the HTML view on purpose.
 */

/** Short names for the placeholders the server ships; anything else falls back to its description. */
const SHORT_LABEL: Record<string, string> = {
  'pacient.jmeno': 'Jméno',
  'pacient.prijmeni': 'Příjmení',
  'termin.datum': 'Datum',
  'termin.cas': 'Čas',
  'termin.datum_cas': 'Datum a čas',
  'termin.cinnost': 'Vyšetření',
  'termin.sluzba': 'Služba',
  'termin.kalendar': 'Místnost',
  'odkaz.sprava': 'Adresa rezervace',
  'odkaz.sprava_html': 'Tlačítko rezervace',
  'klinika.nazev': 'Název ordinace',
  'klinika.email': 'E-mail ordinace',
  'klinika.telefon': 'Telefon ordinace',
  'klinika.adresa': 'Adresa ordinace',
  'klinika.podpis': 'Podpis ordinace',
  'klub.nazev': 'Název klubu',
  'blok.datum': 'Datum rezervace',
  'blok.cas_od': 'Čas od',
  'blok.cas_do': 'Čas do',
  'blok.popis': 'Co je rezervováno',
  'objednavka.cislo': 'Číslo objednávky',
  'zprava.predmet_uvod': 'Úvod předmětu',
  'zprava.uvod': 'Úvodní věta',
  'zprava.pokyny': 'Pokyny k vyšetření',
  'zadost.cislo': 'Číslo žádosti',
};

export interface PlaceholderInfo {
  key: string;
  description: string;
  sample?: string;
}

/** The chip text for a placeholder: a word or two, never the key. */
export function placeholderLabel(key: string, description = ''): string {
  const known = SHORT_LABEL[key];
  if (known) return known;
  const first = description.split(/[.,;(–—]/)[0]?.trim() ?? '';
  if (first !== '' && first.length <= 28) return first;
  return key.split('.').pop()!.replace(/_/g, ' ');
}

const TOKEN = /\{\{\s*([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*)\s*\}\}/gi;
const DROP = 'script,style,iframe,object,embed,form,input,button,textarea,select,link,meta,base';

/** Takes out everything that could run or submit; keeps the words and the formatting. */
function clean(root: ParentNode): void {
  root.querySelectorAll(DROP).forEach((el) => el.remove());
  root.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src') && /^\s*(javascript|data|vbscript):/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
}

/** The chip element for one placeholder. */
export function chipHtml(key: string, label: string): string {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<span data-ph="${key}" contenteditable="false" class="sm-ph">${safe}</span>`;
}

/** Stored HTML → what the editor shows: cleaned, placeholders as chips. */
export function toEditorHtml(stored: string, placeholders: readonly PlaceholderInfo[]): string {
  const doc = new DOMParser().parseFromString(`<body>${stored}</body>`, 'text/html');
  clean(doc.body);
  const describe = new Map(placeholders.map((p) => [p.key, p.description]));
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
  for (const text of texts) {
    const value = text.data;
    TOKEN.lastIndex = 0;
    if (!TOKEN.test(value)) continue;
    const holder = doc.createElement('span');
    holder.innerHTML = value
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(TOKEN, (_, key: string) => chipHtml(key, placeholderLabel(key, describe.get(key))));
    text.replaceWith(...holder.childNodes);
  }
  return doc.body.innerHTML;
}

/** What the editor holds → HTML to store: each chip back to its `{{key}}`. */
export function fromEditorHtml(edited: string): string {
  const doc = new DOMParser().parseFromString(`<body>${edited}</body>`, 'text/html');
  clean(doc.body);
  doc.body.querySelectorAll('span[data-ph]').forEach((chip) => {
    chip.replaceWith(doc.createTextNode(`{{${chip.getAttribute('data-ph')}}}`));
  });
  /* A browser leaves an empty paragraph or a lone <br> behind when everything is deleted. */
  const html = doc.body.innerHTML.trim();
  return html === '<br>' || html === '<p><br></p>' ? '' : html;
}

/** What a one-line editor holds → plain text with `{{key}}` (the subject is never HTML). */
export function fromEditorText(edited: string): string {
  const doc = new DOMParser().parseFromString(`<body>${edited}</body>`, 'text/html');
  doc.body.querySelectorAll('span[data-ph]').forEach((chip) => {
    chip.replaceWith(doc.createTextNode(`{{${chip.getAttribute('data-ph')}}}`));
  });
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Plain subject text → the one-line editor's HTML. */
export function textToEditorHtml(text: string, placeholders: readonly PlaceholderInfo[]): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return toEditorHtml(escaped, placeholders);
}
