import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const readSettings = vi.fn();
vi.mock('../../../api/clinicSettings', () => ({ readSettings }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { absoluteLink, normalizeBase, resetPublicSiteBase, shortLink } = await import('./absoluteLink');
const { LinkCopyRow } = await import('./LinkCopyRow');

beforeEach(() => {
  readSettings.mockReset();
  resetPublicSiteBase();
});

describe('absoluteLink', () => {
  it('uses the public address the admin set', () => {
    expect(absoluteLink('/klub-objednavka/abc', 'https://www.sportmedical.cz')).toBe('https://www.sportmedical.cz/klub-objednavka/abc');
  });

  it('falls back to this app origin without a public address', () => {
    expect(absoluteLink('/klub/abc')).toBe(`${window.location.origin}/klub/abc`);
    expect(absoluteLink('klub/abc', '')).toBe(`${window.location.origin}/klub/abc`);
  });

  it('keeps an empty path empty (the order has no link yet)', () => {
    expect(absoluteLink('')).toBe('');
    expect(absoluteLink(null, 'https://x.cz')).toBe('');
  });

  it('keeps an absolute link, but swaps its long preview origin for the public address', () => {
    const long = 'https://sportmedical-frontend-virtual-abc123.vercel.app/klub/t1?x=1';
    expect(absoluteLink(long)).toBe(long);
    expect(absoluteLink(long, 'www.sportmedical.cz')).toBe('https://www.sportmedical.cz/klub/t1?x=1');
  });

  it('normalizes what the admin typed', () => {
    expect(normalizeBase(' sportmedical.cz/ ')).toBe('https://sportmedical.cz');
    expect(normalizeBase('http://a.cz/path')).toBe('http://a.cz');
    expect(normalizeBase('')).toBe('');
    expect(normalizeBase('not a url')).toBe('');
  });

  it('shows a link short', () => {
    expect(shortLink('https://www.sportmedical.cz/klub/abc/')).toBe('www.sportmedical.cz/klub/abc');
  });
});

describe('LinkCopyRow', () => {
  it('shows the short public link and copies the full one with one click', async () => {
    readSettings.mockResolvedValue({ 'pub.siteUrl': 'https://www.sportmedical.cz' });
    const user = userEvent.setup();
    render(<LinkCopyRow label="Odkaz na formulář" path="/klub-objednavka/tok" testId="row" />);
    await waitFor(() => expect(screen.getByTestId('row')).toHaveAttribute('data-url', 'https://www.sportmedical.cz/klub-objednavka/tok'));
    expect(screen.getByTestId('row')).toHaveTextContent('www.sportmedical.cz/klub-objednavka/tok');
    expect(screen.getByTestId('row')).not.toHaveTextContent('https://');
    await user.click(screen.getByRole('button', { name: 'Zkopírovat: Odkaz na formulář' }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('https://www.sportmedical.cz/klub-objednavka/tok'));
  });

  it('uses this app origin while no public address is set', async () => {
    readSettings.mockResolvedValue({});
    render(<LinkCopyRow label="Odkaz" path="/klub/x" testId="row" />);
    await waitFor(() => expect(readSettings).toHaveBeenCalled());
    expect(screen.getByTestId('row')).toHaveAttribute('data-url', `${window.location.origin}/klub/x`);
  });

  it('a failing settings call never breaks the link', async () => {
    readSettings.mockRejectedValue(new Error('403'));
    render(<LinkCopyRow label="Odkaz" path="/klub/x" testId="row" />);
    await waitFor(() => expect(readSettings).toHaveBeenCalled());
    expect(screen.getByTestId('row')).toHaveAttribute('data-url', `${window.location.origin}/klub/x`);
  });

  it('is disabled until the order has a link', async () => {
    readSettings.mockResolvedValue({});
    render(<LinkCopyRow label="Odkaz" path="" />);
    expect(screen.getByRole('button', { name: 'Zkopírovat: Odkaz' })).toBeDisabled();
  });
});
