/*
 * Everything between "a person chose a file" and "bytes the upload can send".
 *
 * The rules live here rather than in the screen so they can be tested without
 * a browser, and so the same rules apply to the staff screen and - once the
 * patient link exists - to the page a patient opens on their phone.
 *
 * None of this is a security boundary. A public upload endpoint has to enforce
 * its own limits: anybody can skip the browser. These checks exist so nobody
 * waits ninety seconds for an upload the server was always going to refuse.
 */

/** What a person may hand us. */
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
] as const;

/**
 * The attribute on the file input.
 *
 * Extensions are listed alongside the media types on purpose: iOS reports HEIC
 * with an empty type often enough that a types-only filter hides the photo the
 * person is trying to pick, and a picker that cannot see your file is
 * indistinguishable from a broken app.
 */
export const FILE_INPUT_ACCEPT =
  'application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type RejectionReason =
  | 'empty'
  | 'too-large'
  | 'unsupported-type';

export interface FileRejection {
  ok: false;
  reason: RejectionReason;
  /** Ready to show. Says what to do, not only that something is wrong. */
  message: string;
}

export type FileCheck = { ok: true } | FileRejection;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * True for a HEIC/HEIF photo, the format iPhones shoot by default.
 *
 * Checked by extension as well as type because iOS frequently hands over an
 * empty `type`. Getting this wrong means an iPhone user's photo is refused as
 * "unsupported" - which is most people, and they would have no idea why.
 */
export function isHeic(file: { name: string; type: string }): boolean {
  const type = file.type.toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  return /\.(heic|heif)$/i.test(file.name);
}

export function isPdf(file: { name: string; type: string }): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** Everything that is not a PDF is an image we can rotate, crop and enhance. */
export function isImage(file: { name: string; type: string }): boolean {
  return !isPdf(file);
}

export function checkFile(file: { name: string; type: string; size: number }): FileCheck {
  if (file.size === 0) {
    return {
      ok: false,
      reason: 'empty',
      message: 'Soubor je prázdný. Zkuste ho prosím vybrat znovu.',
    };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: 'too-large',
      message:
        `Soubor má ${formatBytes(file.size)}, což je víc než povolených ` +
        `${formatBytes(MAX_FILE_BYTES)}. U fotografie pomůže vyfotit dokument ` +
        'znovu přes sken — výsledek bývá několikrát menší.',
    };
  }

  const type = file.type.toLowerCase();
  const acceptable =
    (ACCEPTED_MIME_TYPES as readonly string[]).includes(type) ||
    type.startsWith('image/') ||
    isHeic(file) ||
    isPdf(file);

  if (!acceptable) {
    return {
      ok: false,
      reason: 'unsupported-type',
      message:
        'Tenhle typ souboru přijmout neumíme. Pošlete PDF nebo fotografii ' +
        '(JPG, PNG, HEIC).',
    };
  }

  return { ok: true };
}

/**
 * What went wrong on the way to the server, said plainly.
 *
 * "Něco se pokazilo" tells the person at the desk nothing about whether to try
 * again, try a smaller file, or fetch somebody. Each of these does.
 */
export function uploadErrorMessage(status: number | null): string {
  if (status === null) {
    return 'Spojení se serverem se přerušilo. Soubor se nenahrál — zkuste to prosím znovu.';
  }
  switch (status) {
    case 401:
    case 403:
      return 'Vaše přihlášení vypršelo. Přihlaste se prosím znovu a soubor nahrajte ještě jednou.';
    case 404:
      return 'Pacient nebo šablona dokumentu už neexistuje. Načtěte prosím stránku znovu.';
    case 413:
      return 'Soubor je pro server příliš velký. Zkuste ho vyfotit přes sken, výsledek bývá menší.';
    case 415:
      return 'Server tenhle typ souboru nepřijímá. Pošlete PDF nebo fotografii.';
    case 429:
      return 'Nahrávání je dočasně omezené. Zkuste to prosím za chvíli.';
    case 410:
      /* Seen for real: the file went out labelled as JSON because the shared
         axios client forces that header, and the server answered 410 rather
         than anything about the content type. */
      return 'Server tenhle požadavek odmítl jako zastaralý. Načtěte prosím stránku znovu — pokud to potrvá, jde o chybu na naší straně.';
    default:
      if (status >= 500) {
        return 'Server soubor nepřijal a chyba je na jeho straně. Zkuste to prosím za chvíli znovu.';
      }
      return `Soubor se nepodařilo nahrát (kód ${status}). Zkuste to prosím znovu.`;
  }
}

/** `vypis-2026-09-12.pdf` — a name somebody can find later. */
export function scanFileName(templateName: string, now: Date = new Date()): string {
  const slug = templateName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${slug || 'dokument'}-${date}.pdf`;
}
