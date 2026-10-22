import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authorize, toastError } = vi.hoisted(() => ({ authorize: vi.fn(), toastError: vi.fn() }));
vi.mock('../api/exports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/exports')>();
  return { ...actual, exportsApi: { policy: vi.fn(), authorize } };
});
vi.mock('react-hot-toast', () => ({ default: { error: toastError, success: vi.fn() } }));

import {
  download,
  downloadCsv,
  EXPORT_FORBIDDEN_MESSAGE,
  fileNameFromDisposition,
  isExportForbidden,
  mimeForFileName,
  safeFileName,
  typedBlob,
  withBom,
} from './download';

const BOM = String.fromCharCode(0xfeff);

const readBytes = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe('withBom', () => {
  it('puts exactly one byte-order mark in front', () => {
    expect(withBom('a;b')).toBe(`${BOM}a;b`);
    expect(withBom(`${BOM}a;b`)).toBe(`${BOM}a;b`);
    expect(withBom(`${BOM}${BOM}a;b`)).toBe(`${BOM}a;b`);
    expect(withBom('')).toBe(BOM);
  });
});

describe('safeFileName', () => {
  it('keeps Czech letters and the extension', () => {
    expect(safeFileName('Faktura Šťastný 2026.pdf')).toBe('Faktura Šťastný 2026.pdf');
  });

  it('removes a path and what a file system refuses', () => {
    expect(safeFileName('../../etc/passwd')).not.toMatch(/[\/]|\.\./);
    expect(safeFileName('a:b*c?"d<e>f|g.csv')).toBe('a-b-c-d-e-f-g.csv');
    expect(safeFileName('x' + String.fromCharCode(0) + 'y.csv')).toBe('xy.csv');
  });

  it('does not start with a dot and falls back when nothing is left', () => {
    expect(safeFileName('.hidden.csv')).toBe('hidden.csv');
    expect(safeFileName('   ')).toBe('soubor');
    expect(safeFileName('', 'export')).toBe('export');
  });

  it('shortens a very long name but keeps its extension', () => {
    const name = safeFileName(`${'a'.repeat(300)}.csv`);
    expect(name.length).toBe(120);
    expect(name.endsWith('.csv')).toBe(true);
  });
});

describe('fileNameFromDisposition', () => {
  it('reads the encoded name first, then the plain one', () => {
    expect(fileNameFromDisposition("attachment; filename=\"x.pdf\"; filename*=UTF-8''diagnostick%C3%A1-zpr%C3%A1va.pdf")).toBe('diagnostická-zpráva.pdf');
    expect(fileNameFromDisposition('attachment; filename="faktura-2026-0042.pdf"')).toBe('faktura-2026-0042.pdf');
    expect(fileNameFromDisposition('inline; filename=audit-export.csv')).toBe('audit-export.csv');
  });

  it('answers null when there is nothing usable', () => {
    expect(fileNameFromDisposition(undefined)).toBeNull();
    expect(fileNameFromDisposition('')).toBeNull();
    expect(fileNameFromDisposition('attachment')).toBeNull();
  });
});

