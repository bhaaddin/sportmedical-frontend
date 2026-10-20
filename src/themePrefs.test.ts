/* What the app reads back from localStorage: validated, never trusted. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  LEGACY_MODE_STORAGE_KEY,
  MODE_STORAGE_KEY,
  readStoredAccent,
  readStoredMode,
} from './themePrefs';
import { THEME_ACCENTS } from './theme';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('the storage keys and defaults', () => {
  it('uses the two documented keys, the mode key versioned', () => {
    expect(ACCENT_STORAGE_KEY).toBe('sm-theme-accent');
    expect(MODE_STORAGE_KEY).toBe('sm-theme-mode-v2');
    expect(LEGACY_MODE_STORAGE_KEY).toBe('sm-theme-mode');
  });
  it('defaults to the forest green and the dark glass', () => {
    expect(DEFAULT_ACCENT).toBe('#0D5C52');
    expect(DEFAULT_MODE).toBe('dark');
  });
});

describe('readStoredAccent', () => {
  it('is the default when nothing is stored', () => {
    expect(readStoredAccent()).toBe(DEFAULT_ACCENT);
  });

  it.each(THEME_ACCENTS.map((a) => [a.label, a.color] as const))('returns the stored swatch %s (%s) in upper case', (_label, color) => {
    localStorage.setItem(ACCENT_STORAGE_KEY, color.toLowerCase());
    expect(readStoredAccent()).toBe(color);
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['a word', 'blue'],
    ['hex without #', '2563EB'],
    ['5 digits', '#25ABC'],
    ['7 digits', '#2563EB1'],
    ['8 digits (alpha)', '#2563EB80'],
    ['non-hex digits', '#25G3EB'],
    ['rgb()', 'rgb(37, 99, 235)'],
    ['hsl()', 'hsl(221, 83%, 53%)'],
    ['a url', 'url(javascript:1)'],
    ['a var()', 'var(--sm-accent)'],
    ['white', '#FFFFFF'],
    ['near white', '#F8F8F8'],
    ['light yellow', '#FFFFAA'],
    ['the string undefined', 'undefined'],
    ['the string null', 'null'],
    ['JSON', '{"accent":"#2563EB"}'],
    ['an array', '["#2563EB"]'],
    ['a very long value', '#' + 'A'.repeat(5000)],
  ])('falls back to the default for %s', (_name, stored) => {
    localStorage.setItem(ACCENT_STORAGE_KEY, stored);
    expect(readStoredAccent()).toBe(DEFAULT_ACCENT);
  });

  it('is the default when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readStoredAccent()).toBe(DEFAULT_ACCENT);
  });

  it('accepts a 3-digit hex that is dark enough', () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, '#036');
    expect(readStoredAccent()).toBe('#003366');
  });
});

describe('readStoredMode', () => {
  it('is dark when nothing is stored', () => {
    expect(readStoredMode()).toBe('dark');
  });

  it.each(['light', 'dark'] as const)('returns an explicit v2 %s', (mode) => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    expect(readStoredMode()).toBe(mode);
  });

  it.each(['', 'Light', 'DARK', 'auto', 'system', 'true', '1', 'null', '{"mode":"light"}', ' light'])('treats %j as the dark default', (stored) => {
    localStorage.setItem(MODE_STORAGE_KEY, stored);
    expect(readStoredMode()).toBe('dark');
  });

  it('never obeys the legacy key: a stored "light" there is dropped and the default is dark', () => {
    localStorage.setItem(LEGACY_MODE_STORAGE_KEY, 'light');
    expect(readStoredMode()).toBe('dark');
    expect(localStorage.getItem(LEGACY_MODE_STORAGE_KEY)).toBeNull();
  });

  it('drops the legacy key but keeps an explicit v2 choice next to it', () => {
    localStorage.setItem(LEGACY_MODE_STORAGE_KEY, 'dark');
    localStorage.setItem(MODE_STORAGE_KEY, 'light');
    expect(readStoredMode()).toBe('light');
    expect(localStorage.getItem(LEGACY_MODE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
  });

  it('is dark when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readStoredMode()).toBe('dark');
  });

  it('does not write anything when there is nothing to migrate', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    readStoredMode();
    expect(set).not.toHaveBeenCalled();
  });
});
