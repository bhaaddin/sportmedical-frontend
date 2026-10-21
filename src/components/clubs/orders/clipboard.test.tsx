import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material';
import { CopyButton } from './CopyButton';
import { copyToClipboard } from './clipboard';

const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('copyToClipboard', () => {
  beforeEach(() => setClipboard(undefined));

  it('uses the clipboard API when there is one', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copyToClipboard('https://a.cz/klub/x')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://a.cz/klub/x');
  });

  it('falls back to a textarea and execCommand when the API refuses', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    expect(await copyToClipboard('abc')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('says false when nothing could copy', async () => {
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(false);
    expect(await copyToClipboard('abc')).toBe(false);
  });
});

describe('CopyButton', () => {
  it('shows "Zkopírováno" for two seconds, then the label again', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<ThemeProvider theme={createTheme()}><CopyButton text="https://x.cz/klub/t" label="Kopírovat" /></ThemeProvider>);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Kopírovat');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('Zkopírováno'));
    expect(writeText).toHaveBeenCalledWith('https://x.cz/klub/t');
    act(() => { vi.advanceTimersByTime(1900); });
    expect(button).toHaveTextContent('Zkopírováno');
    act(() => { vi.advanceTimersByTime(200); });
    expect(button).toHaveTextContent('Kopírovat');
  });

  it('is disabled without a link and reports a refusal', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('no')) });
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(false);
    const { rerender } = render(<ThemeProvider theme={createTheme()}><CopyButton text="" /></ThemeProvider>);
    expect(screen.getByRole('button')).toBeDisabled();
    rerender(<ThemeProvider theme={createTheme()}><CopyButton text="x" /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Nepodařilo se zkopírovat'));
  });
});