describe('mime and typed blob', () => {
  it('names the type from the extension', () => {
    expect(mimeForFileName('a.PDF')).toBe('application/pdf');
    expect(mimeForFileName('a.csv')).toBe('text/csv;charset=utf-8');
    expect(mimeForFileName('a.unknown')).toBe('application/octet-stream');
  });

  it('keeps a blob that already has a type and types one that has none, the bytes untouched', async () => {
    const typed = new Blob(['x'], { type: 'application/pdf' });
    expect(typedBlob(typed, 'a.pdf')).toBe(typed);
    const bare = new Blob([new Uint8Array([1, 2, 3])]);
    const out = typedBlob(bare, 'a.pdf');
    expect(out.type).toBe('application/pdf');
    expect(new Uint8Array(await readBytes(out))).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('isExportForbidden', () => {
  const refused = (data: unknown) => ({ response: { status: 403, data } });

  it('recognises the server code in a JSON body and in a Blob body', async () => {
    expect(await isExportForbidden(refused({ code: 'export.forbidden', message: 'x' }))).toBe(true);
    expect(await isExportForbidden(refused(new Blob([JSON.stringify({ code: 'export.forbidden' })])))).toBe(true);
    expect(await isExportForbidden(refused(JSON.stringify({ code: 'export.forbidden' })))).toBe(true);
  });

  it('does not mistake another refusal or another status for it', async () => {
    expect(await isExportForbidden(refused({ code: 'access.denied' }))).toBe(false);
    expect(await isExportForbidden(refused(new Blob(['not json'])))).toBe(false);
    expect(await isExportForbidden({ response: { status: 500, data: { code: 'export.forbidden' } } })).toBe(false);
    expect(await isExportForbidden(new Error('x'))).toBe(false);
  });
});

describe('download', () => {
  let created: Blob[];
  let clicked: string[];

  beforeEach(() => {
    created = [];
    clicked = [];
    authorize.mockReset();
    authorize.mockResolvedValue(undefined);
    toastError.mockReset();
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        created.push(blob);
        return 'blob:x';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks the server before it saves a CSV it built, and saves it with one BOM and the right name', async () => {
    const ok = await downloadCsv('players-csv', 'hraci/klubu.csv', `${BOM}Jméno;Cena\r\nJan;1200,5\r\n`, 1);

    expect(ok).toBe(true);
    expect(authorize).toHaveBeenCalledWith('players-csv', 1);
    expect(clicked).toEqual(['hraci-klubu.csv']);
    expect(created[0].type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await readBytes(created[0]));
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes[3]).not.toBe(0xef);
  });

  it('saves nothing and says so in Czech when the server refuses a CSV', async () => {
    authorize.mockRejectedValue({ response: { status: 403, data: { code: 'export.forbidden' } } });

    const ok = await downloadCsv('statistics-csv', 'a.csv', 'x', 3);

    expect(ok).toBe(false);
    expect(created).toHaveLength(0);
    expect(toastError).toHaveBeenCalledWith(EXPORT_FORBIDDEN_MESSAGE);
    expect(EXPORT_FORBIDDEN_MESSAGE).toBe('Stahování povoluje administrátor.');
  });

  it('says the failure message for any other failure', async () => {
    authorize.mockRejectedValue({ response: { status: 500 } });

    expect(await downloadCsv('statistics-csv', 'a.csv', 'x', 3)).toBe(false);
    expect(toastError).toHaveBeenCalledWith('CSV se nepodařilo stáhnout.');
  });

  it('saves a server file byte for byte, using the name the server gave', async () => {
    const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });

    const ok = await download(
      { kind: 'diagnostic-pdf', fileName: 'fallback.pdf' },
      { kind: 'fetch', fetch: async () => ({ blob: pdf, fileName: 'zprava.pdf' }) },
    );

    expect(ok).toBe(true);
    expect(authorize).not.toHaveBeenCalled();
    expect(created[0]).toBe(pdf);
    expect(clicked).toEqual(['zprava.pdf']);
  });

  it('shows the server refusal of a file it builds, in Czech', async () => {
    const body = new Blob([JSON.stringify({ code: 'export.forbidden' })]);

    const ok = await download(
      { kind: 'invoice-pdf', fileName: 'f.pdf', failureMessage: 'PDF se nepodařilo načíst' },
      { kind: 'fetch', fetch: async () => Promise.reject({ response: { status: 403, data: body } }) },
    );

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith(EXPORT_FORBIDDEN_MESSAGE);
  });

  it('opens a PDF in a tab when asked and the browser allows it, else saves it', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const pdf = new Blob(['x'], { type: 'application/pdf' });

    await download({ kind: 'invoice-pdf', fileName: 'f.pdf', open: true }, { kind: 'blob', blob: pdf });
    expect(open).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveLength(0);

    open.mockReturnValue(null);
    await download({ kind: 'invoice-pdf', fileName: 'f.pdf', open: true }, { kind: 'blob', blob: pdf });
    expect(clicked).toEqual(['f.pdf']);
  });
});
