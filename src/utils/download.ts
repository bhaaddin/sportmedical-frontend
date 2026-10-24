/* ══════════════════════════════════════════════════════════════
   THE ONE DOWNLOAD HELPER (R14f)

   Every export, CSV, PDF and document that leaves the application is saved through `download()`:

     - highest quality: a CSV is UTF-8 with exactly one byte-order mark and the numbers exactly as they are (no
       rounding is done here); a PDF, an image or a JSON is saved byte for byte as the server sent it - never
       re-encoded, never downscaled;
     - a correct file name (`safeFileName`: no path, nothing a file system refuses, the extension kept; the
       server's own name when it can be read from Content-Disposition);
     - allowed by an administrator: a file the server builds is gated and audited by the server (`exports.download`,
       403 `export.forbidden`); a file the browser builds from data it already holds asks `exportsApi.authorize`
       first, which gates and audits it the same way. A refusal is shown in Czech.

   Buttons are drawn with `ExportGate` so a person without the permission sees why the button is off.
   ══════════════════════════════════════════════════════════════ */

import toast from 'react-hot-toast';
import { EXPORT_FORBIDDEN_CODE, EXPORT_FORBIDDEN_MESSAGE, exportsApi } from '../api/exports';

export { EXPORT_FORBIDDEN_MESSAGE };

const BOM = String.fromCharCode(0xfeff);

/** What the browser was asked to save: the kind is an audit slug (`statistics-csv`), never a name or an id. */
export interface DownloadSpec {
  /** `^[a-z0-9-]{1,40}$`, shown in the audit trail with the count. */
  kind: string;
  fileName: string;
  /** Rows or pages in the file. Only used for a file built here; the server counts its own. */
  count?: number;
  /** Show it in a new tab instead of saving it (an invoice PDF), falling back to a save when the browser refuses. */
  open?: boolean;
  /** Said when the download fails for any reason other than a refusal. */
  failureMessage?: string;
}

/** Text the browser builds (a CSV) or a Blob the server sent (fetched only when the person may have it). */
export type DownloadSource =
  | { kind: 'text'; text: string; mime?: string }
  | { kind: 'blob'; blob: Blob }
  | { kind: 'fetch'; fetch: () => Promise<Blob | { blob: Blob; fileName?: string }> };

/** A refusal in the words the person reads. */
export class ExportForbiddenError extends Error {
  constructor() {
    super(EXPORT_FORBIDDEN_MESSAGE);
    this.name = 'ExportForbiddenError';
  }
}

/* ── pure pieces (tested without a browser) ── */

/** The text with exactly one UTF-8 byte-order mark in front, so Excel reads the Czech letters. */
export function withBom(text: string): string {
  let start = 0;
  while (text.startsWith(BOM, start)) start += BOM.length;
  return BOM + text.slice(start);
}

/** A name every file system accepts; the extension survives, a path and control characters do not. */
export function safeFileName(name: string, fallback = 'soubor'): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .replace(/-{2,}/g, '-');
  if (cleaned === '') return fallback;
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf('.');
  const extension = dot > 0 && cleaned.length - dot <= 8 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, 120 - extension.length) + extension;
}

/** The file name a server offered in Content-Disposition (RFC 6266, `filename*` first), or null. */
export function fileNameFromDisposition(header: string | null | undefined): string | null {
  if (header === null || header === undefined || header === '') return null;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (star !== null) {
    try {
      return safeFileName(decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')));
    } catch {
      /* fall through to the plain name */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header);
  return plain !== null ? safeFileName(plain[1].trim()) : null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  md: 'text/markdown;charset=utf-8',
  xml: 'application/xml',
  txt: 'text/plain;charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ics: 'text/calendar;charset=utf-8',
};

export function mimeForFileName(fileName: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(fileName)?.[1]?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/** The same bytes with a type when the server sent none; a typed blob is returned as it is. */
export function typedBlob(blob: Blob, fileName: string): Blob {
  return blob.type !== '' && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: mimeForFileName(fileName) });
}

/** Whether an error is the server's `export.forbidden` (the body may be a Blob when a file was asked for). */
export async function isExportForbidden(error: unknown): Promise<boolean> {
  if (error instanceof ExportForbiddenError) return true;
  const response = (error as { response?: { status?: number; data?: unknown } } | undefined)?.response;
  if (response?.status !== 403) return false;
  let data = response.data;
  try {
    if (typeof Blob !== 'undefined' && data instanceof Blob) data = JSON.parse(await data.text());
    else if (typeof data === 'string') data = JSON.parse(data);
  } catch {
    return false;
  }
  return (data as { code?: unknown } | null | undefined)?.code === EXPORT_FORBIDDEN_CODE;
}

/* ── the impure edge ── */

/** Hands a blob to the browser: a new tab when asked and allowed, a save otherwise. */
export function saveBlob(blob: Blob, fileName: string, open = false): void {
  const name = safeFileName(fileName);
  const file = typedBlob(blob, name);
  const url = URL.createObjectURL(file);
  const tab = open ? window.open(url, '_blank') : null;
  if (tab === null || tab === undefined) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  /* Long enough for a slow viewer to read it, short enough not to pin the file. */
  window.setTimeout(() => URL.revokeObjectURL(url), open ? 5 * 60_000 : 1_000);
}

/**
 * Saves a file. Returns whether it was saved; a failure is shown (a refusal in Czech) and never thrown, so a button
 * only has to call it.
 */
export async function download(spec: DownloadSpec, source: DownloadSource): Promise<boolean> {
  try {
    let blob: Blob;
    let fileName = spec.fileName;

    if (source.kind === 'fetch') {
      /* The server builds it: it gates and audits it itself. */
      const got = await source.fetch();
      if (got instanceof Blob) blob = got;
      else {
        blob = got.blob;
        if (got.fileName !== undefined && got.fileName !== '') fileName = got.fileName;
      }
    } else {
      /* The browser builds it from data it already holds: ask the server first. */
      blob =
        source.kind === 'text'
          ? new Blob([(source.mime ?? 'text/csv;charset=utf-8').startsWith('text/csv') ? withBom(source.text) : source.text], {
              type: source.mime ?? 'text/csv;charset=utf-8',
            })
          : source.blob;
      await exportsApi.authorize(spec.kind, spec.count ?? 1);
    }

    saveBlob(blob, fileName, spec.open === true);
    return true;
  } catch (error) {
    toast.error((await isExportForbidden(error)) ? EXPORT_FORBIDDEN_MESSAGE : (spec.failureMessage ?? 'Soubor se nepodařilo stáhnout.'));
    return false;
  }
}

/** A CSV the browser built. `rows` is the number of data rows, for the audit trail. */
export const downloadCsv = (kind: string, fileName: string, csv: string, rows: number): Promise<boolean> =>
  download({ kind, fileName, count: rows, failureMessage: 'CSV se nepodařilo stáhnout.' }, { kind: 'text', text: csv });
