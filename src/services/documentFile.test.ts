/*
 * The rules between "a person chose a file" and "bytes we send".
 *
 * The cases here are the ones that would turn somebody away at the desk:
 * an iPhone photo refused as an unknown type, a file rejected for being large
 * with no hint of what to do about it, or a failure reported as "něco se
 * pokazilo" when the real answer was "your login expired".
 */
import { describe, it, expect } from 'vitest';
import {
  checkFile,
  isHeic,
  isPdf,
  isImage,
  formatBytes,
  uploadErrorMessage,
  scanFileName,
  MAX_FILE_BYTES,
  FILE_INPUT_ACCEPT,
} from './documentFile';

const file = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'vypis.pdf',
  type: 'application/pdf',
  size: 1024,
  ...over,
});

describe('what we accept', () => {
  it('takes a PDF', () => {
    expect(checkFile(file()).ok).toBe(true);
  });

  it('takes a photograph', () => {
    expect(checkFile(file({ name: 'foto.jpg', type: 'image/jpeg' })).ok).toBe(true);
  });

  /*
   * iOS hands over an empty `type` often enough that a types-only check
   * refuses the photo somebody is trying to send. That is most iPhone users,
   * and they would never find out why.
   */
  it('takes an iPhone photo even when the browser says nothing about its type', () => {
    expect(checkFile(file({ name: 'IMG_0042.HEIC', type: '' })).ok).toBe(true);
  });

  it('recognises HEIC by name as well as by type', () => {
    expect(isHeic({ name: 'IMG_1.HEIC', type: '' })).toBe(true);
    expect(isHeic({ name: 'x', type: 'image/heif' })).toBe(true);
    expect(isHeic({ name: 'foto.jpg', type: 'image/jpeg' })).toBe(false);
  });

  it('tells a PDF from an image, so only images get the scanner treatment', () => {
    expect(isPdf(file())).toBe(true);
    expect(isImage(file())).toBe(false);
    expect(isImage(file({ name: 'f.png', type: 'image/png' }))).toBe(true);
  });

  it('turns away a file it cannot do anything with', () => {
    const result = checkFile(file({ name: 'tabulka.xlsx', type: 'application/vnd.ms-excel' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unsupported-type');
    expect(result.message).toMatch(/PDF nebo fotografii/);
  });

  it('turns away an empty file rather than uploading nothing', () => {
    const result = checkFile(file({ size: 0 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty');
  });
});

describe('the size limit', () => {
  it('allows a file exactly at the limit', () => {
    expect(checkFile(file({ size: MAX_FILE_BYTES })).ok).toBe(true);
  });

  it('refuses one byte over', () => {
    const result = checkFile(file({ size: MAX_FILE_BYTES + 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('too-large');
  });

  /* Saying "too big" without saying what to do leaves somebody stuck holding
     a phone with one photo on it. */
  it('says both sizes and points at the way out', () => {
    const result = checkFile(file({ size: 30 * 1024 * 1024 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('30,0 MB');
    expect(result.message).toContain('25,0 MB');
    expect(result.message).toMatch(/sken/);
  });

  it('writes sizes the way Czech does', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB');
  });
});

describe('what we say when the upload fails', () => {
  it('tells an expired login apart from a server fault', () => {
    expect(uploadErrorMessage(401)).toMatch(/Přihlaste se prosím znovu/);
    expect(uploadErrorMessage(500)).toMatch(/na jeho straně/);
  });

  it('tells a too-large file what to do instead', () => {
    expect(uploadErrorMessage(413)).toMatch(/sken/);
  });

  it('says the file did not arrive when the connection dropped', () => {
    expect(uploadErrorMessage(null)).toMatch(/nenahrál/);
  });

  /* Whatever comes back, the person is told something they can act on - and
     never the same sentence for two different problems. */
  it('never gives two different failures the same words', () => {
    const messages = [null, 401, 403, 404, 413, 415, 429, 500, 418].map(uploadErrorMessage);
    expect(new Set(messages).size).toBeGreaterThan(6);
    for (const m of messages) expect(m.length).toBeGreaterThan(20);
  });
});

describe('the name a scan is saved under', () => {
  it('is findable a year later', () => {
    const name = scanFileName('Výpis ze zdravotní dokumentace', new Date(2026, 8, 12));
    expect(name).toBe('vypis-ze-zdravotni-dokumentace-2026-09-12.pdf');
  });

  it('strips diacritics rather than leaving them in a filename', () => {
    expect(scanFileName('Žádost', new Date(2026, 0, 5))).toBe('zadost-2026-01-05.pdf');
  });

  it('still produces a name when the template has none worth slugging', () => {
    expect(scanFileName('———', new Date(2026, 0, 5))).toBe('dokument-2026-01-05.pdf');
  });
});

describe('the file picker', () => {
  /* A picker that cannot see your file is indistinguishable from a broken app,
     so the accept list carries extensions as well as media types. */
  it('lists extensions too, for the browsers that send no type', () => {
    expect(FILE_INPUT_ACCEPT).toContain('.heic');
    expect(FILE_INPUT_ACCEPT).toContain('.pdf');
    expect(FILE_INPUT_ACCEPT).toContain('image/*');
  });
});
