/*
 * The colour choices are the clinic's palette (Nastavení › Barvy); the built-in list is only the
 * offline fallback, and a colour already stored on the record stays selectable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VIEWPORTS, setViewport } from '../../test/viewport';
import { readableTextOn } from '../../utils/calendarPalette';

const get = vi.fn();
vi.mock('../../api/serviceColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/serviceColors')>();
  return { ...actual, serviceColorsApi: { ...actual.serviceColorsApi, get } };
});

const { ColorSelect } = await import('./ColorSelect');

const open = async (value: string) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ColorSelect label="Barva" value={value} onChange={() => {}} />
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  return screen.findAllByRole('option');
};

beforeEach(() => { get.mockReset(); });

describe.each(Object.entries(VIEWPORTS))('ColorSelect at %s (%i px)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it("offers the clinic's palette, named by its code, plus a stored colour the palette dropped", async () => {
    get.mockResolvedValue({ palette: ['#112233', '#445566', 'not-a-colour'] });
    const options = await open('#ABCDEF');
    const names = options.map((o) => o.textContent);
    expect(names).toContain('#112233');
    expect(names).toContain('#445566');
    expect(names).toContain('#ABCDEF');
    expect(names).not.toContain('not-a-colour');
  });

  it('falls back to the built-in colours when the palette cannot be read', async () => {
    get.mockRejectedValue(new Error('403'));
    const options = await open('#1565C0');
    expect(options.length).toBeGreaterThanOrEqual(12);
  });
});

describe('readableTextOn', () => {
  it('keeps the checked text colour of a built-in colour and computes one for a palette colour', () => {
    expect(readableTextOn('#FFC107')).toBe('#000000');
    expect(readableTextOn('#FAFAFA')).toBe('#000000');
    expect(readableTextOn('#0A0A3C')).toBe('#FFFFFF');
    expect(readableTextOn(undefined)).toBe('#FFFFFF');
  });
});
